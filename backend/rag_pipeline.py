"""
OpenResearch — RAG Pipeline (LangChain Orchestrated)

Orchestrates the full Retrieval-Augmented Generation flow:
    1. Base Documents          -> LangChain Document Class
    2. Chunk paper abstracts   -> LangChain RecursiveCharacterTextSplitter
    3. Embed chunks            -> LangChain HuggingFaceEmbeddings (local, free)
    4. Store & retrieve        -> LangChain Chroma (local, free)
    5. Generate answer         -> LCEL Chain tying Retriever, Prompt, and Gemini together

The AI is strictly constrained to answer ONLY using the fetched abstracts,
preventing hallucination.
"""

import json
import logging
import os
import re
import time
from pathlib import Path

from dotenv import load_dotenv
import requests

from langchain_google_genai import ChatGoogleGenerativeAI

logger = logging.getLogger("openresearch.rag")

ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

# ── Configuration ─────────────────────────────────────────────────────
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
QUERY_REFINER_MODEL = os.getenv("QUERY_REFINER_MODEL", GEMINI_MODEL)
TOP_K = 6

MODEL_FALLBACKS = [
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-2.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-2.5-pro",
    "gemini-pro-latest",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash-lite-001",
]

MODELS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"

# ── TTL Cache for model list (R2 fix) ─────────────────────────────────
_MODEL_CACHE_TTL_SECONDS = 1800  # 30 minutes
_model_cache: dict[str, tuple[float, tuple[str, ...]]] = {}


def _list_generate_content_models(api_key: str) -> tuple[str, ...]:
    """Fetch available Gemini models, cached with a 30-minute TTL."""
    if not api_key:
        return tuple()

    now = time.monotonic()
    cached = _model_cache.get(api_key)
    if cached is not None:
        cached_at, cached_result = cached
        if now - cached_at < _MODEL_CACHE_TTL_SECONDS:
            return cached_result

    try:
        response = requests.get(MODELS_ENDPOINT, params={"key": api_key}, timeout=12)
        response.raise_for_status()
        payload = response.json()
    except Exception:
        # On failure, return stale cache if available, else empty
        if cached is not None:
            return cached[1]
        return tuple()

    names: set[str] = set()
    for model in payload.get("models", []):
        methods = model.get("supportedGenerationMethods", [])
        if "generateContent" not in methods:
            continue
        normalized = _normalize_model_name(model.get("name", ""))
        if normalized:
            names.add(normalized)

    result = tuple(sorted(names))
    _model_cache[api_key] = (now, result)
    return result


def _normalize_model_name(model_name: str) -> str:
    if not model_name:
        return ""
    cleaned = model_name.strip()
    return cleaned[len("models/") :] if cleaned.startswith("models/") else cleaned


def _candidate_models(primary: str, *, api_key: str) -> list[str]:
    ordered = [primary] + MODEL_FALLBACKS
    seen = set()
    candidates: list[str] = []
    for raw in ordered:
        model = _normalize_model_name(raw)
        if not model or model in seen:
            continue
        seen.add(model)
        candidates.append(model)

    available = set(_list_generate_content_models(api_key))
    if available:
        filtered = [model for model in candidates if model in available]
        if filtered:
            return filtered

    # If discovery fails, fall back to static list.
    return candidates


def _invoke_with_model_fallback(prompt: str, *, primary_model: str, api_key: str, temperature: float, max_output_tokens: int):
    last_error = None
    preferred_error = None

    for model_name in _candidate_models(primary_model, api_key=api_key):
        llm = ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=api_key,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
        )
        try:
            response = llm.invoke(prompt)
            return response.content, model_name
        except Exception as e:
            last_error = e
            err_text = str(e).lower()

            if any(token in err_text for token in ("resource_exhausted", "429", "quota")):
                preferred_error = preferred_error or e
                continue
            if any(token in err_text for token in ("permission denied", "unauthenticated", "401", "403", "api key")):
                preferred_error = preferred_error or e
                continue
            if "not_found" in err_text or "not found" in err_text:
                continue
            if "supported for generatecontent" in err_text:
                continue
            # For transient or auth issues, retrying model IDs is harmless and may still recover.
            continue

    if preferred_error:
        raise preferred_error
    if last_error:
        raise last_error
    raise RuntimeError("Gemini invocation failed before attempting any model.")


def _build_context_block(selected: list[dict]) -> str:
    context_block = ""
    for idx, paper in enumerate(selected, start=1):
        context_block += (
            f"[Source {idx}] "
            f"(Paper: \"{paper.get('title', 'N/A')}\" by {paper.get('authors', 'N/A')}, "
            f"Year: {paper.get('year', 'N/A')}, URL: {paper.get('url', '')})\n"
            f"{paper.get('abstract', '')}\n\n"
        )
    return context_block


def _fallback_summary(abstract: str) -> str:
    text = (abstract or "").strip()
    if not text:
        return "No abstract available for detailed summary."

    sentences = re.split(r"(?<=[.!?])\s+", text)
    summary = " ".join(sentences[:4]).strip()
    return summary if summary else text[:500]


def _fallback_answer(query: str, papers: list[dict]) -> str:
    if not papers:
        return (
            "No papers were available to synthesize an answer. "
            "Please try a broader query or increase the number of papers."
        )

    top = papers[: min(3, len(papers))]
    lines = [
        f"Gemini is currently unavailable, so this is a fallback synthesis based on retrieved abstracts for: {query}.",
        "",
        "Key points from top papers:",
    ]

    for idx, paper in enumerate(top, start=1):
        abstract = (paper.get("abstract") or "").strip()
        first_sentence = re.split(r"(?<=[.!?])\s+", abstract)[0] if abstract else "No abstract text available."
        lines.append(
            f"[{idx}] {paper.get('title', 'Untitled')} ({paper.get('year', 'N/A')}): {first_sentence}"
        )

    lines.extend(
        [
            "",
            "This fallback output is extractive and does not include deeper LLM interpretation.",
            "Configure a valid GOOGLE_API_KEY to restore full AI synthesis quality.",
        ]
    )

    return "\n".join(lines)


def _extract_json_payload(raw_text: str) -> dict:
    cleaned = (raw_text or "").strip()
    cleaned = re.sub(r"^```json\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if not match:
            return {}
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return {}


def _llm_error_hint(error: Exception) -> str:
    text = str(error).lower()
    if any(token in text for token in ("resource_exhausted", "429", "quota")):
        return "Gemini quota exhausted or rate-limited."
    if any(token in text for token in ("unauthenticated", "permission denied", "401", "403", "api key")):
        return "Gemini API key is invalid or unauthorized."
    if "not_found" in text or "not found" in text:
        return "Configured Gemini model is unavailable for this API key."
    return "Gemini request failed."


def refine_query(query: str) -> str:
    """
    Use Gemini to extract compact academic keywords from a long query.

    Returns the original query if the refiner fails or no API key is configured.
    """
    clean_query = " ".join((query or "").split()).strip()
    if not clean_query:
        return query

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return query

    if len(clean_query.split()) < 8 and len(clean_query) < 60:
        return query

    is_long_query = len(clean_query.split()) >= 14 or len(clean_query) >= 120
    keyword_target = "3 to 4" if is_long_query else "3 to 5"

    prompt = f"""Extract the {keyword_target} most important scientific keywords or short phrases from this query.
Avoid generic study-type words unless they are central to the topic.
Return ONLY valid JSON with this schema:
{{"keywords": ["...", "...", "..."]}}

Query:
{clean_query}
"""

    try:
        raw, used_model = _invoke_with_model_fallback(
            prompt,
            primary_model=QUERY_REFINER_MODEL,
            api_key=api_key,
            temperature=0.2,
            max_output_tokens=256,
        )
        logger.info("Query refiner model: %s", used_model)
    except Exception as e:
        logger.warning("Query refiner failed: %s. Using original query.", e)
        return query

    payload = _extract_json_payload(raw)
    keywords = payload.get("keywords", [])
    if not isinstance(keywords, list):
        return query

    generic_terms = {
        "review",
        "systematic review",
        "meta analysis",
        "meta-analysis",
        "study",
        "trial",
        "randomized",
        "randomised",
        "controlled",
        "double blind",
        "double-blind",
    }

    cleaned_keywords = []
    seen = set()
    for item in keywords:
        if not isinstance(item, str):
            continue
        token = " ".join(item.split()).strip()
        if token.lower() in generic_terms:
            continue
        if not token:
            continue
        key = token.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned_keywords.append(token)

    if not cleaned_keywords:
        return query

    return " ".join(cleaned_keywords[:4] if is_long_query else cleaned_keywords[:5])


def _compute_summary_tokens(paper_count: int) -> int:
    """Scale max_output_tokens based on paper count (R5 fix)."""
    # ~80 tokens per paper summary, with safety margin
    return min(8192, max(1024, paper_count * 100))


def process_query(query: str, papers: list[dict]) -> tuple[str, list[str]]:
    """
    Full RAG pipeline managed by LangChain Expression Language (LCEL).

    Args:
        query:  The user's academic question.
        papers: List of paper dicts from fetcher.py.

    Returns:
        Tuple of:
          1) AI-synthesized answer string with citations.
          2) Per-paper detailed summaries aligned with the input papers list.
    """
    logger.info("Processing query: \"%s\"", query)

    template = """You are OpenResearch, an AI academic research assistant.

STRICT RULES:
1. Answer ONLY using the academic content provided below.
2. Do NOT use any outside knowledge or make up information.
3. Cite your sources using [1], [2], etc. matching the source numbers.
4. If the provided content does not contain enough information, say so honestly.
5. Write in a clear, academic tone with well-structured paragraphs.
6. Format your response with proper paragraphs separated by blank lines.

USER QUESTION:
{question}

ACADEMIC CONTENT:
{context}

Provide a comprehensive, well-cited answer:"""

    selected = papers[:TOP_K]
    context_block = _build_context_block(selected)
    full_context_block = _build_context_block(papers)

    fallback_summaries = [_fallback_summary(paper.get("abstract", "")) for paper in papers]

    # Define the LLM
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        logger.warning("GOOGLE_API_KEY not set. Using fallback synthesis.")
        return _fallback_answer(query, papers), fallback_summaries

    # Execute direct synthesis path
    final_prompt = template.format(question=query, context=context_block)
    try:
        answer, used_model = _invoke_with_model_fallback(
            final_prompt,
            primary_model=GEMINI_MODEL,
            api_key=api_key,
            temperature=0.3,
            max_output_tokens=1024,
        )
        logger.info("Synthesis model: %s", used_model)
        logger.info("Generated answer (%d chars)", len(answer))
    except Exception as e:
        logger.warning("LLM synthesis failed: %s %s. Using fallback synthesis.", _llm_error_hint(e), e)
        return _fallback_answer(query, papers), fallback_summaries

    # Generate one-by-one detailed paper summaries
    summary_max_tokens = _compute_summary_tokens(len(papers))

    summary_prompt = f"""You are an academic research analyst.

Create detailed summaries for EACH source below.

RULES:
1. Return ONLY valid JSON.
2. Output schema:
{{
  \"summaries\": [
    {{\"source_index\": 1, \"detailed_summary\": \"...\"}},
    ...
  ]
}}
3. Include one object per source index.
4. Each detailed_summary should explain objective, approach/method, key findings, and limitations in 90-150 words.
5. Do not invent facts not present in the source text.

USER QUESTION:
{query}

SOURCES:
{full_context_block}
"""

    try:
        summary_response, summary_model = _invoke_with_model_fallback(
            summary_prompt,
            primary_model=GEMINI_MODEL,
            api_key=api_key,
            temperature=0.3,
            max_output_tokens=summary_max_tokens,
        )
        logger.info("Detailed-summary model: %s", summary_model)
    except Exception as e:
        logger.warning("Detailed-summary generation failed: %s %s. Using fallback summaries.", _llm_error_hint(e), e)
        return answer, fallback_summaries
    payload = _extract_json_payload(summary_response)
    summary_by_index: dict[int, str] = {}

    for item in payload.get("summaries", []):
        try:
            source_index = int(item.get("source_index", 0))
        except (TypeError, ValueError):
            continue
        detailed_summary = (item.get("detailed_summary") or "").strip()
        if source_index >= 1 and detailed_summary:
            summary_by_index[source_index] = detailed_summary

    detailed_summaries: list[str] = []
    for idx, paper in enumerate(papers, start=1):
        detailed_summaries.append(summary_by_index.get(idx, _fallback_summary(paper.get("abstract", ""))))

    logger.info("Generated detailed summaries for %d papers", len(detailed_summaries))

    return answer, detailed_summaries


# ── Quick test ────────────────────────────────────────────────────────
if __name__ == "__main__":
    from fetcher import fetch_papers

    test_query = "How does machine learning improve medical imaging?"
    papers = fetch_papers(test_query, limit=5)

    if papers:
        ans = process_query(test_query, papers)
        print("\n" + "=" * 60)
        print("ANSWER:")
        print("=" * 60)
        print(ans)
    else:
        print("No papers found — cannot test pipeline.")
