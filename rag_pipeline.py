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
import os
import re

from dotenv import load_dotenv

from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

# ── Configuration ─────────────────────────────────────────────────────
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
GEMINI_MODEL = "gemini-2.5-flash"
TOP_K = 6


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
    print(f"🔄 Processing query: \"{query}\"")

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
        print("   ⚠️ GOOGLE_API_KEY not set. Using fallback synthesis.")
        return _fallback_answer(query, papers), fallback_summaries

    llm = ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        google_api_key=api_key,
        temperature=0.3,  # Low temperature for factual accuracy
        max_output_tokens=1024,
    )

    # Execute direct synthesis path
    final_prompt = template.format(question=query, context=context_block)
    try:
        answer = llm.invoke(final_prompt).content
        print(f"   ✅ Generated answer ({len(answer)} chars)")
    except Exception as e:
        print(f"   ⚠️ LLM synthesis failed: {e}. Using fallback synthesis.")
        return _fallback_answer(query, papers), fallback_summaries

    # Generate one-by-one detailed paper summaries
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
        summary_response = llm.invoke(summary_prompt).content
    except Exception as e:
        print(f"   ⚠️ Detailed-summary generation failed: {e}. Using fallback summaries.")
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

    print(f"   ✅ Generated detailed summaries for {len(detailed_summaries)} papers")

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
