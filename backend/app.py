"""
OpenResearch — AI-Powered Academic Assistant
Main FastAPI backend server.

Exposes REST endpoints for the React frontend to query academic papers
and receive AI-synthesized answers grounded in real research.
"""

import os
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from backend.fetcher import fetch_papers
    from backend.rag_pipeline import process_query
except ModuleNotFoundError:
    # Fallback for running from the backend/ directory.
    from fetcher import fetch_papers
    from rag_pipeline import process_query

# ── Load environment variables ────────────────────────────────────────
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)


# ── Lifespan (startup / shutdown) ─────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run on startup — verify API key is present."""
    if not os.getenv("GOOGLE_API_KEY"):
        print("⚠️  WARNING: GOOGLE_API_KEY not found in .env — Gemini calls will fail.")
    print("🚀 OpenResearch backend is ready.")
    yield
    print("👋 Shutting down OpenResearch backend.")


# ── FastAPI app ───────────────────────────────────────────────────────
app = FastAPI(
    title="OpenResearch API",
    description="RAG-powered academic research assistant",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow the React frontend (dev server on :8080) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response schemas ────────────────────────────────────────
class SearchRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500, description="Academic query")
    num_papers: int = Field(20, ge=1, le=150, description="Number of papers to fetch")
    year_range: str = Field("2018-2025", description="Year range filter")
    peer_reviewed_only: bool = Field(True, description="Filter to peer-reviewed papers only")


class PaperResponse(BaseModel):
    title: str
    authors: str
    abstract: str
    detailed_summary: str
    url: str
    year: str
    source: str


class SourceSummary(BaseModel):
    semantic_scholar: int
    pubmed: int
    europe_pmc: int
    crossref: int
    both_sources_used: bool


class SearchResponse(BaseModel):
    answer: str
    papers: list[PaperResponse]
    query: str
    source_summary: SourceSummary


# ── Endpoints ─────────────────────────────────────────────────────────
@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "OpenResearch API",
        "version": "1.0.0",
    }


@app.post("/api/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    """
    Main search endpoint.
    1. Fetches papers from Semantic Scholar + PubMed
    2. Runs the RAG pipeline (chunk → embed → retrieve → generate)
    3. Returns the AI-synthesized answer + source papers
    """
    try:
        papers, source_summary = fetch_papers(
            query=request.query,
            limit=request.num_papers,
        )

        if not papers:
            raise HTTPException(
                status_code=404,
                detail="No papers found for this query. Try rephrasing.",
            )

        answer, detailed_summaries = process_query(query=request.query, papers=papers)

        return SearchResponse(
            answer=answer,
            papers=[
                PaperResponse(
                    title=p["title"],
                    authors=p["authors"],
                    abstract=p["abstract"],
                    detailed_summary=(detailed_summaries[idx] if idx < len(detailed_summaries) else ""),
                    url=p["url"],
                    year=str(p.get("year", "N/A")),
                    source=str(p.get("source", "unknown")),
                )
                for idx, p in enumerate(papers)
            ],
            query=request.query,
            source_summary=SourceSummary(
                semantic_scholar=int(source_summary.get("semantic_scholar", 0)),
                pubmed=int(source_summary.get("pubmed", 0)),
                europe_pmc=int(source_summary.get("europe_pmc", 0)),
                crossref=int(source_summary.get("crossref", 0)),
                both_sources_used=bool(source_summary.get("both_sources_used", False)),
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
