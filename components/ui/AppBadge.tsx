import React from 'react';

type AppBadgeVariant = 'neutral' | 'info' | 'success' | 'warning' | 'critical';
type AppBadgeSize = 'sm' | 'xs';

interface AppBadgeProps {
  children: React.ReactNode;
  variant?: AppBadgeVariant;
  size?: AppBadgeSize;
  className?: string;
}

const VARIANT_STYLES: Record<AppBadgeVariant, string> = {
  neutral: 'bg-theme-primary/60 text-theme-primary border-theme',
  info: 'bg-sky-500/15 text-sky-700 border-sky-500/20',
  success: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/20',
  warning: 'bg-amber-500/15 text-amber-700 border-amber-500/20',
  critical: 'bg-rose-500/15 text-rose-700 border-rose-500/20',
};

const SIZE_STYLES: Record<AppBadgeSize, string> = {
  xs: 'text-[10px] px-2 py-0.5 rounded-full',
  sm: 'text-xs px-2.5 py-1 rounded-full',
};

export const AppBadge: React.FC<AppBadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'xs',
  className = '',
}) => {
  return (
    <span className={`inline-flex items-center gap-1 border font-semibold ${SIZE_STYLES[size]} ${VARIANT_STYLES[variant]} ${className}`.trim()}>
      {children}
    </span>
  );
};
