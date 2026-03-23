import { Info, SlidersHorizontal, Zap, Shield } from "lucide-react";

interface SidebarProps {
  numPapers: number;
  onNumPapersChange: (value: number) => void;
  yearRange: string;
  onYearRangeChange: (value: string) => void;
  peerReviewedOnly: boolean;
  onPeerReviewedOnlyChange: (value: boolean) => void;
}

const Sidebar = ({
  numPapers,
  onNumPapersChange,
  yearRange,
  onYearRangeChange,
  peerReviewedOnly,
  onPeerReviewedOnlyChange,
}: SidebarProps) => {

  return (
    <aside className="w-72 shrink-0 space-y-5 hidden lg:block animate-slide-in-right">
      {/* About card */}
      <div className="card-glass p-5">
        <div className="flex items-center gap-2 mb-3">
          <Info className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">How It Works</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Powered by <strong className="text-foreground">Semantic Scholar + PubMed + Europe PMC + Crossref</strong> for paper retrieval and <strong className="text-foreground">Gemini 1.5 Flash</strong> for AI synthesis. All answers are grounded in real academic abstracts — zero hallucination.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Zap className="h-3 w-3 text-primary" />
            <span>Free APIs</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Shield className="h-3 w-3 text-primary" />
            <span>Cited sources</span>
          </div>
        </div>
      </div>

      {/* Filters card */}
      <div className="card-glass p-5">
        <div className="flex items-center gap-2 mb-4">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Search Filters</h3>
        </div>

        <div className="space-y-5">
          {/* Papers slider */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Papers to analyze
              <span className="ml-1.5 text-foreground font-bold text-sm">{numPapers}</span>
            </label>
            <input
              type="range"
              min={1}
              max={150}
              value={numPapers}
              onChange={(e) => onNumPapersChange(Number(e.target.value))}
              className="w-full accent-primary h-1.5 rounded-full cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>1</span>
              <span>150</span>
            </div>
          </div>

          {/* Year range */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              Year range
            </label>
            <select
              value={yearRange}
              onChange={(e) => onYearRangeChange(e.target.value)}
              className="w-full text-xs bg-secondary rounded-lg px-3 py-2.5 text-secondary-foreground border border-border/50 outline-none focus:ring-2 focus:ring-primary/30 transition-all cursor-pointer"
            >
              <option value="2020-2026">2020 – 2026</option>
              <option value="2018-2026">2018 – 2026</option>
              <option value="2015-2026">2015 – 2026</option>
              <option value="2010-2026">2010 – 2026</option>
            </select>
          </div>

          {/* Peer-reviewed toggle */}
          <label className="flex items-center gap-2.5 text-xs text-muted-foreground cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={peerReviewedOnly}
                onChange={(e) => onPeerReviewedOnlyChange(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-9 h-5 bg-muted rounded-full peer-checked:bg-primary transition-colors duration-300" />
              <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-4 transition-transform duration-300" />
            </div>
            <span className="group-hover:text-foreground transition-colors">
              Peer-reviewed only
            </span>
          </label>
        </div>
      </div>

      {/* Stats card */}
      <div className="card-glass p-5">
        <h3 className="font-semibold text-sm text-foreground mb-3">Quick Stats</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Database</span>
            <span className="text-foreground font-medium">200M+ papers</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">AI Model</span>
            <span className="text-foreground font-medium">Gemini 1.5 Flash</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Cost</span>
            <span className="text-primary font-bold">$0 / query</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
