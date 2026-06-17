import React from 'react';
import { Loader2 } from 'lucide-react';

interface SectionStatePanelProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  children?: React.ReactNode;
  tone?: 'default' | 'subtle';
  centered?: boolean;
}

export const SectionStatePanel: React.FC<SectionStatePanelProps> = ({
  icon,
  title,
  description,
  children,
  tone = 'default',
  centered = true,
}) => {
  const toneClass = tone === 'subtle'
    ? 'bg-theme-secondary/40 border-theme'
    : 'bg-theme-secondary/70 border-theme shadow-sm';

  return (
    <div className={`rounded-2xl border ${toneClass} p-6 ${centered ? 'text-center' : ''}`}>
      <div className={`${centered ? 'items-center' : 'items-start'} flex flex-col gap-3`}>
        {icon ?? <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-color)]" />}
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-theme-primary">{title}</h3>
          {description && <p className="text-sm text-theme-secondary">{description}</p>}
        </div>
      </div>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
};
