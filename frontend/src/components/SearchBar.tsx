import { useState } from "react";
import { Search, ArrowRight, Loader2, Sparkles } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

const SearchBar = ({ onSearch, isLoading }: SearchBarProps) => {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto animate-slide-up-elastic delay-200">
      <div className={`search-ring ${isFocused ? "focused" : ""}`}>
        <div
          className={`
            card-glass p-2 flex items-center gap-2
            transition-all duration-500
            ${isFocused ? "shadow-lg" : ""}
          `}
          style={isFocused ? { boxShadow: "var(--shadow-glow)" } : {}}
        >
          <div className="ml-3 shrink-0 relative">
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
            placeholder="Ask any scientific or academic question..."
            className="flex-1 bg-transparent border-none outline-none py-3.5 px-2 text-foreground placeholder:text-muted-foreground/70 text-[15px]"
            disabled={isLoading}
          />
          <button
            type="submit"
            id="search-submit"
            disabled={isLoading || !query.trim()}
            className="btn-primary-glow shrink-0 flex items-center gap-2 text-[13px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Searching…</span>
              </>
            ) : (
              <>
                <span>Search</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};

export default SearchBar;
