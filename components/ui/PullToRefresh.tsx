import React, { useState, useRef, useCallback } from 'react';
import { Loader2, ArrowUp } from 'lucide-react';
import HapticService from '../../services/hapticService';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children, disabled = false }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const THRESHOLD = 60;
  // Deliberate hold once past THRESHOLD, so a quick accidental swipe never fires a refresh.
  const HOLD_MS = 1200;

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const runRefresh = useCallback(async () => {
    setIsHolding(false);
    setIsRefreshing(true);
    setPullDistance(THRESHOLD);
    HapticService.medium();
    try {
      await onRefresh();
      HapticService.success();
    } catch (err) {
      console.error('Pull-to-refresh failed:', err);
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [onRefresh]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop || containerRef.current?.scrollTop || 0;
    if (scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPullingRef.current || startYRef.current === null || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0) {
      // Resistance curve for smooth pull feeling
      const distance = Math.min(Math.pow(diff, 0.85), 100);
      setPullDistance(distance);

      if (distance >= THRESHOLD && !holdTimerRef.current && !isHolding) {
        setIsHolding(true);
        holdTimerRef.current = setTimeout(() => {
          holdTimerRef.current = null;
          runRefresh();
        }, HOLD_MS);
      } else if (distance < THRESHOLD && holdTimerRef.current) {
        // Pulled back below threshold before the hold completed - cancel.
        clearHoldTimer();
        setIsHolding(false);
      }
    }
  }, [isRefreshing, isHolding, runRefresh]);

  const handleTouchEnd = useCallback(() => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    startYRef.current = null;

    // Releasing before the hold timer fires cancels the refresh, even past THRESHOLD.
    clearHoldTimer();
    setIsHolding(false);
    if (!isRefreshing) setPullDistance(0);
  }, [isRefreshing]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="relative min-h-full"
    >
      {/* Indicator overlay */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex flex-col items-center justify-end gap-1.5 py-2 transition-all duration-200 overflow-hidden"
          style={{ height: `${isRefreshing ? THRESHOLD : pullDistance}px`, opacity: pullDistance / THRESHOLD }}
        >
          <div className="w-8 h-8 rounded-full bg-theme-secondary border border-theme shadow-md flex items-center justify-center text-[var(--accent-color)]">
            {isRefreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp
                className="w-4 h-4 transition-transform duration-150"
                style={{ transform: `rotate(${isHolding ? 180 : 0}deg)` }}
              />
            )}
          </div>
          {/* "Hold to refresh" note slides up once past threshold */}
          {isHolding && !isRefreshing && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-theme-secondary animate-fade-in">
              Hold to refresh…
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
};
