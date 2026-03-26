import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, BookOpen, SplitSquareVertical, Search, BrainCircuit } from "lucide-react";

const STEPS = [
  {
    text: "Fetching papers from Semantic Scholar",
    icon: BookOpen,
    detail: "Querying academic databases for peer-reviewed research",
    color: "hsl(262, 83%, 58%)",
  },
  {
    text: "Chunking & processing abstracts",
    icon: SplitSquareVertical,
    detail: "Splitting abstracts into digestible text segments",
    color: "hsl(280, 75%, 55%)",
  },
  {
    text: "Searching vector database",
    icon: Search,
    detail: "Finding the most relevant content using embeddings",
    color: "hsl(310, 70%, 55%)",
  },
  {
    text: "AI is synthesizing your answer",
    icon: BrainCircuit,
    detail: "Reading and citing the research to craft your response",
    color: "hsl(185, 90%, 48%)",
  },
];

interface LoadingPipelineProps {
  onComplete?: () => void;
}

const LoadingPipeline = ({ onComplete }: LoadingPipelineProps) => {
  const [currentStep, setCurrentStep] = useState(0);

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

    return () => {
      clearInterval(stepTimer);
    };
  }, [onComplete]);

  const progressPercent = Math.min(((currentStep + 1) / STEPS.length) * 100, 100);

  // SVG progress ring params
  const ringSize = 52;
  const strokeWidth = 3;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="card-elevated p-6 md:p-8 max-w-2xl mx-auto animate-slide-up-elastic" id="loading-pipeline">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg width={ringSize} height={ringSize} className="transform -rotate-90">
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={strokeWidth}
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="url(#progressGradient)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-700 ease-out"
              />
              <defs>
                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(262, 83%, 58%)" />
                  <stop offset="100%" stopColor="hsl(185, 90%, 48%)" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground font-mono">
              {Math.round(progressPercent)}%
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground tracking-tight">Processing Pipeline</p>
            <p className="text-xs text-muted-foreground">Analyzing research papers…</p>
          </div>
        </div>
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
                opacity: isPending ? 0.35 : 1,
                transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
            >
              {/* Status icon */}
              <div className="shrink-0">
                {isCompleted ? (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: step.color }}>
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                  </div>
                ) : isActive ? (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center border-2"
                       style={{ borderColor: step.color }}>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: step.color }} />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-muted" />
                )}
              </div>

              {/* Step icon */}
              <StepIcon
                className="h-4 w-4 shrink-0 transition-colors duration-300"
                style={{ color: isActive || isCompleted ? step.color : undefined }}
              />

              {/* Text */}
              <div className="min-w-0 flex-1">
                <span className={`text-sm font-medium transition-colors duration-300 ${isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.text}
                </span>
                {isActive && (
                  <p className="text-xs text-muted-foreground mt-0.5 animate-fade-in">
                    {step.detail}
                  </p>
                )}
              </div>

              {/* Time indicator for completed */}
              {isCompleted && (
                <span className="text-[10px] text-muted-foreground font-mono animate-fade-in">
                  Done
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LoadingPipeline;
