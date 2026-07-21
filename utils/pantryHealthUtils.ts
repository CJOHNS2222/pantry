// utils/pantryHealthUtils.ts
// Shared pantry health score calculation — single source of truth for
// PantryHealthScore.tsx (Pantry tab) and the Community leaderboard.
import type { PantryItem } from '../types';

export interface ScoreFactor {
  label: string;
  points: number;
  max: number;
  icon: string;
  tip: string;
}

export interface PantryHealthResult {
  score: number;
  factors: ScoreFactor[];
  expiringSoonCount: number;
}

export interface HealthGrade {
  letter: string;
  color: string;
  glow: string;
  ring: string;
  label: string;
}

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export function getHealthGrade(score: number): HealthGrade {
  if (score >= 90) return { letter: 'A+', color: '#22c55e', glow: 'shadow-green-500/30', ring: 'stroke-green-500', label: 'Excellent' };
  if (score >= 80) return { letter: 'A', color: '#4ade80', glow: 'shadow-green-400/25', ring: 'stroke-green-400', label: 'Great' };
  if (score >= 70) return { letter: 'B', color: '#a3e635', glow: 'shadow-lime-400/25', ring: 'stroke-lime-400', label: 'Good' };
  if (score >= 60) return { letter: 'C', color: '#facc15', glow: 'shadow-yellow-500/25', ring: 'stroke-yellow-400', label: 'Fair' };
  if (score >= 40) return { letter: 'D', color: '#fb923c', glow: 'shadow-orange-500/25', ring: 'stroke-orange-400', label: 'Needs Work' };
  return { letter: 'F', color: '#ef4444', glow: 'shadow-red-500/30', ring: 'stroke-red-500', label: 'Critical' };
}

export function calculatePantryHealth(inventory: PantryItem[]): PantryHealthResult {
  if (!inventory.length) return { score: 0, factors: [], expiringSoonCount: 0 };

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

  return { score: clampedScore, factors, expiringSoonCount };
}
