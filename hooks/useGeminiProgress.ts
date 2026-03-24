import { useState, useEffect, useRef } from 'react';

export interface GeminiStage {
  /** Elapsed seconds at which this stage begins. */
  threshold: number;
  label: string;
}

export interface GeminiProgressState {
  elapsed: number;
  remaining: number;
  /** 0 – 97; never reaches 100 while still active so the bar looks "in progress". */
  progressPct: number;
  stageLabel: string;
}

export function useGeminiProgress(
  isActive: boolean,
  totalSeconds: number,
  stages: GeminiStage[],
): GeminiProgressState {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isActive) {
      setElapsed(0);
      intervalRef.current = setInterval(() => {
        setElapsed(prev => Math.min(prev + 1, totalSeconds));
      }, 1000);
    } else {
      setElapsed(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, totalSeconds]);

  const remaining = Math.max(0, totalSeconds - elapsed);
  // Cap at 97 so the bar never looks "done" until actual completion.
  const progressPct = Math.min((elapsed / totalSeconds) * 100, 97);

  const currentStage =
    [...stages].reverse().find(s => elapsed >= s.threshold) ?? stages[0];

  return {
    elapsed,
    remaining,
    progressPct,
    stageLabel: currentStage?.label ?? '',
  };
}
