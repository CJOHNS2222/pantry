/**
 * ProgressBar — Stock & Spoon Design System
 *
 * Animated, accessible progress indicator.
 *
 * Variants:
 *  - 'bar'    — classic horizontal fill bar
 *  - 'radial' — circular SVG ring
 *
 * Features:
 *  - Smooth CSS transition on value changes
 *  - Color shifts automatically as value approaches limits
 *    (e.g., low stock: amber → red; usage: green → amber → red)
 *  - Optional percentage / custom label overlay
 *  - aria-valuenow / aria-valuemin / aria-valuemax on the role="progressbar"
 *  - Configurable color mode: 'auto' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral'
 *  - Configurable sizes
 *
 * Usage:
 *   <ProgressBar value={65} />
 *   <ProgressBar value={85} colorMode="auto" label="Storage" showPercent />
 *   <ProgressBar variant="radial" value={72} size="lg" showPercent />
 */

import React from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProgressVariant = 'bar' | 'radial';
export type ProgressColorMode = 'auto' | 'accent' | 'success' | 'warning' | 'danger' | 'neutral';
export type ProgressSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ProgressBarProps {
  /** 0–100 */
  value: number;
  /** min (default 0) */
  min?: number;
  /** max (default 100) */
  max?: number;
  variant?: ProgressVariant;
  colorMode?: ProgressColorMode;
  /** Label shown above the bar (bar variant only) */
  label?: string;
  /** Show the numeric percentage */
  showPercent?: boolean;
  size?: ProgressSize;
  /** Indeterminate loading mode */
  indeterminate?: boolean;
  className?: string;
  /** Invert auto-color logic (high = good, low = bad → e.g., battery) */
  invertAuto?: boolean;
}

// ─── Color logic ─────────────────────────────────────────────────────────────

function resolveColor(mode: ProgressColorMode, pct: number, invert: boolean): string {
  if (mode === 'accent') return 'var(--accent-color)';
  if (mode === 'success') return '#10b981'; // emerald-500
  if (mode === 'warning') return '#f59e0b'; // amber-500
  if (mode === 'danger') return '#f43f5e';  // rose-500
  if (mode === 'neutral') return 'var(--text-secondary)';

  // auto — logic depends on whether high value is good (invert=false) or bad (invert=true)
  const effectivePct = invert ? 100 - pct : pct;
  if (effectivePct <= 20) return '#f43f5e';  // danger
  if (effectivePct <= 45) return '#f59e0b';  // warning
  return '#10b981';                           // success
}

// ─── Size config ─────────────────────────────────────────────────────────────

const BAR_SIZES: Record<ProgressSize, { height: string; text: string }> = {
  xs: { height: 'h-1',   text: 'text-[10px]' },
  sm: { height: 'h-1.5', text: 'text-xs' },
  md: { height: 'h-2.5', text: 'text-sm' },
  lg: { height: 'h-4',   text: 'text-base' },
};

const RADIAL_SIZES: Record<ProgressSize, { size: number; stroke: number; fontSize: string }> = {
  xs: { size: 32,  stroke: 3, fontSize: '9px' },
  sm: { size: 48,  stroke: 4, fontSize: '11px' },
  md: { size: 72,  stroke: 5, fontSize: '14px' },
  lg: { size: 96,  stroke: 6, fontSize: '18px' },
};

// ─── Bar Component ────────────────────────────────────────────────────────────

const BarProgress: React.FC<ProgressBarProps> = ({
  value,
  min = 0,
  max = 100,
  colorMode = 'auto',
  label,
  showPercent,
  size = 'md',
  indeterminate = false,
  className = '',
  invertAuto = false,
}) => {
  const clampedValue = Math.min(max, Math.max(min, value));
  const pct = ((clampedValue - min) / (max - min)) * 100;
  const color = resolveColor(colorMode, pct, invertAuto);
  const { height, text } = BAR_SIZES[size];

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {(label || showPercent) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className={`${text} font-medium text-[var(--text-secondary)]`}>{label}</span>
          )}
          {showPercent && !indeterminate && (
            <span
              className={`${text} font-semibold tabular-nums`}
              style={{ color }}
              aria-hidden="true"
            >
              {Math.round(pct)}%
            </span>
          )}
        </div>
      )}

      <div
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : clampedValue}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-label={label}
        className={`w-full ${height} bg-[var(--bg-secondary)] rounded-full overflow-hidden`}
      >
        <div
          className={`${height} rounded-full transition-all duration-500 ease-out ${
            indeterminate ? 'animate-pulse w-2/3' : ''
          }`}
          style={{
            width: indeterminate ? undefined : `${pct}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
};

// ─── Radial Component ─────────────────────────────────────────────────────────

const RadialProgress: React.FC<ProgressBarProps> = ({
  value,
  min = 0,
  max = 100,
  colorMode = 'auto',
  label,
  showPercent,
  size = 'md',
  indeterminate = false,
  className = '',
  invertAuto = false,
}) => {
  const clampedValue = Math.min(max, Math.max(min, value));
  const pct = ((clampedValue - min) / (max - min)) * 100;
  const color = resolveColor(colorMode, pct, invertAuto);
  const { size: svgSize, stroke, fontSize } = RADIAL_SIZES[size];

  const radius = (svgSize - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = indeterminate ? circumference * 0.25 : circumference * (1 - pct / 100);

  return (
    <div
      className={`inline-flex flex-col items-center gap-1 ${className}`}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : clampedValue}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-label={label}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        className={indeterminate ? 'animate-spin' : ''}
        style={indeterminate ? { animationDuration: '1.4s' } : undefined}
      >
        {/* Track */}
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="var(--bg-secondary)"
          strokeWidth={stroke}
        />
        {/* Fill */}
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${svgSize / 2} ${svgSize / 2})`}
          style={{ transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.3s ease' }}
        />
        {/* Center label */}
        {showPercent && !indeterminate && (
          <text
            x="50%"
            y="50%"
            dominantBaseline="middle"
            textAnchor="middle"
            fill={color}
            fontSize={fontSize}
            fontWeight="700"
            fontFamily="Inter, sans-serif"
          >
            {Math.round(pct)}%
          </text>
        )}
      </svg>
      {label && (
        <span className="text-xs text-[var(--text-secondary)] text-center">{label}</span>
      )}
    </div>
  );
};

// ─── Public export ─────────────────────────────────────────────────────────────

export const ProgressBar: React.FC<ProgressBarProps> = (props) => {
  if (props.variant === 'radial') return <RadialProgress {...props} />;
  return <BarProgress {...props} />;
};

ProgressBar.displayName = 'ProgressBar';
