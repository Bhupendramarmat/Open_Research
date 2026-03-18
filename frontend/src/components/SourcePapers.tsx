import { ExternalLink, Calendar, Quote } from "lucide-react";

export interface Paper {
  title: string;
  authors: string;
  year: string;
  url: string;
  abstract?: string;
  source?: string;
}

export interface SourceSummary {
  semantic_scholar: number;
  pubmed: number;
  both_sources_used: boolean;
}

const SourcePapers = ({
  papers,
  sourceSummary,
}: {
  papers: Paper[];
  sourceSummary: SourceSummary | null;
}) => {
  return (
    <div className="card-elevated p-6 md:p-8 max-w-2xl mx-auto animate-fade-up delay-100">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
          <Quote className="h-4 w-4 text-accent-foreground" />
        </div>
        <h3 className="text-lg font-serif text-foreground">Source Papers</h3>
        <span className="ml-auto text-xs text-muted-foreground font-medium px-2 py-1 bg-secondary rounded-full">
          {papers.length} papers
        </span>
      </div>

      {sourceSummary && (
        <div className="mb-4 text-xs text-muted-foreground bg-secondary/70 rounded-lg px-3 py-2 border border-border/50">
          Sources used: Semantic Scholar {sourceSummary.semantic_scholar} · PubMed {sourceSummary.pubmed}
          {!sourceSummary.both_sources_used && " · Only one source had matches for this query."}
        </div>
      )}

      {/* Papers list */}
      <div className="space-y-1">
        {papers.map((paper, i) => (
          <div
            key={i}
            className="paper-card group"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            {/* Citation number */}
            <span className="citation-badge mt-1 shrink-0">[{i + 1}]</span>

            {/* Paper details */}
            <div className="min-w-0 flex-1">
              <a
                href={paper.url}
                className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm leading-snug inline-flex items-start gap-1"
              >
                <span>{paper.title}</span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
              </a>

              <div className="flex items-center gap-3 mt-1.5">
                <p className="text-muted-foreground text-xs">
                  {paper.authors}
                </p>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {paper.year}
                </span>
                {paper.source && (
                  <span className="text-[10px] uppercase tracking-wide text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                    {paper.source === "semantic_scholar" ? "Semantic Scholar" : paper.source === "pubmed" ? "PubMed" : paper.source}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SourcePapers;
