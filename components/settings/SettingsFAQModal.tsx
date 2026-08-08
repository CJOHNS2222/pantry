import React, { Suspense, lazy } from 'react';
import { Settings as SettingsIcon, X } from 'lucide-react';

const FAQPage = lazy(() => import('./FAQPage').then(m => ({ default: m.FAQPage })));

interface SettingsFAQModalProps {
  onClose: () => void;
  onNavigateToFeedback: () => void;
}

export const SettingsFAQModal: React.FC<SettingsFAQModalProps> = ({ onClose, onNavigateToFeedback }) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-theme-primary rounded-2xl shadow-2xl max-w-4xl w-full h-[90vh] max-h-[800px] flex flex-col">
        <div className="flex-shrink-0 p-4 border-b border-theme bg-theme-secondary">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <SettingsIcon className="w-5 h-5 text-theme-primary flex-shrink-0" />
              <h2 className="font-serif font-bold text-theme-primary text-lg truncate">Help & FAQ</h2>
            </div>
            <button onClick={onClose} className="text-theme-secondary hover:text-theme-primary flex-shrink-0 ml-2">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto min-h-0">
          <Suspense fallback={null}>
            <FAQPage
              onBack={onClose}
              onNavigateToFeedback={onNavigateToFeedback}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
};
