import { Lightbulb, Copy, Check } from "lucide-react";
import { useState } from "react";

const AnswerDisplay = ({ answer }: { answer: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Strip HTML tags for plain text copy
    const plainText = answer.replace(/<[^>]*>/g, "");
    navigator.clipboard.writeText(plainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card-elevated p-6 md:p-8 max-w-2xl mx-auto animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Lightbulb className="h-4 w-4 text-accent-foreground" />
          </div>
          <h2 className="text-xl font-serif text-foreground">Synthesized Answer</h2>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     text-muted-foreground hover:text-foreground bg-secondary hover:bg-accent
                     transition-all duration-200"
        >
          {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Accent line */}
      <div className="h-0.5 w-16 rounded-full mb-5" style={{ background: "var(--gradient-hero)" }} />

      {/* Answer content */}
      <div
        className="text-secondary-foreground leading-relaxed space-y-4 text-[15px]"
        dangerouslySetInnerHTML={{
          __html: answer.replace(/\n\n/g, '</p><p class="mt-3">').replace(/^/, '<p>').replace(/$/, '</p>'),
        }}
      />

      {/* Disclaimer */}
      <div className="mt-6 pt-4 border-t border-border/50">
        <p className="text-xs text-muted-foreground italic flex items-start gap-1.5">
          <span className="text-primary mt-0.5">ⓘ</span>
          This answer was generated using only the content from the retrieved academic papers listed below.
          Always verify claims in the original sources.
        </p>
      </div>
    </div>
  );
};

export default AnswerDisplay;
