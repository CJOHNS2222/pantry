import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface SettingsDeleteAccountModalProps {
  isDeletingAccount: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const SettingsDeleteAccountModal: React.FC<SettingsDeleteAccountModalProps> = ({
  isDeletingAccount,
  onCancel,
  onConfirm,
}) => {
  return (
    <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4">
      <div className="bg-theme-primary rounded-2xl shadow-2xl max-w-sm w-full p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
          <h2 className="font-serif font-bold text-theme-primary text-lg">Delete Account</h2>
        </div>
        <p className="text-sm text-theme-secondary leading-relaxed">
          This will <strong>permanently delete</strong> your account, all pantry data, meal plans, saved recipes, and remove you from any households. This action cannot be undone.
        </p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={onCancel}
            disabled={isDeletingAccount}
            className="flex-1 bg-theme-secondary text-theme-primary py-2 px-4 rounded-lg font-medium text-sm transition-colors hover:bg-theme-primary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeletingAccount}
            className="flex-1 bg-red-500 text-white py-2 px-4 rounded-lg font-medium text-sm transition-colors hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeletingAccount ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : 'Delete My Account'}
          </button>
        </div>
      </div>
    </div>
  );
};
