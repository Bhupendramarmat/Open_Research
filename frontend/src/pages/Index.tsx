import { useEffect, useState } from "react";
import SearchBar from "@/components/SearchBar";
import AnswerDisplay from "@/components/AnswerDisplay";
import SourcePapers from "@/components/SourcePapers";
import MeshBackground from "@/components/MeshBackground";
import ResearchSidebar from "@/components/ResearchSidebar";
import { AiSearchLoadingPanel, ReferencesLoadingPanel } from "@/components/SearchLoadingPanels";
import { cn } from "@/lib/utils";
import { searchPapers } from "@/lib/api";
import { Moon, Sun, GraduationCap, Sparkles, ArrowUpRight, Search as SearchIcon } from "lucide-react";
import { toast } from "sonner";

type AppState = "idle" | "loading" | "results";
type SidebarView = "home" | "history";
type HistoryEntry = {
  id: string;
  query: string;
  timestamp: number;
  runs: number;
};
const DEFAULT_NUM_PAPERS = 20;
const SEARCH_TIMEOUT_MS = 300000;
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

const formatRelativeTime = (timestamp: number) => {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.max(1, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const Index = () => {
  const [state, setState] = useState<AppState>("idle");
  const [isDark, setIsDark] = useState(false);
  const [answer, setAnswer] = useState<string>("");
  const [papers, setPapers] = useState<any[]>([]);
  const [sourceSummary, setSourceSummary] = useState<any | null>(null);
  const [refinedQuery, setRefinedQuery] = useState<string>("");
  const [pendingQuery, setPendingQuery] = useState<string>("");
  const [searchHistory, setSearchHistory] = useState<HistoryEntry[]>([]);
  const [typingText, setTypingText] = useState("");
  const [typingIndex, setTypingIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<SidebarView>("home");
  const [historyQueryFilter, setHistoryQueryFilter] = useState("");
  const numPapers = DEFAULT_NUM_PAPERS;
  const yearRange = "2018-2025";
  const peerReviewedOnly = true;

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
        const now = Date.now();
        const entries = parsed
          .map((item, index): HistoryEntry | null => {
            if (typeof item === "string") {
              const query = item.trim();
              if (!query) return null;
              return {
                id: `${query.toLowerCase()}-${now - index}`,
                query,
                timestamp: now - index * 60000,
                runs: 1,
              };
            }

            if (item && typeof item === "object" && typeof item.query === "string") {
              const query = item.query.trim();
              if (!query) return null;
              return {
                id: typeof item.id === "string" ? item.id : `${query.toLowerCase()}-${now - index}`,
                query,
                timestamp: typeof item.timestamp === "number" ? item.timestamp : now - index * 60000,
                runs: typeof item.runs === "number" && item.runs > 0 ? item.runs : 1,
              };
            }

            return null;
          })
          .filter((entry): entry is HistoryEntry => Boolean(entry));

        setSearchHistory(entries);
      }
    } catch {
      setSearchHistory([]);
    }
  }, []);

  const updateSearchHistory = (query: string) => {
    const normalized = query.trim();
    if (!normalized) return;

    setSearchHistory((prev) => {
      const existing = prev.find((item) => item.query.toLowerCase() === normalized.toLowerCase());
      const deduped = prev.filter((item) => item.query.toLowerCase() !== normalized.toLowerCase());
      const nextEntry: HistoryEntry = {
        id: existing?.id ?? `${normalized.toLowerCase()}-${Date.now()}`,
        query: normalized,
        timestamp: Date.now(),
        runs: existing ? existing.runs + 1 : 1,
      };
      const next = [nextEntry, ...deduped].slice(0, MAX_SEARCH_HISTORY);
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

  const resetToHome = () => {
    setActiveView("home");
    setState("idle");
    setAnswer("");
    setPapers([]);
    setSourceSummary(null);
    setRefinedQuery("");
    setPendingQuery("");
  };

  const openHistory = () => {
    setActiveView("history");
    setState("idle");
    setHistoryQueryFilter("");
  };

  const filteredHistory = searchHistory.filter((item) =>
    item.query.toLowerCase().includes(historyQueryFilter.trim().toLowerCase())
  );

  const handleSearch = async (query: string) => {
    setActiveView("home");
    updateSearchHistory(query);
    setPendingQuery(query);
    setRefinedQuery("");
    setAnswer("");
    setPapers([]);
    setSourceSummary(null);
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
      setRefinedQuery(data.refined_query ?? "");
      setState("results");
    } catch (err: any) {
      console.error(err);
      if (err?.name === "AbortError") {
        toast.error("Search timed out after 5 minutes. Please try a shorter query.");
      } else {
        toast.error(err.message || "An error occurred fetching results");
      }
      setState("idle");
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const showSplitWorkspace = activeView === "home" && (state === "results" || state === "loading");

  return (
    <div className={cn("bg-background relative lg:pl-[150px]", sidebarOpen && "lg:pl-[300px]", showSplitWorkspace ? "h-screen overflow-hidden flex flex-col" : "min-h-screen overflow-hidden")}>
      <MeshBackground />
      <ResearchSidebar
        onNewThread={resetToHome}
        onHome={resetToHome}
        onHistory={openHistory}
        onSelectRecent={handleSearch}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        activeTab={activeView}
        recentItems={searchHistory}
      />

      {/* ─── Top Navigation Bar ─── */}
      {activeView !== "history" && (
        <nav className={cn("relative z-20 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 mx-auto", showSplitWorkspace ? "max-w-[1600px] w-full shrink-0" : "max-w-6xl")} id="main-nav">
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
      )}

      {showSplitWorkspace ? (
        <main className="relative z-10 flex-1 min-h-0 px-2 sm:px-4 pb-2 sm:pb-4" id="main-content">
          <div className="h-full max-w-[1650px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] gap-3 sm:gap-4">
            <section className="min-h-0 rounded-2xl border border-border/50 bg-card/55 backdrop-blur-md overflow-hidden flex flex-col">
              <div className="border-b border-border/50 px-3 sm:px-4 py-3 sm:py-4 bg-background/70 shrink-0">
                <SearchBar onSearch={handleSearch} isLoading={state === "loading"} className="max-w-none mx-0 animate-none delay-0" />
                {state === "loading" && (pendingQuery || refinedQuery) && (
                  <p className="text-xs sm:text-sm text-muted-foreground mt-2 px-1">
                    Refining query: <span className="text-foreground font-medium">{refinedQuery || pendingQuery}</span>
                  </p>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto split-pane-scroll px-3 sm:px-5 py-4 sm:py-5 space-y-4 sm:space-y-5">
                {state === "results" && searchHistory.length > 0 && (
                  <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                    {searchHistory.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSearch(item.query)}
                        disabled={state === "loading"}
                        className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary transition-all duration-200 disabled:opacity-60 truncate max-w-[220px] shrink-0"
                        title={item.query}
                      >
                        {item.query}
                      </button>
                    ))}
                  </div>
                )}

                {state === "loading" && (
                  <AiSearchLoadingPanel
                    query={pendingQuery || refinedQuery}
                    refinedQuery={refinedQuery}
                    targetIncluded={numPapers}
                  />
                )}

                {state === "results" && (
                  <>
                    <div className="flex items-center justify-between px-1">
                      <h2 className="text-sm sm:text-base font-semibold text-foreground tracking-tight">AI Output</h2>
                    </div>

                    <AnswerDisplay answer={answer} refinedQuery={refinedQuery} className="max-w-none mx-0" />

                    <div className="text-center animate-fade-up">
                      <button
                        onClick={() => setState("idle")}
                        className="text-sm text-primary hover:text-primary/80 font-medium transition-all px-5 py-2.5 rounded-xl hover:bg-accent inline-flex items-center gap-1.5"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                        New Search
                      </button>
                    </div>
                  </>
                )}
              </div>
            </section>

            <section className="min-h-0 rounded-2xl border border-border/50 bg-card/55 backdrop-blur-md overflow-hidden flex flex-col">
              <div className="border-b border-border/50 px-4 sm:px-5 py-4 bg-background/70 flex items-center justify-between shrink-0">
                <h2 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">References</h2>
                <span className="text-xs text-muted-foreground font-medium">
                  {state === "loading" ? "Searching..." : `${papers.length} papers`}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto split-pane-scroll px-3 sm:px-5 py-4 sm:py-5">
                {state === "loading" && <ReferencesLoadingPanel />}
                {state === "results" && (
                  <SourcePapers
                    papers={papers}
                    sourceSummary={sourceSummary}
                    hideHeader
                    className="max-w-none mx-0 p-0 border-0 bg-transparent shadow-none rounded-none animate-none [&:hover]:translate-y-0 [&:hover]:shadow-none"
                  />
                )}
              </div>
            </section>
          </div>
        </main>
      ) : (
        <>
          {activeView === "home" && (
            <>
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
            </>
          )}

          {/* ─── Main Layout ─── */}
          {activeView === "history" ? (
            <section className="relative z-10 px-3 sm:px-5 pb-16" id="history-content">
              <div className="max-w-[1220px] mx-auto border border-border/40 rounded-2xl overflow-hidden bg-card/65 backdrop-blur-sm animate-fade-up">
                <header className="px-5 sm:px-6 py-4 border-b border-border/40 flex items-center justify-between gap-4">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">History</h2>
                  <button
                    type="button"
                    onClick={resetToHome}
                    className="btn-primary-glow px-4 py-2.5 text-sm inline-flex items-center gap-2"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    New Thread
                  </button>
                </header>

                <div className="px-5 sm:px-6 py-5">
                  <div className="relative mb-6">
                    <SearchIcon className="h-5 w-5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={historyQueryFilter}
                      onChange={(e) => setHistoryQueryFilter(e.target.value)}
                      placeholder="Search your past threads..."
                      className="w-full h-12 rounded-xl border border-border/50 bg-card/60 pl-12 pr-4 text-foreground placeholder:text-muted-foreground/80 outline-none focus:ring-2 focus:ring-primary/25"
                    />
                  </div>

                  <div className="border-t border-border/40">
                    {filteredHistory.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground">
                        {searchHistory.length === 0 ? "No history yet." : "No matching history found."}
                      </div>
                    ) : (
                      <>
                        {filteredHistory.map((item) => (
                          <div key={item.id} className="py-5 border-b border-border/30">
                            <button
                              type="button"
                              onClick={() => handleSearch(item.query)}
                              className="text-left w-full"
                            >
                              <p className="text-2xl font-semibold text-foreground hover:text-primary transition-colors truncate" title={item.query}>
                                {item.query}
                              </p>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {formatRelativeTime(item.timestamp)} • {item.runs} {item.runs === 1 ? "query" : "queries"}
                              </p>
                            </button>
                          </div>
                        ))}
                        <p className="text-center text-muted-foreground py-5">No more history to load</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 pb-24 sm:pb-20" id="main-content">
              <div className="flex-1 min-w-0 space-y-4 sm:space-y-6">
                <SearchBar onSearch={handleSearch} isLoading={state === "loading"} />

                {state === "loading" && (pendingQuery || refinedQuery) && (
                  <div className="max-w-2xl mx-auto text-center animate-fade-up">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Refining query: <span className="text-foreground font-medium">{refinedQuery || pendingQuery}</span>
                    </p>
                  </div>
                )}

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
                      {searchHistory.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSearch(item.query)}
                          disabled={state === "loading"}
                          className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary transition-all duration-200 disabled:opacity-60 truncate max-w-[180px] sm:max-w-[200px] shrink-0 sm:shrink"
                          title={item.query}
                        >
                          {item.query}
                        </button>
                      ))}
                    </div>
                  </div>
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
            </div>
          )}

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
        </>
      )}
    </div>
  );
};

export default Index;
