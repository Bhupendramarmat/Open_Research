import { useEffect, useState } from "react";
import SearchBar from "@/components/SearchBar";
import LoadingPipeline from "@/components/LoadingPipeline";
import AnswerDisplay from "@/components/AnswerDisplay";
import SourcePapers from "@/components/SourcePapers";
import Sidebar from "@/components/Sidebar";
import MeshBackground from "@/components/MeshBackground";
import { searchPapers } from "@/lib/api";
import { Moon, Sun, GraduationCap, Sparkles, BookOpen, Cpu, Database, BrainCircuit, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

type AppState = "idle" | "loading" | "results";
const DEFAULT_NUM_PAPERS = 150;
const SEARCH_TIMEOUT_MS = 170000;
const SEARCH_HISTORY_KEY = "openresearch_search_history";
const MAX_SEARCH_HISTORY = 10;

const SUGGESTED_QUERIES = [
  "How does machine learning improve medical imaging?",
  "What are the applications of GNNs in drug discovery?",
  "How do transformers work in natural language processing?",
  "What is the impact of climate change on biodiversity?",
];

const TYPING_TEXTS = [
  "How does CRISPR gene editing work?",
  "What are quantum computing applications?",
  "Latest advances in fusion energy?",
  "How do mRNA vaccines function?",
];

const Index = () => {
  const [state, setState] = useState<AppState>("idle");
  const [isDark, setIsDark] = useState(false);
  const [answer, setAnswer] = useState<string>("");
  const [papers, setPapers] = useState<any[]>([]);
  const [sourceSummary, setSourceSummary] = useState<any | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [numPapers, setNumPapers] = useState<number>(DEFAULT_NUM_PAPERS);
  const [yearRange, setYearRange] = useState<string>("2018-2025");
  const [peerReviewedOnly, setPeerReviewedOnly] = useState<boolean>(true);
  const [typingText, setTypingText] = useState("");
  const [typingIndex, setTypingIndex] = useState(0);

  // Initialize dark mode
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  // Typing animation for hero
  useEffect(() => {
    if (state !== "idle") return;

    let charIndex = 0;
    let currentTextIndex = typingIndex;
    let isDeleting = false;
    let timeout: ReturnType<typeof setTimeout>;

    const type = () => {
      const currentText = TYPING_TEXTS[currentTextIndex];

      if (!isDeleting) {
        setTypingText(currentText.slice(0, charIndex + 1));
        charIndex++;
        if (charIndex >= currentText.length) {
          isDeleting = true;
          timeout = setTimeout(type, 2000);
          return;
        }
        timeout = setTimeout(type, 60 + Math.random() * 40);
      } else {
        setTypingText(currentText.slice(0, charIndex - 1));
        charIndex--;
        if (charIndex <= 0) {
          isDeleting = false;
          currentTextIndex = (currentTextIndex + 1) % TYPING_TEXTS.length;
          setTypingIndex(currentTextIndex);
          timeout = setTimeout(type, 400);
          return;
        }
        timeout = setTimeout(type, 30);
      }
    };

    timeout = setTimeout(type, 1000);
    return () => clearTimeout(timeout);
  }, [state, typingIndex]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setSearchHistory(parsed.filter((item): item is string => typeof item === "string"));
      }
    } catch {
      setSearchHistory([]);
    }
  }, []);

  const updateSearchHistory = (query: string) => {
    const normalized = query.trim();
    if (!normalized) return;

    setSearchHistory((prev) => {
      const deduped = prev.filter((item) => item.toLowerCase() !== normalized.toLowerCase());
      const next = [normalized, ...deduped].slice(0, MAX_SEARCH_HISTORY);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  const handleSearch = async (query: string) => {
    updateSearchHistory(query);
    setState("loading");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    try {
      const data = await searchPapers(
        {
          query,
          num_papers: numPapers,
          year_range: yearRange,
          peer_reviewed_only: peerReviewedOnly,
        },
        { signal: controller.signal }
      );
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

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <MeshBackground />

      {/* ─── Top Navigation Bar ─── */}
      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 max-w-6xl mx-auto" id="main-nav">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center animate-glow-pulse"
               style={{ background: "var(--gradient-hero)" }}>
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="font-semibold text-foreground text-base tracking-tight block leading-tight">
              OpenResearch
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight">AI Academic Assistant</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            id="theme-toggle"
            className="p-2.5 rounded-xl bg-secondary/50 hover:bg-secondary transition-all duration-300 hover:scale-105"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-4 w-4 text-foreground" /> : <Moon className="h-4 w-4 text-foreground" />}
          </button>
        </div>
      </nav>

      {/* ─── Hero Section ─── */}
      <header className="relative z-10 pt-4 sm:pt-6 pb-3 sm:pb-4 text-center px-4" id="hero-section">
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium mb-4 sm:mb-6 animate-fade-up"
             style={{ background: "var(--gradient-subtle)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary) / 0.15)" }}>
          <Sparkles className="h-3 w-3" />
          AI-Powered Academic Research Engine
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight animate-fade-up delay-100">
          <span className="text-gradient animate-gradient">Open</span>
          <span className="text-foreground">Research</span>
        </h1>

        <p className="mt-3 sm:mt-4 text-muted-foreground max-w-lg mx-auto text-sm sm:text-base md:text-lg leading-relaxed animate-fade-up delay-200">
          Ask any scientific question, get answers backed by{" "}
          <strong className="text-foreground">real, peer-reviewed papers</strong>.
        </p>

        {/* Typing animation preview */}
        {state === "idle" && (
          <div className="mt-5 animate-fade-up delay-300">
            <span className="text-xs sm:text-sm text-muted-foreground/50 font-mono">
              {typingText}
              <span className="inline-block w-[2px] h-4 bg-primary/60 ml-0.5 align-text-bottom" style={{ animation: "typewriter-blink 1s step-end infinite" }} />
            </span>
          </div>
        )}


      </header>

      {/* ─── Main Layout ─── */}
      <div className="relative z-10 max-w-6xl mx-auto px-3 sm:px-4 pb-24 sm:pb-20 flex gap-8" id="main-content">
        {/* Content Column */}
        <div className="flex-1 min-w-0 space-y-4 sm:space-y-6">
          <SearchBar onSearch={handleSearch} isLoading={state === "loading"} />

          {searchHistory.length > 0 && (
            <div className="card-glass p-3 sm:p-4 max-w-2xl mx-auto animate-fade-up" id="search-history">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-foreground tracking-tight uppercase">Recent Searches</h3>
                <button
                  onClick={clearSearchHistory}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-0.5 rounded-md hover:bg-secondary"
                  disabled={state === "loading"}
                >
                  Clear all
                </button>
              </div>
              <div className="flex flex-nowrap sm:flex-wrap gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                {searchHistory.map((item, index) => (
                  <button
                    key={`${item}-${index}`}
                    onClick={() => handleSearch(item)}
                    disabled={state === "loading"}
                    className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary transition-all duration-200 disabled:opacity-60 truncate max-w-[180px] sm:max-w-[200px] shrink-0 sm:shrink"
                    title={item}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          )}

          {state === "loading" && <LoadingPipeline />}

          {state === "results" && (
            <>
              <AnswerDisplay answer={answer} />
              <SourcePapers papers={papers} sourceSummary={sourceSummary} />
              {/* New search button */}
              <div className="text-center animate-fade-up">
                <button
                  onClick={() => setState("idle")}
                  className="text-sm text-primary hover:text-primary/80 font-medium transition-all px-5 py-2.5 rounded-xl hover:bg-accent flex items-center gap-1.5 mx-auto"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  New Search
                </button>
              </div>
            </>
          )}

          {state === "idle" && (
            <div className="text-center pt-5 sm:pt-8 animate-fade-up delay-500" id="suggestions">
              <p className="text-muted-foreground text-[11px] sm:text-xs mb-3 sm:mb-4 font-medium uppercase tracking-widest">
                Try a question
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 max-w-2xl mx-auto">
                {SUGGESTED_QUERIES.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSearch(q)}
                    className="suggestion-card"
                    style={{ animationDelay: `${0.5 + i * 0.1}s` }}
                  >
                    <span className="text-primary mr-2 font-mono text-xs">→</span>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <Sidebar
          numPapers={numPapers}
          onNumPapersChange={setNumPapers}
          yearRange={yearRange}
          onYearRangeChange={setYearRange}
          peerReviewedOnly={peerReviewedOnly}
          onPeerReviewedOnlyChange={setPeerReviewedOnly}
        />
      </div>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 border-t border-border/30 py-4 sm:py-6 text-center" id="footer">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Built with ❤️ — All answers cited from real, peer-reviewed research
          </p>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground/60 font-mono">v1.0</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="System online" />
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
