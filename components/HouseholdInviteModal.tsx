import React, { useState } from 'react';
import { Users, Check, X, AlertCircle } from 'lucide-react';
import { NotificationItem } from '../services/notificationService';
import { User } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import { markNotificationRead } from '../services/notificationsService';

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
      console.error('Error accepting household invite:', error);
      setProcessing(null);
    }
  };

  const handleDecline = async (invite: NotificationItem) => {
    setProcessing(invite.id);
    try {
      await onDecline(invite);
      setProcessing(null);
    } catch (error) {
      console.error('Error declining household invite:', error);
      setProcessing(null);
    }
  };

  if (invites.length === 0) return null;

  // For simplicity, show the first invite. In a real app, you might want to handle multiple invites
  const currentInvite = invites[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="bg-blue-100 p-3 rounded-full mr-4">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Household Invitation</h2>
              <p className="text-sm text-gray-600">You have been invited to join a household</p>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-yellow-800 mb-1">
                  {currentInvite.title}
                </p>
                <p className="text-sm text-yellow-700">
                  {currentInvite.message}
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            Joining a household allows you to share pantry items, shopping lists, and meal plans with other members.
            You can leave the household at any time from the settings.
          </p>

          <div className="flex space-x-3">
            <button
              onClick={() => handleDecline(currentInvite)}
              disabled={processing === currentInvite.id}
              className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 disabled:text-gray-400 font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              {processing === currentInvite.id ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-2"></div>
              ) : (
                <X className="w-4 h-4 mr-2" />
              )}
              Decline
            </button>
            <button
              onClick={() => handleAccept(currentInvite)}
              disabled={processing === currentInvite.id}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
            >
              {processing === currentInvite.id ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};