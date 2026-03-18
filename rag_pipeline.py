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
import uuid

from dotenv import load_dotenv

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough

load_dotenv()

# ── Configuration ─────────────────────────────────────────────────────
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
GEMINI_MODEL = "gemini-2.5-flash"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
TOP_K = 3


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

    # Step 1 — Prepare LangChain Documents
    docs = []
    for idx, paper in enumerate(papers):
        docs.append(Document(
            page_content=paper["abstract"],
            metadata={
                "title": paper["title"],
                "authors": paper["authors"],
                "year": str(paper.get("year", "N/A")),
                "url": paper.get("url", ""),
                "source_index": idx + 1,  # 1-indexed for citations
            }
        ))

    # Step 2 — Split Documents
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " "],
    )
    splits = splitter.split_documents(docs)
    print(f"   📄 Created {len(splits)} text chunks from {len(papers)} papers")

    # Step 3 — Embed + Store in Vector DB + Create Retriever
    embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
    collection_name = f"openresearch_{uuid.uuid4().hex[:8]}"
    
    # We use a purely in-memory vectorstore since we don't need to persist per query
    vectorstore = Chroma.from_documents(
        documents=splits,
        embedding=embeddings,
        collection_name=collection_name
    )
    retriever = vectorstore.as_retriever(search_kwargs={"k": TOP_K})
    print(f"   🔍 Indexed chunks into ChromaDB")

    # Step 4 — Build the prompt
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
    prompt = PromptTemplate.from_template(template)

    # Step 5 — Helper function to inject metadata into prompt context
    def format_docs(retrieved_docs):
        context_block = ""
        for d in retrieved_docs:
            context_block += (
                f"[Source {d.metadata['source_index']}] "
                f"(Paper: \"{d.metadata['title']}\" by {d.metadata['authors']}, Year: {d.metadata['year']}, URL: {d.metadata['url']})\n"
                f"{d.page_content}\n\n"
            )
        return context_block

    # Step 6 — Define the LLM
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not set in .env file")

    llm = ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        google_api_key=api_key,
        temperature=0.3,  # Low temperature for factual accuracy
        max_output_tokens=1024,
    )

    # Step 7 — The magic of LangChain (LCEL) Orchestration!
    rag_chain = (
        {"context": retriever | format_docs, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )

    # Step 8 — Execute the pipeline
    try:
        answer = rag_chain.invoke(query)
        print(f"   ✅ Generated answer ({len(answer)} chars)")
    finally:
        # Cleanup isolated collection to not leak memory
        vectorstore.delete_collection()

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
