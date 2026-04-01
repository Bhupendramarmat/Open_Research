"""
OpenResearch — Multi-source Paper Fetcher

Fetches papers in parallel from:
1) Semantic Scholar Academic Graph API
2) PubMed (NCBI E-utilities)
3) Europe PMC REST API
4) Crossref REST API
5) OpenAlex REST API (CC0, free)

Returns a single merged, deduplicated, ranked list of papers.
"""

import os
import re
from pathlib import Path
import threading
import time
import xml.etree.ElementTree as ET
from html import unescape
from concurrent.futures import ThreadPoolExecutor
from collections import Counter

import requests

# ── Constants ─────────────────────────────────────────────────────────
SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1/paper/search"
PUBMED_ESEARCH_API = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_EFETCH_API = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
EUROPE_PMC_SEARCH_API = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
CROSSREF_WORKS_API = "https://api.crossref.org/works"
OPENALEX_WORKS_API = "https://api.openalex.org/works"

FIELDS = "title,authors,abstract,url,year,citationCount,openAccessPdf"
SOURCE_POOL_MULTIPLIER = 3
MIN_SOURCE_POOL = 30
MAX_SOURCE_POOL = 90
S2_MAX_RETRIES = 3
S2_BACKOFF_BASE_SEC = 1.2
S2_BACKOFF_MAX_SEC = 8.0

# Global lock and state for Semantic Scholar rate limiting (1 request / second)
_s2_lock = threading.Lock()
_last_request_time = 0.0

_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "into",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "this",
    "to",
    "using",
    "with",
    "review",
    "systematic",
    "narrative",
    "study",
}

_REVIEW_TERMS = {
    "review",
    "systematic review",
    "narrative review",
    "meta analysis",
    "meta-analysis",
}


def _safe_int(value) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _source_pool_target(limit: int) -> int:
    return min(MAX_SOURCE_POOL, max(limit * SOURCE_POOL_MULTIPLIER, MIN_SOURCE_POOL))


def _normalize_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (title or "").lower()).strip()


def _rank_key(paper: dict) -> tuple[int, int]:
    return (_safe_int(paper.get("citation_count")), _safe_int(paper.get("year")))


def _normalize_query_text(text: str) -> str:
    normalized = re.sub(r"\bpre\s*[- ]?eclampsia\b", "preeclampsia", text or "", flags=re.IGNORECASE)
    normalized = re.sub(r"\bpre\s*[- ]?term\b", "preterm", normalized, flags=re.IGNORECASE)
    return " ".join(normalized.split())


def _extract_query_terms(query: str) -> list[str]:
    normalized = _normalize_query_text(query).lower()
    terms = []
    for token in re.findall(r"[a-z0-9]+", normalized):
        if token in {"low", "high", "risk"}:
            terms.append(token)
            continue
        if len(token) >= 3 and token not in _STOPWORDS:
            terms.append(token)
    return list(dict.fromkeys(terms))


def _paper_relevance_score(paper: dict, query: str) -> int:
    query_terms = _extract_query_terms(query)
    title_text = _normalize_query_text(paper.get("title", "")).lower()
    abstract_text = _normalize_query_text(paper.get("abstract", "")).lower()
    haystack = f"{title_text} {abstract_text}"

    score = 0
    normalized_query = _normalize_query_text(query).lower()

    for phrase in _REVIEW_TERMS:
        if phrase in title_text or phrase in abstract_text:
            if phrase not in normalized_query:
                score -= 6

    for term in query_terms:
        if term in title_text:
            score += 7
        elif term in abstract_text:
            score += 3

    if len(query_terms) >= 3 and all(term in title_text for term in query_terms[:3]):
        score += 8

    return score


def _is_retracted(title: str, abstract: str) -> bool:
    t = (title or "").lower()
    a = (abstract or "").lower()
    return "retracted" in t or "statement of retraction" in a


def _recency_boost(year_value: int) -> int:
    if year_value <= 0:
        return 0
    current_year = time.gmtime().tm_year
    age = max(0, current_year - year_value)
    return max(0, 10 - age)


def _citation_boost(citation_count: int) -> int:
    if citation_count <= 0:
        return 0
    return min(15, int((citation_count ** 0.5) * 2.5))


def _sort_key_with_query(paper: dict, query: str) -> tuple[int, int, int]:
    year_value = _safe_int(paper.get("year"))
    citation_value = _safe_int(paper.get("citation_count"))
    relevance = _paper_relevance_score(paper, query)
    relevance += _recency_boost(year_value)
    relevance += _citation_boost(citation_value)

    return (
        relevance,
        year_value,
        citation_value,
    )


def _build_query_candidates(query: str) -> list[str]:
    base = _normalize_query_text(" ".join((query or "").split()).strip())
    if not base:
        return []

    candidates: list[str] = [base]

    no_punct = re.sub(r"[^A-Za-z0-9\s]", " ", base)
    no_punct = " ".join(no_punct.split())
    if no_punct and no_punct.lower() != base.lower():
        candidates.append(no_punct)

    preeclampsia_variant = re.sub(r"\bpre\s+eclampsia\b", "preeclampsia", no_punct, flags=re.IGNORECASE)
    if preeclampsia_variant and preeclampsia_variant.lower() not in [c.lower() for c in candidates]:
        candidates.append(preeclampsia_variant)

    lowered = no_punct.lower()
    stripped = re.sub(r"\b(impact of|effects? of|a review|systematic review|narrative review)\b", " ", lowered)
    stripped = " ".join(stripped.split())
    if stripped and stripped not in [c.lower() for c in candidates]:
        candidates.append(stripped)

    raw_tokens = re.findall(r"[A-Za-z0-9]+", no_punct)
    keyword_tokens = [
        token
        for token in raw_tokens
        if (token.isupper() and len(token) <= 6)
        or (len(token) >= 4 and token.lower() not in _STOPWORDS)
    ]

    if keyword_tokens:
        counts = Counter(token.lower() for token in keyword_tokens)
        ranked = sorted(keyword_tokens, key=lambda t: (-counts[t.lower()], raw_tokens.index(t)))

        dedup_ranked = []
        seen = set()
        for token in ranked:
            key = token.lower()
            if key in seen:
                continue
            seen.add(key)
            dedup_ranked.append(token)

        keyword_query = " ".join(dedup_ranked[:12])
        if keyword_query and keyword_query.lower() not in [c.lower() for c in candidates]:
            candidates.append(keyword_query)

    lowered_candidates = " ".join(candidates).lower()
    if ("nabh" in lowered_candidates or "jci" in lowered_candidates) and "accreditation" not in lowered_candidates:
        candidates.append("hospital accreditation quality outcomes medical tourism india")

    unique_candidates = []
    seen_candidates = set()
    for candidate in candidates:
        key = candidate.lower().strip()
        if not key or key in seen_candidates:
            continue
        seen_candidates.add(key)
        unique_candidates.append(candidate)

    return unique_candidates[:4]


def _dedupe_by_title(papers: list[dict]) -> list[dict]:
    ranked = sorted(papers, key=_rank_key, reverse=True)
    deduped = []
    seen_titles = set()

    for paper in ranked:
        title_key = _normalize_title(paper.get("title", ""))
        if title_key and title_key in seen_titles:
            continue
        if title_key:
            seen_titles.add(title_key)
        deduped.append(paper)

    return deduped


def _dedupe_by_title_with_query(papers: list[dict], query: str) -> list[dict]:
    best_by_title: dict[str, dict] = {}

    for paper in papers:
        title_key = _normalize_title(paper.get("title", ""))
        if not title_key:
            continue
        existing = best_by_title.get(title_key)
        if not existing or _sort_key_with_query(paper, query) > _sort_key_with_query(existing, query):
            best_by_title[title_key] = paper

    ranked = sorted(best_by_title.values(), key=lambda p: _sort_key_with_query(p, query), reverse=True)
    return ranked


def fetch_semantic_papers(query: str, limit: int = 5) -> list[dict]:
    """Fetch papers from Semantic Scholar."""
    headers = {}
    s2_api_key = os.getenv("S2_API_KEY")
    if s2_api_key:
        headers["x-api-key"] = s2_api_key

    all_papers: list[dict] = []
    candidates = _build_query_candidates(query)
    target_pool = _source_pool_target(limit)
    request_limit = min(100, max(target_pool, 20))

    def _s2_request(params: dict) -> requests.Response:
        last_error: Exception | None = None
        for attempt in range(S2_MAX_RETRIES + 1):
            try:
                global _last_request_time
                with _s2_lock:
                    current_time = time.time()
                    time_since_last = current_time - _last_request_time
                    if time_since_last < 1.1:
                        time.sleep(1.1 - time_since_last)

                    _last_request_time = time.time()
                    response = requests.get(SEMANTIC_SCHOLAR_API, headers=headers, params=params, timeout=15)

                if response.status_code in {429, 500, 502, 503, 504}:
                    retry_after = response.headers.get("Retry-After")
                    if retry_after:
                        try:
                            sleep_for = float(retry_after)
                        except ValueError:
                            sleep_for = S2_BACKOFF_BASE_SEC * (2 ** attempt)
                    else:
                        sleep_for = S2_BACKOFF_BASE_SEC * (2 ** attempt)

                    sleep_for = min(sleep_for, S2_BACKOFF_MAX_SEC)
                    print(
                        f"⏳ Semantic Scholar retry {attempt + 1}/{S2_MAX_RETRIES + 1} "
                        f"after {sleep_for:.1f}s (status {response.status_code})."
                    )
                    time.sleep(sleep_for)
                    continue

                response.raise_for_status()
                return response
            except requests.RequestException as e:
                last_error = e
                sleep_for = min(S2_BACKOFF_BASE_SEC * (2 ** attempt), S2_BACKOFF_MAX_SEC)
                print(
                    f"⏳ Semantic Scholar retry {attempt + 1}/{S2_MAX_RETRIES + 1} "
                    f"after {sleep_for:.1f}s (network error)."
                )
                time.sleep(sleep_for)

        if last_error:
            raise last_error
        raise requests.RequestException("Semantic Scholar request failed")

    for candidate_query in candidates:
        params = {
            "query": candidate_query,
            "limit": request_limit,
            "fields": FIELDS,
        }

        try:
            response = _s2_request(params)
        except requests.RequestException as e:
            print(f"❌ Semantic Scholar API error for query '{candidate_query}': {e}")
            continue

        data = response.json()
        papers_raw = data.get("data", [])

        for paper in papers_raw:
            if not paper.get("abstract"):
                continue

            if _is_retracted(paper.get("title", ""), paper.get("abstract", "")):
                continue

            authors_list = paper.get("authors", [])
            if len(authors_list) <= 3:
                authors_str = ", ".join(a.get("name", "Unknown") for a in authors_list)
            else:
                authors_str = f"{authors_list[0].get('name', 'Unknown')} et al."

            open_access = paper.get("openAccessPdf")
            url = (
                open_access.get("url")
                if open_access and open_access.get("url")
                else paper.get("url", f"https://api.semanticscholar.org/paper/{paper.get('paperId', '')}")
            )

            all_papers.append(
                {
                    "title": paper.get("title", "Untitled"),
                    "authors": authors_str,
                    "abstract": paper["abstract"],
                    "url": url,
                    "year": paper.get("year", "N/A"),
                    "citation_count": paper.get("citationCount", 0),
                    "source": "semantic_scholar",
                }
            )

        all_papers = _dedupe_by_title(all_papers)
        if len(all_papers) >= target_pool:
            break

    print(f"📚 Semantic Scholar: fetched {len(all_papers)} papers")
    return all_papers[:target_pool]


def _extract_pubmed_year(article: ET.Element) -> str:
    year = article.findtext(".//Article/Journal/JournalIssue/PubDate/Year")
    if year:
        return year

    medline_date = article.findtext(".//Article/Journal/JournalIssue/PubDate/MedlineDate", "")
    match = re.search(r"(19|20)\d{2}", medline_date)
    if match:
        return match.group(0)

    return "N/A"


def _extract_pubmed_authors(article: ET.Element) -> str:
    authors = []
    for author in article.findall(".//Article/AuthorList/Author"):
        collective = author.findtext("CollectiveName")
        if collective:
            authors.append(collective)
            continue

        fore_name = author.findtext("ForeName", "").strip()
        last_name = author.findtext("LastName", "").strip()
        full_name = f"{fore_name} {last_name}".strip()
        if full_name:
            authors.append(full_name)

    if not authors:
        return "Unknown"

    if len(authors) <= 3:
        return ", ".join(authors)
    return f"{authors[0]} et al."


def _extract_pubmed_abstract(article: ET.Element) -> str:
    parts = []
    for node in article.findall(".//Article/Abstract/AbstractText"):
        text = "".join(node.itertext()).strip()
        if not text:
            continue
        label = node.attrib.get("Label", "").strip()
        if label:
            parts.append(f"{label}: {text}")
        else:
            parts.append(text)

    return "\n".join(parts).strip()


def fetch_pubmed_papers(query: str, limit: int = 5) -> list[dict]:
    """Fetch papers from PubMed using NCBI E-utilities."""
    api_key = os.getenv("NCBI_API_KEY")

    all_papers: list[dict] = []
    candidates = _build_query_candidates(query)
    target_pool = _source_pool_target(limit)
    request_limit = min(100, max(target_pool, 20))

    for candidate_query in candidates:
        search_params = {
            "db": "pubmed",
            "term": candidate_query,
            "retmode": "json",
            "sort": "relevance",
            "retmax": request_limit,
        }
        if api_key:
            search_params["api_key"] = api_key

        try:
            search_res = requests.get(PUBMED_ESEARCH_API, params=search_params, timeout=15)
            search_res.raise_for_status()
            id_list = search_res.json().get("esearchresult", {}).get("idlist", [])
        except requests.RequestException as e:
            print(f"❌ PubMed search API error for query '{candidate_query}': {e}")
            continue

        if not id_list:
            continue

        fetch_params = {
            "db": "pubmed",
            "id": ",".join(id_list),
            "rettype": "abstract",
            "retmode": "xml",
        }
        if api_key:
            fetch_params["api_key"] = api_key

        try:
            fetch_res = requests.get(PUBMED_EFETCH_API, params=fetch_params, timeout=20)
            fetch_res.raise_for_status()
            root = ET.fromstring(fetch_res.content)
        except requests.RequestException as e:
            print(f"❌ PubMed fetch API error for query '{candidate_query}': {e}")
            continue
        except ET.ParseError as e:
            print(f"❌ PubMed XML parse error for query '{candidate_query}': {e}")
            continue

        for article in root.findall(".//PubmedArticle"):
            title = article.findtext(".//Article/ArticleTitle", default="Untitled")
            abstract = _extract_pubmed_abstract(article)
            if not abstract:
                continue

            if _is_retracted(title, abstract):
                continue

            pmid = article.findtext(".//MedlineCitation/PMID", default="")
            url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else "https://pubmed.ncbi.nlm.nih.gov/"

            all_papers.append(
                {
                    "title": title,
                    "authors": _extract_pubmed_authors(article),
                    "abstract": abstract,
                    "url": url,
                    "year": _extract_pubmed_year(article),
                    "citation_count": 0,
                    "source": "pubmed",
                }
            )

        all_papers = _dedupe_by_title(all_papers)
        if len(all_papers) >= target_pool:
            break

    print(f"🧪 PubMed: fetched {len(all_papers)} papers")
    return all_papers[:target_pool]


def _europe_pmc_result_url(record: dict) -> str:
    source = (record.get("source") or "").strip()
    record_id = (record.get("id") or "").strip()
    doi = (record.get("doi") or "").strip()

    if source and record_id:
        return f"https://europepmc.org/article/{source}/{record_id}"
    if doi:
        return f"https://doi.org/{doi}"
    return "https://europepmc.org/"


def fetch_europe_pmc_papers(query: str, limit: int = 5) -> list[dict]:
    """Fetch papers from Europe PMC REST API (JSON)."""
    all_papers: list[dict] = []
    candidates = _build_query_candidates(query)
    target_pool = _source_pool_target(limit)
    request_limit = min(100, max(target_pool, 20))

    for candidate_query in candidates:
        params = {
            "query": candidate_query,
            "format": "json",
            "pageSize": request_limit,
            "resultType": "core",
        }

        try:
            response = requests.get(EUROPE_PMC_SEARCH_API, params=params, timeout=20)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            print(f"❌ Europe PMC API error for query '{candidate_query}': {e}")
            continue
        except ValueError as e:
            print(f"❌ Europe PMC JSON parse error for query '{candidate_query}': {e}")
            continue

        records = data.get("resultList", {}).get("result", [])

        for record in records:
            abstract = (record.get("abstractText") or "").strip()
            if not abstract:
                continue

            title = (record.get("title") or "Untitled").strip()
            if _is_retracted(title, abstract):
                continue

            authors = (record.get("authorString") or "Unknown").strip()
            citation_count = _safe_int(record.get("citedByCount"))
            year = str(record.get("pubYear") or "N/A")

            all_papers.append(
                {
                    "title": title,
                    "authors": authors,
                    "abstract": abstract,
                    "url": _europe_pmc_result_url(record),
                    "year": year,
                    "citation_count": citation_count,
                    "source": "europe_pmc",
                }
            )

        all_papers = _dedupe_by_title(all_papers)
        if len(all_papers) >= target_pool:
            break

    print(f"🌍 Europe PMC: fetched {len(all_papers)} papers")
    return all_papers[:target_pool]


def _crossref_headers() -> dict[str, str]:
    contact_email = (os.getenv("CROSSREF_EMAIL") or os.getenv("OPENRESEARCH_CONTACT_EMAIL") or "").strip()
    if contact_email:
        return {"User-Agent": f"OpenResearch/1.0 (mailto:{contact_email})"}
    return {"User-Agent": "OpenResearch/1.0"}


def _crossref_year(item: dict) -> str:
    for field in ("issued", "published-print", "published-online", "created"):
        date_parts = item.get(field, {}).get("date-parts", [])
        if date_parts and date_parts[0]:
            return str(date_parts[0][0])
    return "N/A"


def _crossref_authors(item: dict) -> str:
    authors = []
    for author in item.get("author", []):
        given = (author.get("given") or "").strip()
        family = (author.get("family") or "").strip()
        full_name = f"{given} {family}".strip()
        if full_name:
            authors.append(full_name)

    if not authors:
        return "Unknown"
    if len(authors) <= 3:
        return ", ".join(authors)
    return f"{authors[0]} et al."


def _crossref_clean_abstract(text: str) -> str:
    if not text:
        return ""
    normalized = unescape(text)
    normalized = re.sub(r"<jats:[^>]+>", "", normalized)
    normalized = re.sub(r"</jats:[^>]+>", "", normalized)
    normalized = re.sub(r"<[^>]+>", " ", normalized)
    return " ".join(normalized.split()).strip()


def fetch_crossref_papers(query: str, limit: int = 5) -> list[dict]:
    """Fetch papers from Crossref REST API."""
    all_papers: list[dict] = []
    candidates = _build_query_candidates(query)
    target_pool = _source_pool_target(limit)
    request_limit = min(100, max(target_pool, 20))
    headers = _crossref_headers()

    for candidate_query in candidates:
        params = {
            "query.bibliographic": candidate_query,
            "rows": request_limit,
            "select": "DOI,title,author,issued,published-print,published-online,created,is-referenced-by-count,abstract,URL",
        }

        try:
            response = requests.get(CROSSREF_WORKS_API, params=params, headers=headers, timeout=25)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            print(f"❌ Crossref API error for query '{candidate_query}': {e}")
            continue
        except ValueError as e:
            print(f"❌ Crossref JSON parse error for query '{candidate_query}': {e}")
            continue

        items = data.get("message", {}).get("items", [])

        for item in items:
            title_list = item.get("title") or []
            title = (title_list[0] if title_list else "Untitled").strip()
            abstract = _crossref_clean_abstract(item.get("abstract") or "")
            if not abstract:
                continue

            if _is_retracted(title, abstract):
                continue

            doi = (item.get("DOI") or "").strip()
            url = (item.get("URL") or "").strip()
            if not url and doi:
                url = f"https://doi.org/{doi}"

            all_papers.append(
                {
                    "title": title,
                    "authors": _crossref_authors(item),
                    "abstract": abstract,
                    "url": url or "https://www.crossref.org/",
                    "year": _crossref_year(item),
                    "citation_count": _safe_int(item.get("is-referenced-by-count")),
                    "source": "crossref",
                }
            )

        all_papers = _dedupe_by_title(all_papers)
        if len(all_papers) >= target_pool:
            break

    print(f"🧷 Crossref: fetched {len(all_papers)} papers")
    return all_papers[:target_pool]


def _openalex_authors(authorships: list) -> str:
    authors = []
    for authorship in authorships:
        author = authorship.get("author", {})
        name = (author.get("display_name") or "").strip()
        if name:
            authors.append(name)

    if not authors:
        return "Unknown"
    if len(authors) <= 3:
        return ", ".join(authors)
    return f"{authors[0]} et al."


def _openalex_abstract(inverted_index: dict | None) -> str:
    """Reconstruct abstract from OpenAlex inverted index format."""
    if not inverted_index:
        return ""
    try:
        word_positions: list[tuple[int, str]] = []
        for word, positions in inverted_index.items():
            for pos in positions:
                word_positions.append((pos, word))
        word_positions.sort(key=lambda x: x[0])
        return " ".join(word for _, word in word_positions)
    except Exception:
        return ""


def _openalex_year(work: dict) -> str:
    year = work.get("publication_year")
    return str(year) if year else "N/A"


def _openalex_url(work: dict) -> str:
    """Get the best available URL for an OpenAlex work."""
    # Prefer open access URL
    oa = work.get("open_access", {})
    oa_url = (oa.get("oa_url") or "").strip()
    if oa_url:
        return oa_url

    # Fall back to DOI
    doi = (work.get("doi") or "").strip()
    if doi:
        return doi if doi.startswith("http") else f"https://doi.org/{doi}"

    # Fall back to OpenAlex landing page
    openalex_id = (work.get("id") or "").strip()
    if openalex_id:
        return openalex_id

    return "https://openalex.org/"


def fetch_openalex_papers(query: str, limit: int = 5) -> list[dict]:
    """Fetch papers from OpenAlex REST API (free, CC0 data)."""
    all_papers: list[dict] = []
    candidates = _build_query_candidates(query)
    target_pool = _source_pool_target(limit)
    request_limit = min(100, max(target_pool, 20))

    # OpenAlex polite pool: provide an email for faster rate limits
    contact_email = (
        os.getenv("OPENALEX_EMAIL")
        or os.getenv("CROSSREF_EMAIL")
        or os.getenv("OPENRESEARCH_CONTACT_EMAIL")
        or ""
    ).strip()

    for candidate_query in candidates:
        params = {
            "search": candidate_query,
            "per_page": request_limit,
            "select": "id,doi,title,authorships,publication_year,cited_by_count,abstract_inverted_index,open_access,type",
        }
        if contact_email:
            params["mailto"] = contact_email

        try:
            response = requests.get(OPENALEX_WORKS_API, params=params, timeout=20)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            print(f"❌ OpenAlex API error for query '{candidate_query}': {e}")
            continue
        except ValueError as e:
            print(f"❌ OpenAlex JSON parse error for query '{candidate_query}': {e}")
            continue

        results = data.get("results", [])

        for work in results:
            abstract = _openalex_abstract(work.get("abstract_inverted_index"))
            if not abstract:
                continue

            title = (work.get("title") or "Untitled").strip()
            if _is_retracted(title, abstract):
                continue

            all_papers.append(
                {
                    "title": title,
                    "authors": _openalex_authors(work.get("authorships", [])),
                    "abstract": abstract,
                    "url": _openalex_url(work),
                    "year": _openalex_year(work),
                    "citation_count": _safe_int(work.get("cited_by_count")),
                    "source": "openalex",
                }
            )

        all_papers = _dedupe_by_title(all_papers)
        if len(all_papers) >= target_pool:
            break

    print(f"🔬 OpenAlex: fetched {len(all_papers)} papers")
    return all_papers[:target_pool]


def _merge_rank_dedupe(papers: list[dict], limit: int) -> list[dict]:
    ranked = sorted(papers, key=_rank_key, reverse=True)
    deduped = []
    seen_titles = set()

    for paper in ranked:
        title_key = _normalize_title(paper.get("title", ""))
        if title_key and title_key in seen_titles:
            continue
        if title_key:
            seen_titles.add(title_key)
        deduped.append(paper)

        if len(deduped) >= limit:
            break

    return deduped


def _merge_rank_dedupe_with_query(papers: list[dict], limit: int, query: str) -> list[dict]:
    ranked = _dedupe_by_title_with_query(papers, query)

    by_source: dict[str, list[dict]] = {
        "semantic_scholar": [],
        "pubmed": [],
        "europe_pmc": [],
        "crossref": [],
        "openalex": [],
    }
    for paper in ranked:
        src = paper.get("source")
        if src in by_source:
            by_source[src].append(paper)

    selected: list[dict] = []
    selected_titles: set[str] = set()
    ordered_sources = ("semantic_scholar", "pubmed", "europe_pmc", "crossref", "openalex")

    active_source_count = sum(1 for src in ordered_sources if by_source[src])
    per_source_seed = 2 if active_source_count > 0 and limit >= active_source_count * 2 else 1

    for src in ordered_sources:
        if not by_source[src] or len(selected) >= limit:
            continue
        taken = 0
        for paper in by_source[src]:
            if len(selected) >= limit or taken >= per_source_seed:
                break
            title_key = _normalize_title(paper.get("title", ""))
            if title_key and title_key in selected_titles:
                continue
            selected.append(paper)
            taken += 1
            if title_key:
                selected_titles.add(title_key)

    for paper in ranked:
        if len(selected) >= limit:
            break
        title_key = _normalize_title(paper.get("title", ""))
        if title_key and title_key in selected_titles:
            continue
        selected.append(paper)
        if title_key:
            selected_titles.add(title_key)

    return selected[:limit]


def fetch_papers(query: str, limit: int = 5) -> tuple[list[dict], dict[str, int | bool]]:
    """
    Fetch academic papers from Semantic Scholar, PubMed, Europe PMC, Crossref, and OpenAlex
    in parallel, then merge, dedupe, rank, and cap to the requested limit.
    """
    source_limit = _source_pool_target(limit)

    with ThreadPoolExecutor(max_workers=5) as executor:
        semantic_future = executor.submit(fetch_semantic_papers, query, source_limit)
        pubmed_future = executor.submit(fetch_pubmed_papers, query, source_limit)
        europe_pmc_future = executor.submit(fetch_europe_pmc_papers, query, source_limit)
        crossref_future = executor.submit(fetch_crossref_papers, query, source_limit)
        openalex_future = executor.submit(fetch_openalex_papers, query, source_limit)

        try:
            semantic_papers = semantic_future.result()
        except Exception as e:
            print(f"❌ Semantic Scholar pipeline error: {e}")
            semantic_papers = []

        try:
            pubmed_papers = pubmed_future.result()
        except Exception as e:
            print(f"❌ PubMed pipeline error: {e}")
            pubmed_papers = []

        try:
            europe_pmc_papers = europe_pmc_future.result()
        except Exception as e:
            print(f"❌ Europe PMC pipeline error: {e}")
            europe_pmc_papers = []

        try:
            crossref_papers = crossref_future.result()
        except Exception as e:
            print(f"❌ Crossref pipeline error: {e}")
            crossref_papers = []

        try:
            openalex_papers = openalex_future.result()
        except Exception as e:
            print(f"❌ OpenAlex pipeline error: {e}")
            openalex_papers = []

    combined = semantic_papers + pubmed_papers + europe_pmc_papers + crossref_papers + openalex_papers
    final_papers = _merge_rank_dedupe_with_query(combined, limit, query)
    sources_with_hits = sum(
        1
        for count in (len(semantic_papers), len(pubmed_papers), len(europe_pmc_papers), len(crossref_papers), len(openalex_papers))
        if count > 0
    )
    source_summary: dict[str, int | bool] = {
        "semantic_scholar": len(semantic_papers),
        "pubmed": len(pubmed_papers),
        "europe_pmc": len(europe_pmc_papers),
        "crossref": len(crossref_papers),
        "openalex": len(openalex_papers),
        "both_sources_used": sources_with_hits >= 2,
    }

    print(
        f"📚 Combined fetched {len(combined)} papers "
        f"(Semantic Scholar={len(semantic_papers)}, PubMed={len(pubmed_papers)}, "
        f"Europe PMC={len(europe_pmc_papers)}, Crossref={len(crossref_papers)}, "
        f"OpenAlex={len(openalex_papers)}), "
        f"returning {len(final_papers)}"
    )
    return final_papers, source_summary


# ── Quick test ────────────────────────────────────────────────────────
if __name__ == "__main__":
    from dotenv import load_dotenv

    env_path = Path(__file__).resolve().parent / ".env"
    load_dotenv(dotenv_path=env_path)
    results, summary = fetch_papers("How does machine learning improve medical imaging?", limit=5)
    print(f"Source summary: {summary}")
    for i, p in enumerate(results, 1):
        print(f"\n[{i}] {p['title']}")
        print(f"    Authors: {p['authors']}")
        print(f"    Year: {p['year']}  |  Citations: {p['citation_count']}")
        print(f"    Abstract: {p['abstract'][:120]}...")
        print(f"    URL: {p['url']}")
