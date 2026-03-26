import { Lightbulb, Copy, Check, Sparkles } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const AnswerDisplay = ({ answer }: { answer: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const plainText = answer.replace(/<[^>]*>/g, "");
    navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card-elevated p-4 sm:p-6 md:p-8 max-w-2xl mx-auto animate-slide-up-elastic" id="answer-display">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between mb-4 sm:mb-5 gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center animate-glow-pulse"
               style={{ background: "var(--gradient-hero)" }}>
            <Lightbulb className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-foreground tracking-tight">Synthesized Answer</h2>
            <p className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              AI-generated from cited papers
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          id="copy-answer-btn"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     text-muted-foreground hover:text-foreground bg-secondary hover:bg-accent
                     transition-all duration-200 hover:scale-105"
        >
          {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Accent gradient line */}
      <div className="h-px w-full rounded-full mb-6" style={{ background: "var(--gradient-hero)", opacity: 0.3 }} />

      {/* Answer content with markdown */}
      <div className="prose-answer">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {answer}
        </ReactMarkdown>
      </div>

      {/* Disclaimer */}
      <div className="mt-6 pt-4 border-t border-border/30">
        <p className="text-xs text-muted-foreground italic flex items-start gap-2">
          <span className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px]"
                style={{ background: "var(--gradient-subtle)", color: "hsl(var(--primary))" }}>
            i
          </span>
          This answer was generated using only the content from retrieved academic papers listed below.
          Always verify claims in the original sources.
        </p>
      </div>
    </div>
  );
};

export default AnswerDisplay;
