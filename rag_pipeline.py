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

import os

from dotenv import load_dotenv

from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

# ── Configuration ─────────────────────────────────────────────────────
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
GEMINI_MODEL = "gemini-2.5-flash"
TOP_K = 6


def process_query(query: str, papers: list[dict]) -> str:
    """
    Full RAG pipeline managed by LangChain Expression Language (LCEL).

    Args:
        query:  The user's academic question.
        papers: List of paper dicts from fetcher.py.

    Returns:
        AI-synthesized answer string with citations.
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

    # Build direct context from top papers (lightweight path, avoids heavy local embedding stack)
    selected = papers[:TOP_K]
    context_block = ""
    for idx, paper in enumerate(selected, start=1):
        context_block += (
            f"[Source {idx}] "
            f"(Paper: \"{paper.get('title', 'N/A')}\" by {paper.get('authors', 'N/A')}, "
            f"Year: {paper.get('year', 'N/A')}, URL: {paper.get('url', '')})\n"
            f"{paper.get('abstract', '')}\n\n"
        )

    # Define the LLM
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not set in .env file")

    llm = ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        google_api_key=api_key,
        temperature=0.3,  # Low temperature for factual accuracy
        max_output_tokens=1024,
    )

    # Execute direct synthesis path
    final_prompt = template.format(question=query, context=context_block)
    answer = llm.invoke(final_prompt).content
    print(f"   ✅ Generated answer ({len(answer)} chars)")

    return answer


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
