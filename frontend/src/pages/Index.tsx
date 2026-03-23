import { useState, useCallback } from "react";
import SearchBar from "@/components/SearchBar";
import LoadingPipeline from "@/components/LoadingPipeline";
import AnswerDisplay from "@/components/AnswerDisplay";
import SourcePapers from "@/components/SourcePapers";
import Sidebar from "@/components/Sidebar";
import { Moon, Sun, GraduationCap, Sparkles, BookOpen, Cpu, Database, BrainCircuit } from "lucide-react";
import { toast } from "sonner";

type AppState = "idle" | "loading" | "results";
const DEFAULT_NUM_PAPERS = 20;
const SEARCH_TIMEOUT_MS = 170000;

const SUGGESTED_QUERIES = [
  "How does machine learning improve medical imaging?",
  "What are the applications of GNNs in drug discovery?",
  "How do transformers work in natural language processing?",
  "What is the impact of climate change on biodiversity?",
];

const Index = () => {
  const [state, setState] = useState<AppState>("idle");
  const [isDark, setIsDark] = useState(false);
  const [answer, setAnswer] = useState<string>("");
  const [papers, setPapers] = useState<any[]>([]);
  const [sourceSummary, setSourceSummary] = useState<any | null>(null);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  const handleSearch = async (query: string) => {
    setState("loading");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    try {
      const res = await fetch("http://localhost:8000/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          query,
          num_papers: DEFAULT_NUM_PAPERS,
          year_range: "2018-2025",
          peer_reviewed_only: true,
        }),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to fetch research data");
      }
      
      const data = await res.json();
      setAnswer(data.answer);
      setPapers(data.papers);
      setSourceSummary(data.source_summary ?? null);
      setState("results");
    } catch (err: any) {
      console.error(err);
      if (err?.name === "AbortError") {
        toast.error("Search timed out after 170 seconds. Please try a shorter query.");
      } else {
        toast.error(err.message || "An error occurred fetching results");
      }
      setState("idle");
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const handleSuggestionClick = (query: string) => {
    handleSearch(query);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20 blur-3xl animate-float"
          style={{ background: "hsl(var(--primary) / 0.3)" }}
        />
        <div
          className="absolute top-1/2 -left-32 w-72 h-72 rounded-full opacity-15 blur-3xl animate-float delay-300"
          style={{ background: "hsl(210, 80%, 50%, 0.3)" }}
        />
        <div
          className="absolute -bottom-20 right-1/4 w-80 h-80 rounded-full opacity-10 blur-3xl animate-float delay-500"
          style={{ background: "hsl(260, 70%, 55%, 0.3)" }}
        />
      </div>

      {/* ─── Top Navigation Bar ─── */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center animate-glow-pulse">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-lg tracking-tight">OpenResearch</span>
        </div>

        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-secondary hover:bg-accent transition-all duration-300 hover:scale-105"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="h-4 w-4 text-foreground" /> : <Moon className="h-4 w-4 text-foreground" />}
        </button>
      </nav>

      {/* ─── Hero Section ─── */}
      <header className="relative z-10 pt-8 pb-6 text-center px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-medium mb-6 animate-fade-up">
          <Sparkles className="h-3 w-3" />
          Powered by Gemini 1.5 Flash + Semantic Scholar
        </div>

        <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif tracking-tight animate-fade-up delay-100">
          <span className="text-gradient">OpenResearch</span>
          <span className="ml-3">🔍</span>
        </h1>

        <p className="mt-4 text-muted-foreground max-w-xl mx-auto text-base md:text-lg leading-relaxed animate-fade-up delay-200">
          Your AI-Powered Academic Assistant. Ask any scientific question and get
          answers grounded in <strong className="text-foreground">real, peer-reviewed papers</strong>.
        </p>

        {/* Tech stack pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6 animate-fade-up delay-300">
          <span className="badge-tech"><BookOpen className="h-3 w-3" /> Semantic Scholar</span>
          <span className="badge-tech"><Cpu className="h-3 w-3" /> HuggingFace</span>
          <span className="badge-tech"><Database className="h-3 w-3" /> ChromaDB</span>
          <span className="badge-tech"><BrainCircuit className="h-3 w-3" /> Gemini AI</span>
        </div>
      </header>

      {/* ─── Main Layout ─── */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 pb-20 flex gap-8">
        {/* Content Column */}
        <div className="flex-1 min-w-0 space-y-6">
          <SearchBar onSearch={handleSearch} isLoading={state === "loading"} />

          {state === "loading" && <LoadingPipeline />}

          {state === "results" && (
            <>
              <AnswerDisplay answer={answer} />
              <SourcePapers papers={papers} sourceSummary={sourceSummary} />
            </>
          )}

          {state === "idle" && (
            <div className="text-center pt-10 animate-fade-up delay-400">
              <p className="text-muted-foreground text-sm mb-4 font-medium uppercase tracking-wider">
                Try a question
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
                {SUGGESTED_QUERIES.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(q)}
                    className="px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground
                               bg-card border border-border/50 hover:border-primary/30
                               transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 text-left"
                  >
                    <span className="text-primary mr-1.5">→</span>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <Sidebar />
      </div>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 border-t border-border/50 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          Built with ❤️ — Zero running cost · All answers cited from real research
        </p>
      </footer>
    </div>
  );
};

export default Index;
