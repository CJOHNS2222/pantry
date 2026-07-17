// components/PantryHealthScore.tsx
// Gamified pantry health ring + badge. No external deps.
import React, { useMemo } from 'react';
import type { PantryItem } from '../../types';
import { useAppActions } from '../../contexts/AppActionsContext';
import { ProgressBar } from '../ui';

interface PantryHealthScoreProps {
  inventory: PantryItem[];
  className?: string;
}

interface ScoreFactor {
  label: string;
  points: number;
  max: number;
  icon: string;
  tip: string;
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function getGrade(score: number): { letter: string; color: string; glow: string; ring: string; label: string } {
  if (score >= 90) return { letter: 'A+', color: '#22c55e', glow: 'shadow-green-500/30', ring: 'stroke-green-500', label: 'Excellent' };
  if (score >= 80) return { letter: 'A',  color: '#4ade80', glow: 'shadow-green-400/25', ring: 'stroke-green-400', label: 'Great' };
  if (score >= 70) return { letter: 'B',  color: '#a3e635', glow: 'shadow-lime-400/25',  ring: 'stroke-lime-400',  label: 'Good' };
  if (score >= 60) return { letter: 'C',  color: '#facc15', glow: 'shadow-yellow-500/25', ring: 'stroke-yellow-400', label: 'Fair' };
  if (score >= 40) return { letter: 'D',  color: '#fb923c', glow: 'shadow-orange-500/25', ring: 'stroke-orange-400', label: 'Needs Work' };
  return               { letter: 'F',  color: '#ef4444', glow: 'shadow-red-500/30',    ring: 'stroke-red-500',   label: 'Critical' };
}

export const PantryHealthScore: React.FC<PantryHealthScoreProps> = ({ inventory, className = '' }) => {
  const { addToast } = useAppActions();

  const { score, factors } = useMemo(() => {
    if (!inventory.length) return { score: 0, factors: [] };

    const now = Date.now();
    const total = inventory.length;

    // Factor 1: Freshness (no expired items)
    const expiredCount = inventory.filter(i => {
      const d = daysUntil(i.expirationDate);
      return d !== null && d < 0;
    }).length;
    const expiringSoonCount = inventory.filter(i => {
      const d = daysUntil(i.expirationDate);
      return d !== null && d >= 0 && d <= 3;
    }).length;
    const freshnessPoints = Math.max(0, 30 - expiredCount * 10 - expiringSoonCount * 3);

    // Factor 2: Variety (different categories)
    const categories = new Set(inventory.map(i => i.category || 'other'));
    const varietyPoints = Math.min(25, categories.size * 3);

    // Factor 3: Stock level (items with qty > 0)
    const inStockCount = inventory.filter(i => {
      const q = i.quantity;
      if (q == null) return true; // treat unset as in-stock
      if (typeof q === 'number') return q > 0;
      return q.amount > 0;
    }).length;
    const stockPoints = Math.round((inStockCount / total) * 20);

    // Factor 4: Expiry tracking (items with dates set)
    const trackedCount = inventory.filter(i => !!i.expirationDate).length;
    const trackingPoints = Math.round((trackedCount / total) * 15);

    // Factor 5: Recency (items updated within 30 days)
    const thirtyDaysAgo = now - 30 * 86400000;
    const recentCount = inventory.filter(i => {
      const t = i.lastRestocked ? new Date(i.lastRestocked).getTime()
              : i.dateAdded   ? new Date(i.dateAdded).getTime()
              : 0;
      return t > thirtyDaysAgo;
    }).length;
    const recencyPoints = Math.round((recentCount / total) * 10);

    const rawScore = freshnessPoints + varietyPoints + stockPoints + trackingPoints + recencyPoints;
    const clampedScore = Math.min(100, Math.max(0, rawScore));

    const factors: ScoreFactor[] = [
      {
        label: 'Freshness',
        points: freshnessPoints,
        max: 30,
        icon: '🥬',
        tip: expiredCount > 0 ? `${expiredCount} expired item${expiredCount !== 1 ? 's' : ''} — remove them to boost score` : 'All items are fresh!',
      },
      {
        label: 'Variety',
        points: varietyPoints,
        max: 25,
        icon: '🌈',
        tip: `${categories.size} categories stocked`,
      },
      {
        label: 'In Stock',
        points: stockPoints,
        max: 20,
        icon: '📦',
        tip: `${inStockCount}/${total} items available`,
      },
      {
        label: 'Expiry Tracking',
        points: trackingPoints,
        max: 15,
        icon: '📅',
        tip: `${trackedCount}/${total} items have expiry dates`,
      },
      {
        label: 'Up to Date',
        points: recencyPoints,
        max: 10,
        icon: '🔄',
        tip: `${recentCount}/${total} items updated in 30 days`,
      },
    ];

    return { score: clampedScore, factors };
  }, [inventory]);

  const grade = getGrade(score);

  // SVG ring params
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const dash = (score / 100) * circ;

  const handleScoreClick = () => {
    addToast(
      'Scoring: 🥬 Freshness (30 pts max) • 🌈 Variety (25 pts max) • 📦 In Stock (20 pts max) • 📅 Expiry Tracking (15 pts max) • 🔄 Up to Date (10 pts max)',
      'info',
      8000
    );
  };

  if (inventory.length === 0) return null;

  return (
    <div 
      onClick={handleScoreClick}
      className={`bg-theme-secondary border border-theme rounded-2xl p-4 cursor-pointer hover:bg-theme-secondary/80 transition-all duration-200 ${className}`}
      title="Click to view scoring categories explanation"
    >
      <div className="flex items-center gap-4">
        {/* Animated SVG ring */}
        <div className="relative shrink-0">
          <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
            {/* Track */}
            <circle cx="44" cy="44" r={radius} strokeWidth="8" fill="none" className="stroke-theme-primary" />
            {/* Progress */}
            <circle
              cx="44" cy="44" r={radius}
              strokeWidth="8" fill="none"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeLinecap="round"
              style={{ stroke: grade.color, transition: 'stroke-dasharray 0.8s ease-out' }}
            />
          </svg>
          {/* Grade label in center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black" style={{ color: grade.color }}>{grade.letter}</span>
            <span className="text-[9px] font-bold text-theme-secondary opacity-60 uppercase tracking-wide leading-none">{grade.label}</span>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-theme-primary flex items-center gap-1">
              Pantry Health
              <span className="text-[10px] opacity-60 font-normal">(Tap for details)</span>
            </h3>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-theme-primary text-theme-secondary">{score}/100</span>
          </div>
          <div className="space-y-1.5">
            {factors.map((f) => (
              <div key={f.label} className="group relative">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] shrink-0" aria-hidden="true">{f.icon}</span>
                  <ProgressBar
                    value={f.points}
                    max={f.max}
                    colorMode="auto"
                    size="sm"
                    className="flex-1"
                    aria-label={`${f.label} factor`}
                  />
                  <span className="text-[10px] text-theme-secondary w-8 text-right shrink-0 font-medium tabular-nums">
                    {f.points}/{f.max}
                  </span>
                </div>
                {/* Tooltip */}
                <div className="absolute left-4 bottom-full mb-1 px-2 py-1 bg-theme-primary border border-theme rounded-lg text-[10px] text-theme-primary whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <strong>{f.label}:</strong> {f.tip}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PantryHealthScore;
