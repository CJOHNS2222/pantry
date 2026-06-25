import React from 'react';
import { MessageSquare } from 'lucide-react';

interface SettingsFeedbackSectionProps {
  title: string;
  feedback: string;
  setFeedback: React.Dispatch<React.SetStateAction<string>>;
  sending: boolean;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
}

export const SettingsFeedbackSection: React.FC<SettingsFeedbackSectionProps> = ({
  title, feedback, setFeedback, sending, onSubmit, }) => {
  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div className="w-full flex items-center justify-between p-4 border-b border-theme bg-theme-primary/20">
        <div className="flex items-center gap-3">
          
          <MessageSquare className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      <div className="p-4">
          <form onSubmit={onSubmit} className="space-y-3">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Let us know your thoughts..."
              className="w-full p-3 border border-theme rounded-lg resize-none text-theme-primary bg-theme-primary text-sm focus:border-[var(--accent-color)] focus:outline-none transition-colors"
              rows={3}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !feedback.trim()}
              className="bg-[var(--accent-color)] text-white px-4 py-2 rounded font-medium text-sm w-full hover:bg-opacity-90 transition-colors"
            >
              {sending ? 'Sending...' : 'Send Feedback'}
            </button>
          </form>
        </div>
    </div>
  );
};
