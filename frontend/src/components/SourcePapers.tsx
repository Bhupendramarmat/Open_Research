import { ExternalLink, Calendar, Quote, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export interface Paper {
  title: string;
  authors: string;
  year: string;
  url: string;
  abstract?: string;
  detailed_summary?: string;
  source?: string;
}

export interface SourceSummary {
  semantic_scholar: number;
  pubmed: number;
  europe_pmc: number;
  crossref: number;
  both_sources_used: boolean;
}

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  semantic_scholar: { bg: "hsla(262, 83%, 58%, 0.1)", text: "hsl(262, 83%, 58%)" },
  pubmed: { bg: "hsla(185, 90%, 48%, 0.1)", text: "hsl(185, 90%, 48%)" },
  europe_pmc: { bg: "hsla(280, 75%, 55%, 0.1)", text: "hsl(280, 75%, 55%)" },
  crossref: { bg: "hsla(310, 70%, 55%, 0.1)", text: "hsl(310, 70%, 55%)" },
};

const SOURCE_LABELS: Record<string, string> = {
  semantic_scholar: "Semantic Scholar",
  pubmed: "PubMed",
  europe_pmc: "Europe PMC",
  crossref: "Crossref",
};

const PaperCard = ({ paper, index }: { paper: Paper; index: number }) => {
  const [expanded, setExpanded] = useState(false);
  const sourceStyle = paper.source ? SOURCE_COLORS[paper.source] : null;

  return (
    <div
      className="paper-card group"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      {/* Citation number */}
      <span className="citation-badge mt-1 shrink-0">[{index + 1}]</span>

      {/* Paper details */}
      <div className="min-w-0 flex-1">
        <a
          href={paper.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm leading-snug inline-flex items-start gap-1.5"
        >
          <span>{paper.title}</span>
          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0 mt-1 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </a>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <p className="text-muted-foreground text-xs truncate max-w-[200px]">
            {paper.authors}
          </p>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {paper.year}
          </span>
          {paper.source && sourceStyle && (
            <span
              className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
              style={{ background: sourceStyle.bg, color: sourceStyle.text }}
            >
              {SOURCE_LABELS[paper.source] ?? paper.source}
            </span>
          )}
        </div>

        {paper.detailed_summary && (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-2 transition-colors"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? "Hide summary" : "Show summary"}
            </button>
            {expanded && (
              <p className="mt-2 text-sm leading-relaxed text-secondary-foreground/80 whitespace-pre-line animate-fade-in pl-1 border-l-2 border-primary/20">
                {paper.detailed_summary}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const SourcePapers = ({
  papers,
  sourceSummary,
}: {
  papers: Paper[];
  sourceSummary: SourceSummary | null;
}) => {
  const [showAll, setShowAll] = useState(false);
  const visiblePapers = showAll ? papers : papers.slice(0, 8);

  return (
    <div className="card-elevated p-6 md:p-8 max-w-2xl mx-auto animate-slide-up-elastic delay-100" id="source-papers">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
             style={{ background: "var(--gradient-subtle)" }}>
          <Quote className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground tracking-tight">Source Papers</h3>
        </div>
        <span className="text-xs text-muted-foreground font-medium px-2.5 py-1 rounded-full"
              style={{ background: "var(--gradient-subtle)" }}>
          {papers.length} papers
        </span>
      </div>

      {sourceSummary && (
        <div className="mb-5 flex flex-wrap gap-2">
          {Object.entries({
            semantic_scholar: sourceSummary.semantic_scholar,
            pubmed: sourceSummary.pubmed,
            europe_pmc: sourceSummary.europe_pmc,
            crossref: sourceSummary.crossref,
          })
            .filter(([, count]) => count > 0)
            .map(([source, count]) => {
              const style = SOURCE_COLORS[source];
              return (
                <span
                  key={source}
                  className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: style?.bg, color: style?.text }}
                >
                  {SOURCE_LABELS[source]} · {count}
                </span>
              );
            })}
        </div>
      )}

      {/* Papers list */}
      <div className="space-y-1">
        {visiblePapers.map((paper, i) => (
          <PaperCard key={i} paper={paper} index={i} />
        ))}
      </div>

      {/* Show more/less */}
      {papers.length > 8 && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-primary hover:text-primary/80 font-medium transition-colors px-4 py-2 rounded-lg hover:bg-accent"
          >
            {showAll ? `Show less` : `Show all ${papers.length} papers`}
          </button>
        </div>
      )}
    </div>
  );
};

export default SourcePapers;
