"""
OpenResearch — Multi-source Paper Fetcher

Fetches papers in parallel from:
1) Semantic Scholar Academic Graph API
2) PubMed (NCBI E-utilities)

Returns a single merged, deduplicated, ranked list of papers.
"""

import os
import re
import threading
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from collections import Counter

import requests

# ── Constants ─────────────────────────────────────────────────────────
SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1/paper/search"
PUBMED_ESEARCH_API = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_EFETCH_API = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

FIELDS = "title,authors,abstract,url,year,citationCount,openAccessPdf"

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


def _safe_int(value) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


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
    if "low risk" in _normalize_query_text(query).lower() and "low risk" in haystack:
        score += 8
    if "preeclampsia" in _normalize_query_text(query).lower() and "preeclampsia" in haystack:
        score += 10

    for term in query_terms:
        if term in title_text:
            score += 4
        elif term in abstract_text:
            score += 2

    return score


def _is_retracted(title: str, abstract: str) -> bool:
    t = (title or "").lower()
    a = (abstract or "").lower()
    return "retracted" in t or "statement of retraction" in a


def _sort_key_with_query(paper: dict, query: str) -> tuple[int, int, int]:
    return (
        _paper_relevance_score(paper, query),
        _safe_int(paper.get("citation_count")),
        _safe_int(paper.get("year")),
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
    request_limit = min(100, max(limit * 3, 15))

    for candidate_query in candidates:
        params = {
            "query": candidate_query,
            "limit": request_limit,
            "fields": FIELDS,
        }

        try:
            global _last_request_time
            with _s2_lock:
                current_time = time.time()
                time_since_last = current_time - _last_request_time
                if time_since_last < 1.05:
                    time.sleep(1.05 - time_since_last)

                _last_request_time = time.time()
                response = requests.get(SEMANTIC_SCHOLAR_API, headers=headers, params=params, timeout=15)

            response.raise_for_status()
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
        if len(all_papers) >= limit:
            break

    print(f"📚 Semantic Scholar: fetched {len(all_papers)} papers")
    return all_papers[: max(limit * 3, limit)]


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

    for candidate_query in candidates:
        search_params = {
            "db": "pubmed",
            "term": candidate_query,
            "retmode": "json",
            "sort": "relevance",
            "retmax": min(100, max(limit * 3, 15)),
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
        if len(all_papers) >= limit:
            break

    print(f"🧪 PubMed: fetched {len(all_papers)} papers")
    return all_papers[: max(limit * 3, limit)]


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

    by_source: dict[str, list[dict]] = {"semantic_scholar": [], "pubmed": []}
    for paper in ranked:
        src = paper.get("source")
        if src in by_source:
            by_source[src].append(paper)

    selected: list[dict] = []
    selected_titles: set[str] = set()

    for src in ("semantic_scholar", "pubmed"):
        if by_source[src] and len(selected) < limit:
            top_paper = by_source[src][0]
            title_key = _normalize_title(top_paper.get("title", ""))
            if title_key and title_key not in selected_titles:
                selected.append(top_paper)
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
    Fetch academic papers from Semantic Scholar and PubMed in parallel,
    then merge, dedupe, rank, and cap to the requested limit.
    """
    with ThreadPoolExecutor(max_workers=2) as executor:
        semantic_future = executor.submit(fetch_semantic_papers, query, limit)
        pubmed_future = executor.submit(fetch_pubmed_papers, query, limit)

        semantic_papers = semantic_future.result()
        pubmed_papers = pubmed_future.result()

    combined = semantic_papers + pubmed_papers
    final_papers = _merge_rank_dedupe_with_query(combined, limit, query)
    source_summary: dict[str, int | bool] = {
        "semantic_scholar": len(semantic_papers),
        "pubmed": len(pubmed_papers),
        "both_sources_used": len(semantic_papers) > 0 and len(pubmed_papers) > 0,
    }

    print(
        f"📚 Combined fetched {len(combined)} papers "
        f"(Semantic Scholar={len(semantic_papers)}, PubMed={len(pubmed_papers)}), "
        f"returning {len(final_papers)}"
    )
    return final_papers, source_summary


# ── Quick test ────────────────────────────────────────────────────────
if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()
    results, summary = fetch_papers("How does machine learning improve medical imaging?", limit=5)
    print(f"Source summary: {summary}")
    for i, p in enumerate(results, 1):
        print(f"\n[{i}] {p['title']}")
        print(f"    Authors: {p['authors']}")
        print(f"    Year: {p['year']}  |  Citations: {p['citation_count']}")
        print(f"    Abstract: {p['abstract'][:120]}...")
        print(f"    URL: {p['url']}")
