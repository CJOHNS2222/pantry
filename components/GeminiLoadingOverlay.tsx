import React from 'react';
import { Sparkles } from 'lucide-react';
import { useGeminiProgress, GeminiStage } from '../hooks/useGeminiProgress';

export type { GeminiStage };

// Preset stage sequences -------------------------------------------------------

export const IMAGE_ANALYSIS_STAGES: GeminiStage[] = [
  { threshold: 0,  label: 'Uploading image to AI…' },
  { threshold: 3,  label: 'Analyzing image contents…' },
  { threshold: 10, label: 'Identifying items and quantities…' },
  { threshold: 20, label: 'Almost there, finishing up…' },
];

export const RECIPE_SEARCH_STAGES: GeminiStage[] = [
  { threshold: 0,  label: 'Checking your pantry...' },
  { threshold: 2,  label: 'Finding recipes you can make...' },
  { threshold: 6,  label: 'Almost ready...' },
  { threshold: 15, label: 'This is taking longer than usual. Hang tight...' },
];

// Component -------------------------------------------------------------------

interface GeminiLoadingOverlayProps {
  /** Whether Gemini is currently processing. Renders nothing when false. */
  isActive: boolean;
  /** Known maximum duration in seconds (used for countdown + progress bar). */
  totalSeconds: number;
  /** Ordered list of stage messages keyed on elapsed-second thresholds. */
  stages: GeminiStage[];
  /**
   * `overlay` – absolute overlay on top of an image (used in PantryScanner).
   * `inline`  – block-level banner inside the page flow (used in RecipeFinder).
   */
  variant?: 'overlay' | 'inline';
  /** Called once when the countdown reaches zero. Use to abort the in-flight request. */
  onTimeout?: () => void;
}

export const GeminiLoadingOverlay: React.FC<GeminiLoadingOverlayProps> = ({
  isActive,
  totalSeconds,
  stages,
  variant = 'overlay',
  onTimeout,
}) => {
  const { remaining, progressPct, stageLabel } = useGeminiProgress(
    isActive,
    totalSeconds,
    stages,
    onTimeout,
  );

  if (!isActive) return null;

  const countdownLabel =
    remaining > 0 ? `~${remaining}s remaining` : 'Finalizing…';

  const progressBar = (
    <div className="w-full bg-black/10 rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-1000 ease-linear bg-[var(--accent-color)]"
        style={{ width: `${progressPct}%` }}
      />
    </div>
  );

  if (variant === 'overlay') {
    return (
      <div className="absolute inset-0 bg-black/55 flex items-center justify-center backdrop-blur-[2px]">
        <div className="bg-white/92 backdrop-blur-sm rounded-xl p-4 flex flex-col items-center gap-3 mx-4 w-full max-w-[230px]">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[var(--accent-color)] animate-pulse" />
            <span className="text-xs font-semibold text-[var(--accent-color)] tracking-wide uppercase">
              Gemini AI
            </span>
          </div>
          <p className="text-sm font-medium text-theme-secondary text-center leading-tight">
            {stageLabel}
          </p>
          {progressBar}
          <p className="text-xs text-theme-secondary/60">{countdownLabel}</p>
        </div>
      </div>
    );
  }

  // Inline variant — sits above skeleton cards in RecipeFinder
  return (
    <div className="animate-fade-in-up bg-[var(--accent-color)]/8 border border-[var(--accent-color)]/25 rounded-xl p-4 flex flex-col gap-2.5 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-[var(--accent-color)] animate-pulse" />
          <span className="text-sm font-semibold text-[var(--accent-color)] tracking-wide uppercase">
            Gemini AI
          </span>
        </div>
        <span className="text-xs text-theme-secondary/60">{countdownLabel}</span>
      </div>
      <p className="text-sm text-theme-secondary">{stageLabel}</p>
      {progressBar}
    </div>
  );
};
