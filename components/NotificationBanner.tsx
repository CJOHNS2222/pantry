import React, { useState } from 'react';
import { Bell, X, Clock, Settings } from 'lucide-react';
import { NotificationItem } from '../services/notificationService';

interface NotificationBannerProps {
  notification: NotificationItem;
  onDismiss: (notificationId: string) => void;
  onAction: (notification: NotificationItem) => void;
  onSnooze: (notificationId: string, minutes: number) => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  notification,
  onDismiss,
  onAction,
  onSnooze
}) => {
  const [showActions, setShowActions] = useState(false);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-red-500 bg-red-50';
      case 'high': return 'border-orange-500 bg-orange-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-blue-500 bg-blue-50';
    }
  };

  const getPriorityTextColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-800';
      case 'high': return 'text-orange-800';
      case 'medium': return 'text-yellow-800';
      default: return 'text-blue-800';
    }
  };

  return (
    <div className={`fixed top-4 left-4 right-4 max-w-md mx-auto z-50 border-l-4 rounded-lg shadow-lg p-4 ${getPriorityColor(notification.priority)}`}>
      <div className="flex items-start gap-3">
        <Bell className={`w-5 h-5 mt-0.5 ${getPriorityTextColor(notification.priority)}`} />
        <div className="flex-1">
          <h4 className={`font-semibold text-sm ${getPriorityTextColor(notification.priority)}`}>
            {notification.title}
          </h4>
          <p className={`text-sm mt-1 ${getPriorityTextColor(notification.priority)} opacity-90`}>
            {notification.message}
          </p>

          <div className="flex items-center gap-2 mt-3">
            {notification.actionLabel && (
              <button
                onClick={() => onAction(notification)}
                className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${getPriorityTextColor(notification.priority)} bg-white hover:bg-gray-100 border border-white/50`}
              >
                {notification.actionLabel}
              </button>
            )}

            <button
              onClick={() => setShowActions(!showActions)}
              className={`text-xs px-2 py-1 rounded-md transition-colors ${getPriorityTextColor(notification.priority)} hover:bg-white/30`}
            >
              <Settings className="w-3 h-3 inline mr-1" />
              More
            </button>
          </div>

          {showActions && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/30">
              <button
                onClick={() => onSnooze(notification.id, 60)}
                className={`text-xs flex items-center gap-1 px-2 py-1 rounded-md transition-colors ${getPriorityTextColor(notification.priority)} hover:bg-white/30`}
              >
                <Clock className="w-3 h-3" />
                Snooze 1h
              </button>
              <button
                onClick={() => onSnooze(notification.id, 24 * 60)}
                className={`text-xs px-2 py-1 rounded-md transition-colors ${getPriorityTextColor(notification.priority)} hover:bg-white/30`}
              >
                Snooze 1d
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => onDismiss(notification.id)}
          className={`hover:bg-white/50 rounded-full p-1 transition-colors ${getPriorityTextColor(notification.priority)}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};