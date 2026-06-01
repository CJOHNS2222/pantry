import React from 'react';
import { ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';

interface SettingsFeedbackSectionProps {
  expanded: boolean;
  onToggle: () => void;
  title: string;
  feedback: string;
  setFeedback: React.Dispatch<React.SetStateAction<string>>;
  sending: boolean;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
}

export const SettingsFeedbackSection: React.FC<SettingsFeedbackSectionProps> = ({
  expanded,
  onToggle,
  title,
  feedback,
  setFeedback,
  sending,
  onSubmit,
}) => {
  return (
    <div className="bg-theme-secondary rounded-xl border border-theme overflow-hidden">
      <div onClick={onToggle} className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-theme-primary transition-colors">
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-theme-primary" /> : <ChevronRight className="w-5 h-5 text-theme-primary" />}
          <MessageSquare className="w-5 h-5 text-[var(--accent-color)]" />
          <h3 className="font-semibold text-theme-primary">{title}</h3>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-theme p-4">
          <form onSubmit={onSubmit} className="space-y-3">
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Let us know your thoughts..."
              className="w-full p-3 border rounded resize-none text-black bg-white text-sm"
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
      )}
    </div>
  );
};
