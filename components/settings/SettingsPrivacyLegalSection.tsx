import React from 'react';
import { Lock } from 'lucide-react';

interface SettingsPrivacyLegalSectionProps {
  title: string;
  onViewPrivacyPolicy: () => void;
  onViewTermsOfService: () => void;
  onCopyPrivacyUrl: () => void;
  canDeleteAccount: boolean;
  onDeleteAccount: () => void;
}

export const SettingsPrivacyLegalSection: React.FC<SettingsPrivacyLegalSectionProps> = ({
  title, onViewPrivacyPolicy, onViewTermsOfService, onCopyPrivacyUrl, canDeleteAccount, onDeleteAccount, }) => {
  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
        <div className="flex items-center gap-3">
          
          <Lock className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      <div className="p-4">
          <p className="text-sm text-theme-secondary">
            We use the device camera to scan barcodes and take pantry item photos. Review our privacy policy and terms of service for details about data collection and storage.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={onViewPrivacyPolicy}
              className="bg-[var(--accent-color)] text-white px-3 py-1 rounded-lg font-medium text-sm hover:bg-opacity-90 transition-colors"
            >
              View Privacy Policy
            </button>
            <button
              onClick={onViewTermsOfService}
              className="bg-theme-primary text-theme-secondary border border-theme px-3 py-1 rounded-lg font-medium text-sm hover:bg-theme-secondary transition-colors"
            >
              Terms of Service
            </button>
            <button
              onClick={onCopyPrivacyUrl}
              className="bg-theme-primary text-theme-secondary px-3 py-1 rounded-lg text-sm hover:bg-theme-secondary transition-colors animate-none"
            >
              Copy URL
            </button>
            {canDeleteAccount && (
              <button
                onClick={onDeleteAccount}
                className="bg-red-500 text-white px-3 py-1 rounded-lg font-medium text-sm hover:bg-red-600 transition-colors"
              >
                Delete Account
              </button>
            )}
          </div>
        </div>
    </div>
  );
};
