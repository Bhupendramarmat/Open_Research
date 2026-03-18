# 🎓 OpenResearch — AI-Powered Academic Assistant

> Ask a question, get answers backed by **real, peer-reviewed papers**.

OpenResearch is an end-to-end **Retrieval-Augmented Generation (RAG)** application that fetches real academic papers from [Semantic Scholar](https://www.semanticscholar.org/) and [PubMed](https://pubmed.ncbi.nlm.nih.gov/), processes them through a local vector database, and uses **Google Gemini 1.5 Flash** to synthesize a cited, hallucination-free answer.

**💰 Total running cost: $0** — Built entirely using free APIs and open-source tools.

---

## 🏗️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React + Vite + TypeScript + Tailwind | Premium web interface |
| Backend API | FastAPI + Uvicorn | REST API server |
| Data Source | Semantic Scholar API + PubMed (NCBI E-utilities) | Fetches paper titles, authors, abstracts |
| Embeddings | HuggingFace sentence-transformers (local) | Converts text to vectors |
| Vector DB | ChromaDB (local) | Stores and searches vectorized text |
| LLM | Google Gemini 1.5 Flash (free API) | Reads abstracts, writes cited answers |
| Orchestration | LangChain | Ties DB, API, and LLM together |

---

## 📂 Project Structure

```
OpenResearch/
├── app.py                 # FastAPI backend server
├── fetcher.py             # Semantic Scholar API calls
├── rag_pipeline.py        # ChromaDB + LangChain + Gemini RAG pipeline
├── requirements.txt       # Python dependencies
├── .env.example           # API key template
├── README.md              # This file
└── frontend/              # React frontend
    ├── src/
    │   ├── pages/         # Page components
    │   ├── components/    # UI components
    │   └── ...
    ├── package.json
    └── vite.config.ts
```

---

## 🚀 Quick Start

### 1. Clone & Setup Environment
```bash
cd OpenResearch
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY
```

### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 3. Start the Backend
```bash
python app.py
# Backend runs on http://localhost:8000
```

### 4. Start the Frontend
```bash
cd frontend
npm install
npm run dev
# Frontend runs on http://localhost:8080
```

### 5. Open the App
Navigate to **http://localhost:8080** and start asking questions!

---

## 🔄 How It Works

```
User Query → Semantic Scholar API + PubMed API (parallel) → Paper Abstracts
                                         ↓
                                   LangChain Chunking
                                         ↓
                               HuggingFace Embeddings
                                         ↓
                                 ChromaDB (store + search)
                                         ↓
                               Top-K Relevant Chunks
                                         ↓
                              Gemini 1.5 Flash (generate)
                                         ↓
                              Cited Answer → React UI
```

---

## 🔮 Future Enhancements (v2.0)

- **PDF Uploads**: Upload your own papers for Gemini to analyze
- **Consensus Meter**: Visual indicator showing if papers Agree / Disagree / Inconclusive
- **Export Feature**: Download AI-generated summaries as .docx or .pdf
- **Dark Mode**: Toggle between light and dark themes

---

## 📜 License

MIT License — Built with ❤️ for the academic community.
