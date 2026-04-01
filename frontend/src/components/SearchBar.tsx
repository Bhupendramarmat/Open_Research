import { useState } from "react";
import { Search, ArrowRight, Loader2, Sparkles } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

const SearchBar = ({ onSearch, isLoading }: SearchBarProps) => {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [filters, setFilters] = useState({
    pro: false,
    deep: true,
    corpus: true,
    sources: false,
    filter: false,
  });

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto animate-slide-up-elastic delay-200">
      <div className={`search-ring ${isFocused ? "focused" : ""}`}>
        <div
          className={`
            card-glass p-1.5 sm:p-2 transition-all duration-500
            ${isFocused ? "shadow-lg" : ""}
          `}
          style={isFocused ? { boxShadow: "var(--shadow-glow)" } : {}}
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="ml-2 sm:ml-3 shrink-0 relative">
              <Search className={`h-5 w-5 transition-colors duration-300 ${isFocused ? "text-primary" : "text-muted-foreground"}`} />
              {isFocused && (
                <div className="absolute inset-0 animate-pulse-dot">
                  <Sparkles className="h-5 w-5 text-primary opacity-50" />
                </div>
              )}
            </div>
            <input
              type="text"
              id="search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask a research question..."
              className="flex-1 bg-transparent border-none outline-none py-3 sm:py-3.5 px-1.5 sm:px-2 text-foreground placeholder:text-muted-foreground/70 text-sm sm:text-[15px]"
              disabled={isLoading}
            />
            <button
              type="submit"
              id="search-submit"
              disabled={isLoading || !query.trim()}
              className="btn-primary-glow shrink-0 flex items-center gap-1.5 sm:gap-2 text-[13px] px-4 sm:px-6 py-2.5 sm:py-3"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Searching…</span>
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Search</span>
                  <span className="sm:hidden">Go</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </div>
          <div className="mt-2 px-2 sm:px-3 pb-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                className="filter-pill"
                data-active={filters.pro}
                onClick={() => toggleFilter("pro")}
              >
                Pro
              </button>
              <button
                type="button"
                className="filter-pill"
                data-active={filters.deep}
                onClick={() => toggleFilter("deep")}
              >
                Deep
              </button>
              <button
                type="button"
                className="filter-pill"
                data-active={filters.corpus}
                onClick={() => toggleFilter("corpus")}
              >
                Corpus
              </button>
              <button
                type="button"
                className="filter-pill"
                data-active={filters.sources}
                onClick={() => toggleFilter("sources")}
              >
                Sources
              </button>
              <button
                type="button"
                className="filter-pill"
                data-active={filters.filter}
                onClick={() => toggleFilter("filter")}
              >
                Filter
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
};

export default SearchBar;
