import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";

const QUESTION_PREFIX_REGEX = /^(how|what|why|when|where|which|can|could|does|do|is|are|will|would|should)\s+/i;

const buildSearchVariants = (query?: string, refinedQuery?: string) => {
  const baseRaw = (refinedQuery || query || "").trim();
  if (!baseRaw) {
    return [
      "Searching: retrieving peer-reviewed papers from academic sources",
      "Search: ranking the most relevant studies for synthesis",
    ];
  }

  const normalized = baseRaw
    .replace(/[?!.]+$/g, "")
    .replace(QUESTION_PREFIX_REGEX, "")
    .replace(/\s+/g, " ")
    .trim();

  const phrase = normalized || baseRaw;

  return [
    `Searching: ${phrase}`,
    `Search: (${phrase}) AND (systematic review OR randomized trial OR cohort study)`,
  ];
};

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const AiSearchLoadingPanel = ({
  query,
  refinedQuery,
  targetIncluded = 150,
}: {
  query?: string;
  refinedQuery?: string;
  targetIncluded?: number;
}) => {
  const [primarySearchQuery, secondarySearchQuery] = buildSearchVariants(query, refinedQuery);
  const [retrieved, setRetrieved] = useState(0);
  const [eligible, setEligible] = useState(0);
  const [included, setIncluded] = useState(0);

  const targets = useMemo(() => {
    const base = (refinedQuery || query || "").trim();
    const tokenCount = base ? base.split(/\s+/).length : 6;
    const includedTarget = Math.max(1, targetIncluded);
    const retrievedTarget = Math.max(includedTarget * 6, 180 + tokenCount * 90);
    const eligibleTarget = Math.max(includedTarget, Math.round(retrievedTarget * 0.16));

    return {
      retrievedTarget,
      eligibleTarget,
      includedTarget,
    };
  }, [query, refinedQuery, targetIncluded]);

  useEffect(() => {
    setRetrieved(0);
    setEligible(0);
    setIncluded(0);

    const startedAt = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(elapsed / 8500, 0.995);

      const retrievedProgress = easeOutCubic(progress);
      const eligibleProgress = easeOutCubic(Math.max((progress - 0.12) / 0.88, 0));
      const includedProgress = easeOutCubic(Math.max((progress - 0.35) / 0.65, 0));

      setRetrieved(Math.max(1, Math.round(targets.retrievedTarget * retrievedProgress)));
      setEligible(Math.max(0, Math.round(targets.eligibleTarget * eligibleProgress)));
      setIncluded(Math.max(0, Math.round(targets.includedTarget * includedProgress)));
    }, 120);

    return () => {
      clearInterval(timer);
    };
  }, [targets]);

  return (
    <div className="card-elevated p-5 sm:p-6 animate-slide-up-elastic" id="ai-loading-panel">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="font-medium text-foreground">Pro</span>
        <span>•</span>
        <span>Running multi-source research search</span>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-5">
        <div className="rounded-xl border border-border/50 bg-card/60 p-3">
          <div className="text-xl sm:text-2xl font-semibold text-foreground tabular-nums">
            {compactFormatter.format(retrieved)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Retrieved</div>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/60 p-3">
          <div className="text-xl sm:text-2xl font-semibold text-foreground tabular-nums">
            {compactFormatter.format(eligible)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Eligible</div>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/60 p-3">
          <div className="text-xl sm:text-2xl font-semibold text-foreground tabular-nums">
            {compactFormatter.format(included)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Included</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-card/50 px-3 py-2.5">
          <Search className="h-4 w-4 text-primary shrink-0 animate-pulse" />
          <p className="text-sm text-muted-foreground truncate">{primarySearchQuery}</p>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-card/50 px-3 py-2.5">
          <Search className="h-4 w-4 text-primary shrink-0 animate-pulse" />
          <p className="text-sm text-muted-foreground truncate">{secondarySearchQuery}</p>
        </div>
      </div>
    </div>
  );
};

export const ReferencesLoadingPanel = () => {
  return (
    <div className="space-y-6 animate-fade-in" id="references-loading-panel">
      <div className="space-y-2 px-1">
        <div className="skeleton-shimmer h-4 w-[74%]" />
        <div className="skeleton-shimmer h-4 w-[88%]" />
        <div className="skeleton-shimmer h-4 w-[62%]" />
      </div>

      {[1, 2, 3].map((item) => (
        <div key={item} className="rounded-xl border border-border/40 bg-card/50 p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="h-7 w-7 rounded-full bg-secondary/80 flex items-center justify-center text-xs font-semibold text-foreground/80">
              {item}
            </div>
            <div className="flex-1 space-y-2">
              <div className="skeleton-shimmer h-4 w-[92%]" />
              <div className="skeleton-shimmer h-4 w-[85%]" />
            </div>
          </div>
          <div className="ml-10 space-y-2">
            <div className="skeleton-shimmer h-3 w-[80%]" />
            <div className="skeleton-shimmer h-3 w-[68%]" />
          </div>
        </div>
      ))}

      <div className="text-center pt-2 text-sm text-muted-foreground flex items-center justify-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>Once papers are cited, they will appear here.</span>
      </div>
    </div>
  );
};
