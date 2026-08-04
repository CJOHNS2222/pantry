import React, { useState, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import HapticService from '../../services/hapticService';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children, disabled = false }) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 60;

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
      if (distance >= THRESHOLD && pullDistance < THRESHOLD) {
        HapticService.light();
      }
    }
  }, [isRefreshing, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;
    startYRef.current = null;

    if (pullDistance >= THRESHOLD && !isRefreshing) {
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
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, onRefresh]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative min-h-full"
    >
      {/* Indicator overlay */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex items-center justify-center py-2 transition-all duration-200"
          style={{ height: `${isRefreshing ? THRESHOLD : pullDistance}px`, opacity: pullDistance / THRESHOLD }}
        >
          <div className="w-8 h-8 rounded-full bg-theme-secondary border border-theme shadow-md flex items-center justify-center text-[var(--accent-color)]">
            <Loader2 className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullDistance * 3}deg)` }} />
          </div>
        </div>
      )}
      {children}
    </div>
  );
};
