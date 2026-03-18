import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, BookOpen, SplitSquareVertical, Search, BrainCircuit } from "lucide-react";

const STEPS = [
  {
    text: "Fetching papers from Semantic Scholar…",
    icon: BookOpen,
    detail: "Querying academic databases for peer-reviewed research",
  },
  {
    text: "Chunking & processing abstracts…",
    icon: SplitSquareVertical,
    detail: "Splitting abstracts into digestible text segments",
  },
  {
    text: "Searching vector database…",
    icon: Search,
    detail: "Finding the most relevant content using embeddings",
  },
  {
    text: "Gemini is synthesizing your answer…",
    icon: BrainCircuit,
    detail: "AI is reading and citing the research to craft your response",
  },
];

interface LoadingPipelineProps {
  onComplete?: () => void;
}

const LoadingPipeline = ({ onComplete }: LoadingPipelineProps) => {
  // It now relies on React unmount when state shifts from "loading" to "results"
  // so we don't automatically trigger anything here.
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= STEPS.length - 1) {
          clearInterval(stepTimer);
          return prev;
        }
        return prev + 1;
      });
    }, 1400);

    const progressTimer = setInterval(() => {
      setProgress((prev) => Math.min(prev + 1, 100));
    }, 50);

    return () => {
      clearInterval(stepTimer);
      clearInterval(progressTimer);
    };
  }, [onComplete]);

  return (
    <div className="card-elevated p-6 md:p-8 max-w-2xl mx-auto animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Processing Pipeline
        </p>
        <span className="text-xs text-muted-foreground font-mono tabular-nums">
          {Math.min(Math.round((currentStep / (STEPS.length - 1)) * 100), 100)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted rounded-full mb-6 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.min(((currentStep + 1) / STEPS.length) * 100, 100)}%`,
            background: "var(--gradient-hero)",
          }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {STEPS.map((step, i) => {
          const StepIcon = step.icon;
          const isCompleted = i < currentStep;
          const isActive = i === currentStep;
          const isPending = i > currentStep;

          return (
            <div
              key={i}
              className={`pipeline-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              style={{
                opacity: isPending ? 0.4 : 1,
                transition: "all 0.4s ease",
              }}
            >
              {/* Status icon */}
              <div className="shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-muted" />
                )}
              </div>

              {/* Step icon */}
              <StepIcon className={`h-4 w-4 shrink-0 ${isActive || isCompleted ? 'text-primary' : 'text-muted-foreground'}`} />

              {/* Text */}
              <div className="min-w-0">
                <span className={`text-sm font-medium ${isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.text}
                </span>
                {isActive && (
                  <p className="text-xs text-muted-foreground mt-0.5 animate-fade-in">
                    {step.detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LoadingPipeline;
