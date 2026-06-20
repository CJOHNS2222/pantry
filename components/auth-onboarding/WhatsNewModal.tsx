import React, { useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { RECENT_CHANGES } from '../../constants/changelogEntries';

const STORAGE_KEY = 'whats_new_seen_version';
const CURRENT_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.1.2';

// RECENT_CHANGES is auto-generated from CHANGELOG.md by scripts/generate-changelog.cjs
// Regenerates automatically on every `npm run build` and `npm run dev` via npm lifecycle hooks.

export interface WhatsNewModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onClose }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isOpen !== undefined) {
      setOpen(isOpen);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen !== undefined) return;
    let cleanup: (() => void) | undefined;
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen !== CURRENT_VERSION) {
        const t = setTimeout(() => setOpen(true), 1500);
        cleanup = () => clearTimeout(t);
      }
    } catch {
      // localStorage unavailable — skip silently
    }
    return cleanup;
  }, [isOpen]);

  const handleClose = () => {
    if (isOpen === undefined) {
      try {
        localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
      } catch {
        // ignore
      }
    }
    setOpen(false);
    onClose?.();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[9999] px-4 pb-[var(--safe-area-inset-bottom,0px)]"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`What's New in v${CURRENT_VERSION}`}
        className="bg-theme-primary rounded-2xl shadow-2xl w-full max-w-md border border-theme overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--accent-color)]" aria-hidden="true" />
            <h2 className="text-base font-bold text-theme-primary">What's New</h2>
            <span className="text-xs text-theme-secondary bg-theme-secondary px-2 py-0.5 rounded-full border border-theme">
              v{CURRENT_VERSION}
            </span>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-full text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary transition-colors"
            aria-label="Dismiss What's New"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Entries */}
        <div className="px-5 pb-2 space-y-4 max-h-72 overflow-y-auto">
          {RECENT_CHANGES.map((entry, i) => (
            <div key={entry.version}>
              {i > 0 && <div className="border-t border-theme pt-3" />}
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-sm font-semibold text-theme-primary">v{entry.version}</span>
                <span className="text-xs text-theme-secondary">{entry.date}</span>
              </div>
              <ul className="space-y-1">
                {entry.highlights.map((h, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-theme-secondary">
                    <span className="mt-0.5 w-1 h-1 rounded-full bg-[var(--accent-color)] flex-shrink-0" aria-hidden="true" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-theme flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-[var(--accent-color)] text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsNewModal;
