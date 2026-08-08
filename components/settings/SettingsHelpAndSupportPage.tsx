import React from 'react';
import { HelpCircle, Sparkles } from 'lucide-react';
import { SettingsPrivacyLegalSection } from './SettingsPrivacyLegalSection';
import { SettingsFeedbackSection } from './SettingsFeedbackSection';

interface SettingsHelpAndSupportPageProps {
  helpTitle: string;
  helpDescription: string;
  onOpenFAQ: () => void;

  feedbackTitle: string;
  feedback: string;
  setFeedback: React.Dispatch<React.SetStateAction<string>>;
  sending: boolean;
  onSubmitFeedback: React.FormEventHandler<HTMLFormElement>;

  privacyTitle: string;
  onViewPrivacyPolicy: () => void;
  onViewTermsOfService: () => void;
  onCopyPrivacyUrl: () => void;
  canDeleteAccount: boolean;
  onDeleteAccount: () => void;

  onReplayOnboarding?: () => void;
}

export const SettingsHelpAndSupportPage: React.FC<SettingsHelpAndSupportPageProps> = ({
  helpTitle,
  helpDescription,
  onOpenFAQ,
  feedbackTitle,
  feedback,
  setFeedback,
  sending,
  onSubmitFeedback,
  privacyTitle,
  onViewPrivacyPolicy,
  onViewTermsOfService,
  onCopyPrivacyUrl,
  canDeleteAccount,
  onDeleteAccount,
  onReplayOnboarding,
}) => {
  return (
    <>
      <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
        <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-5 h-5 text-[var(--accent-color)]" />
            <h3 className="font-semibold text-theme-primary">{helpTitle}</h3>
          </div>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-theme-secondary">{helpDescription}</p>
          <button
            onClick={onOpenFAQ}
            className="bg-[var(--accent-color)] text-[var(--accent-text,white)] px-4 py-2 rounded font-medium text-sm hover:bg-opacity-90 transition-colors"
          >
            Open Help & FAQ
          </button>
        </div>
      </div>

      <SettingsFeedbackSection
        title={feedbackTitle}
        feedback={feedback}
        setFeedback={setFeedback}
        sending={sending}
        onSubmit={onSubmitFeedback}
      />

      <SettingsPrivacyLegalSection
        title={privacyTitle}
        onViewPrivacyPolicy={onViewPrivacyPolicy}
        onViewTermsOfService={onViewTermsOfService}
        onCopyPrivacyUrl={onCopyPrivacyUrl}
        canDeleteAccount={canDeleteAccount}
        onDeleteAccount={onDeleteAccount}
      />

      {onReplayOnboarding && (
        <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
          <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-[var(--accent-color)]" />
              <h3 className="font-semibold text-theme-primary">Replay Onboarding</h3>
            </div>
          </div>
          <div className="p-4">
            <button
              onClick={onReplayOnboarding}
              className="bg-theme-primary text-theme-secondary border border-theme px-4 py-2 rounded-lg font-medium text-sm hover:bg-theme-secondary transition-colors"
            >
              Restart the onboarding tutorial
            </button>
          </div>
        </div>
      )}
    </>
  );
};
