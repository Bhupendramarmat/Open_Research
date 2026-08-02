"""
OpenResearch — AI-Powered Academic Assistant
Main FastAPI backend server.

Exposes REST endpoints for the React frontend to query academic papers
and receive AI-synthesized answers grounded in real research.
"""

import logging
import os
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    from backend.fetcher import fetch_papers
    from backend.rag_pipeline import process_query, refine_query
except ModuleNotFoundError:
    # Fallback for running from the backend/ directory.
    from fetcher import fetch_papers
    from rag_pipeline import process_query, refine_query

# ── Logging ───────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("openresearch")

# ── Load environment variables ────────────────────────────────────────
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

# ── Allowed CORS origins ─────────────────────────────────────────────
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:8080,http://localhost:5173,http://localhost:3000",
    ).split(",")
    if origin.strip()
]


# ── Lifespan (startup / shutdown) ─────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run on startup — verify API key is present."""
    if not os.getenv("GOOGLE_API_KEY"):
        logger.warning("GOOGLE_API_KEY not found in .env — Gemini calls will fail.")
    logger.info("OpenResearch backend is ready.")
    yield
    logger.info("Shutting down OpenResearch backend.")


# ── FastAPI app ───────────────────────────────────────────────────────
app = FastAPI(
    title="OpenResearch API",
    description="RAG-powered academic research assistant",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow the React frontend to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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
    openalex: int
    both_sources_used: bool


class SearchResponse(BaseModel):
    answer: str
    papers: list[PaperResponse]
    query: str
    refined_query: str
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
        # Keep the async endpoint responsive by offloading blocking work.
        refined_query = await run_in_threadpool(refine_query, request.query)
        papers, source_summary = await run_in_threadpool(fetch_papers, refined_query, request.num_papers)

        if not papers:
            raise HTTPException(
                status_code=404,
                detail="No papers found for this query. Try rephrasing.",
            )

        answer, detailed_summaries = await run_in_threadpool(process_query, request.query, papers)

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
            refined_query=refined_query,
            source_summary=SourceSummary(
                semantic_scholar=int(source_summary.get("semantic_scholar", 0)),
                pubmed=int(source_summary.get("pubmed", 0)),
                europe_pmc=int(source_summary.get("europe_pmc", 0)),
                crossref=int(source_summary.get("crossref", 0)),
                openalex=int(source_summary.get("openalex", 0)),
                both_sources_used=bool(source_summary.get("both_sources_used", False)),
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Pipeline error during search for query: %s", request.query)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again later.")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
