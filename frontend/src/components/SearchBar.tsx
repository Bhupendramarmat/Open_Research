import { useState } from "react";
import { Search, ArrowRight, Loader2 } from "lucide-react";

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
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto animate-fade-up">
      <div
        className={`
          card-glass p-2 flex items-center gap-2
          transition-all duration-500
          ${isFocused ? "ring-2 ring-primary/40 shadow-lg" : ""}
          ${isFocused ? "scale-[1.01]" : "scale-100"}
        `}
        style={isFocused ? { boxShadow: "var(--shadow-glow)" } : {}}
      >
        <Search className="ml-3 h-5 w-5 text-muted-foreground shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Ask any scientific or academic question..."
          className="flex-1 bg-transparent border-none outline-none py-3 px-2 text-foreground placeholder:text-muted-foreground text-base"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="btn-primary-glow shrink-0 flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching…
            </>
          ) : (
            <>
              Search
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default SearchBar;
