import React, { useState } from 'react';
import { Users, Check, X, Bell } from 'lucide-react';
import { NotificationItem } from '../services/notificationService';
import { User } from '../types';
import { log } from '../services/logService';

interface HouseholdInviteModalProps {
  invites: NotificationItem[];
  user: User;
  onClose: () => void;
  onAccept: (invite: NotificationItem) => Promise<void>;
  onDecline: (invite: NotificationItem) => Promise<void>;
}

export const HouseholdInviteModal: React.FC<HouseholdInviteModalProps> = ({
  invites,
  user,
  onClose,
  onAccept,
  onDecline
}) => {
  const [processing, setProcessing] = useState<string | null>(null);

  const handleAccept = async (invite: NotificationItem) => {
    setProcessing(invite.id);
    try {
      await onAccept(invite);
      setProcessing(null);
    } catch (error) {
      log.error('Error accepting household invite', { inviteId: invite.id, error: error instanceof Error ? error.message : String(error) }, 'HouseholdInviteModal');
      setProcessing(null);
    }
  };

  const handleDecline = async (invite: NotificationItem) => {
    setProcessing(invite.id);
    try {
      await onDecline(invite);
      setProcessing(null);
    } catch (error) {
      log.error('Error declining household invite', { inviteId: invite.id, error: error instanceof Error ? error.message : String(error) }, 'HouseholdInviteModal');
      setProcessing(null);
    }
  };

  if (invites.length === 0) return null;

  const currentInvite = invites[0];
  const isProcessing = processing === currentInvite.id;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div role="dialog" aria-modal="true" aria-label="Household Invitation" className="bg-theme-secondary rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-theme overflow-hidden">
        {/* Header */}
        <div className="bg-[var(--accent-color)] px-6 py-5 flex items-center gap-3">
          <div className="bg-white/20 p-2.5 rounded-full">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Household Invitation</h2>
            <p className="text-white/80 text-sm">You've been invited to join a household</p>
          </div>
          {invites.length > 1 && (
            <span className="ml-auto bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {invites.length}
            </span>
          )}
        </div>

        <div className="p-6">
          {/* Invite details */}
          <div className="bg-[var(--accent-color)]/10 border border-[var(--accent-color)]/30 rounded-xl p-4 mb-5">
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-[var(--accent-color)] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-theme-primary mb-1">
                  {currentInvite.title}
                </p>
                <p className="text-sm text-theme-secondary">
                  {currentInvite.message}
                </p>
              </div>
            </div>
          </div>

          {/* What joining means */}
          <div className="space-y-2 mb-6">
            <p className="text-xs font-semibold text-theme-secondary uppercase tracking-wide">What happens when you join</p>
            {[
              'Your pantry items will be merged into the shared household pantry',
              'Your shopping list and meal plans will be combined with theirs',
              'Your saved recipes will be added to the household collection',
              'You can leave the household at any time from Settings',
            ].map((line, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-theme-secondary">
                <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{line}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => handleDecline(currentInvite)}
              disabled={isProcessing}
              className="flex-1 bg-theme-primary hover:bg-theme-secondary disabled:opacity-50 text-theme-secondary border border-theme font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
              Decline
            </button>
            <button
              onClick={() => handleAccept(currentInvite)}
              disabled={isProcessing}
              className="flex-2 flex-grow bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md"
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Accept &amp; Join
            </button>
          </div>

          {/* Dismiss link (non-destructive — just hides modal, not the invite) */}
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="mt-4 w-full text-center text-xs text-theme-secondary hover:text-theme-primary transition-colors py-1"
          >
            Decide later (reminder will stay visible)
          </button>
        </div>
      </div>
    </div>
  );
};