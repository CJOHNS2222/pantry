// components/PantryHealthScore.tsx
// Gamified pantry health ring + badge. No external deps.
import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { PantryItem } from '../../types';
import { useAppActions } from '../../contexts/AppActionsContext';
import { ProgressBar } from '../ui';
import { calculatePantryHealth, getHealthGrade } from '../../utils/pantryHealthUtils';

interface PantryHealthScoreProps {
  inventory: PantryItem[];
  className?: string;
  /** 'full' shows the factor breakdown card; 'compact' shows a single-row ring + stats strip. */
  variant?: 'full' | 'compact';
  /**
   * Called when the compact card is tapped, instead of the default
   * "explain scoring" toast — used to open a detail view. Ignored for variant="full".
   */
  onExpand?: () => void;
}

export const PantryHealthScore: React.FC<PantryHealthScoreProps> = ({ inventory, className = '', variant = 'full', onExpand }) => {
  const { addToast } = useAppActions();

  const { score, factors, expiringSoonCount } = useMemo(() => calculatePantryHealth(inventory), [inventory]);

  const grade = getHealthGrade(score);

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

  if (variant === 'compact') {
    return (
      <div
        onClick={onExpand ?? handleScoreClick}
        className={`flex items-center gap-3 bg-theme-secondary border border-theme rounded-2xl px-4 py-2.5 cursor-pointer hover:bg-theme-secondary/80 transition-all duration-200 ${className}`}
        title={onExpand ? 'Tap to view full pantry health breakdown' : 'Tap to view scoring categories explanation'}
      >
        <div className="relative shrink-0 w-10 h-10">
          <svg width="40" height="40" viewBox="0 0 88 88" className="-rotate-90">
            <circle cx="44" cy="44" r={radius} strokeWidth="10" fill="none" className="stroke-theme-primary" />
            <circle
              cx="44" cy="44" r={radius}
              strokeWidth="10" fill="none"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeLinecap="round"
              style={{ stroke: grade.color, transition: 'stroke-dasharray 0.8s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[11px] font-black" style={{ color: grade.color }}>{grade.letter}</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-3 overflow-x-auto">
          <div className="leading-tight shrink-0">
            <div className="text-xs font-bold text-theme-primary tabular-nums">{score}/100</div>
            <div className="text-[10px] text-theme-secondary opacity-70">{grade.label}</div>
          </div>
          <div className="w-px h-7 bg-theme-primary/20 shrink-0" />
          <div className="leading-tight shrink-0">
            <div className="text-xs font-bold text-theme-primary tabular-nums">{inventory.length}</div>
            <div className="text-[10px] text-theme-secondary opacity-70">items</div>
          </div>
          {expiringSoonCount > 0 && (
            <>
              <div className="w-px h-7 bg-theme-primary/20 shrink-0" />
              <div className="leading-tight shrink-0">
                <div className="text-xs font-bold text-red-500 tabular-nums">{expiringSoonCount}</div>
                <div className="text-[10px] text-theme-secondary opacity-70">expiring</div>
              </div>
            </>
          )}
        </div>

        <ChevronRight className="w-4 h-4 text-theme-secondary opacity-50 shrink-0" />
      </div>
    );
  }

  return (
    <div
      className={`bg-theme-secondary border border-theme rounded-2xl p-4 ${className}`}
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
            <h3 className="text-sm font-bold text-theme-primary">Pantry Health</h3>
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
