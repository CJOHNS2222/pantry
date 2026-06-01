import React from 'react';
import { ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';

interface SettingsHelpSectionProps {
  expanded: boolean;
  onToggle: () => void;
  title: string;
  description: string;
  onOpenFAQ: () => void;
  buttonLabel: string;
}

export const SettingsHelpSection: React.FC<SettingsHelpSectionProps> = ({
  expanded,
  onToggle,
  title,
  description,
  onOpenFAQ,
  buttonLabel,
}) => {
  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div onClick={onToggle} className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors">
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-theme-primary" /> : <ChevronRight className="w-5 h-5 text-theme-primary" />}
          <HelpCircle className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-theme p-4">
          <div className="space-y-3">
            <p className="text-sm text-theme-secondary">{description}</p>
            <button onClick={onOpenFAQ} className="bg-[var(--accent-color)] text-white px-4 py-2 rounded font-medium text-sm hover:bg-opacity-90 transition-colors">
              {buttonLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
