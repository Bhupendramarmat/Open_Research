import { Info, SlidersHorizontal, Shield, Database, BrainCircuit, Layers, ChevronRight, Menu, X } from "lucide-react";
import { useState } from "react";

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
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <div className="space-y-5">
      {/* About card */}
      <div className="card-glass p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
               style={{ background: "var(--gradient-subtle)" }}>
            <Info className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="font-semibold text-sm text-foreground tracking-tight">How It Works</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Leverages <strong className="text-foreground">multiple academic databases</strong> for paper retrieval and <strong className="text-foreground">advanced AI</strong> for synthesis. All answers are grounded in real, peer-reviewed abstracts.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-2.5 py-2 rounded-lg"
               style={{ background: "var(--gradient-subtle)" }}>
            <Layers className="h-3 w-3 text-primary" />
            <span>Multi-Source</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-2.5 py-2 rounded-lg"
               style={{ background: "var(--gradient-subtle)" }}>
            <Shield className="h-3 w-3 text-primary" />
            <span>Cited sources</span>
          </div>
        </div>
      </div>

      {/* Filters card */}
      <div className="card-glass p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
               style={{ background: "var(--gradient-subtle)" }}>
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="font-semibold text-sm text-foreground tracking-tight">Search Filters</h3>
        </div>

        <div className="space-y-5">
          {/* Papers slider */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2.5 flex items-center justify-between">
              <span>Papers to analyze</span>
              <span className="text-foreground font-bold text-sm font-mono tabular-nums px-2 py-0.5 rounded-md bg-secondary">
                {numPapers}
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={150}
              value={numPapers}
              onChange={(e) => onNumPapersChange(Number(e.target.value))}
              className="w-full accent-primary h-1.5 rounded-full cursor-pointer"
              id="papers-slider"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 font-mono">
              <span>1</span>
              <span>150</span>
            </div>
          </div>

          {/* Year range */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Year range
            </label>
            <select
              value={yearRange}
              onChange={(e) => onYearRangeChange(e.target.value)}
              id="year-range-select"
              className="w-full text-xs bg-secondary rounded-xl px-3 py-2.5 text-secondary-foreground border border-border/40 outline-none focus:ring-2 focus:ring-primary/30 transition-all cursor-pointer appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center" }}
            >
              <option value="2020-2026">2020 – 2026</option>
              <option value="2018-2026">2018 – 2026</option>
              <option value="2015-2026">2015 – 2026</option>
              <option value="2010-2026">2010 – 2026</option>
            </select>
          </div>

          {/* Peer-reviewed toggle */}
          <label className="flex items-center gap-3 text-xs text-muted-foreground cursor-pointer group" id="peer-reviewed-toggle">
            <div className="relative">
              <input
                type="checkbox"
                checked={peerReviewedOnly}
                onChange={(e) => onPeerReviewedOnlyChange(e.target.checked)}
                className="peer sr-only"
              />
              <div className="w-10 h-[22px] bg-muted rounded-full peer-checked:bg-primary transition-colors duration-300" />
              <div className="absolute left-0.5 top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow-sm peer-checked:translate-x-[18px] transition-transform duration-300" />
            </div>
            <span className="group-hover:text-foreground transition-colors font-medium">
              Peer-reviewed only
            </span>
          </label>
        </div>
      </div>

      {/* Stats card */}
      <div className="card-glass p-5">
        <h3 className="font-semibold text-sm text-foreground mb-3 tracking-tight">Quick Stats</h3>
        <div className="space-y-0.5">
          <div className="stat-item">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Database className="h-3 w-3" /> Database
            </span>
            <span className="text-foreground font-medium">250M+ papers</span>
          </div>
          <div className="stat-item">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <BrainCircuit className="h-3 w-3" /> AI Model
            </span>
            <span className="text-foreground font-medium">Advanced AI</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="w-72 shrink-0 hidden lg:block animate-slide-in-right" id="desktop-sidebar">
        {sidebarContent}
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-50 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
        style={{ background: "var(--gradient-hero)" }}
        id="mobile-sidebar-toggle"
        aria-label="Open settings"
      >
        <Menu className="h-5 w-5 text-white" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 animate-fade-in">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[90vw] bg-background p-6 overflow-y-auto animate-slide-in-right shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-semibold text-foreground text-sm tracking-tight flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-primary" />
                Settings
              </h2>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg hover:bg-secondary transition-colors"
                aria-label="Close settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
