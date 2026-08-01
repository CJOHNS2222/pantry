import React, { useState, useMemo } from 'react';
import { Bell, Clock, Check, X, AlertCircle } from 'lucide-react';
import { NotificationItem } from '../../services/notificationService';
import { markNotificationRead, snoozeNotificationInCache, updateNotificationInCache } from '../../services/notificationsService';
import { User } from '../../types';
import { joinHousehold } from '../../services/householdService';
import { useAppActions } from '../../contexts/AppActionsContext';
import { useApp } from '../../contexts/AppContext';
import { Tab } from '../../types/app';
import { log } from '../../services/logService';
import { useUserNotifications } from '../../hooks/useUserNotifications';

interface PendingNotificationsProps {
  user: User;
  onNavigateToSettings?: () => void;
  /**
   * 'pending' (default) — action-required inbox, unread only, matches the header bell.
   * 'history' — full record including already-read notifications, for the Settings
   * page where users expect to be able to look back at everything, not just what's
   * still outstanding.
   */
  mode?: 'pending' | 'history';
}

export const PendingNotifications: React.FC<PendingNotificationsProps> = ({
  user,
  onNavigateToSettings: _onNavigateToSettings,
  mode = 'pending'
}) => {
  const [processing, setProcessing] = useState<string | null>(null);
  const { inventory } = useApp();
  const { setActiveTab, onAddToShoppingList, addToast } = useAppActions();

  // Stream notifications in realtime
  const { items: rawNotifications } = useUserNotifications(user.id, 500);

  // Pending mode only surfaces what still needs action; history mode shows everything
  // that hasn't expired yet (the underlying cache doc already holds both), so users
  // have somewhere to look back at what already happened.
  const notifications = useMemo(() => {
    return (rawNotifications || [])
      .filter(n => mode === 'history' || !n.read)
      .map(n => ({
        id: n.id,
        userId: user.id,
        type: (n as { type?: NotificationItem['type'] }).type as NotificationItem['type'] || 'system',
        title: n.title,
        message: n.message || n.body || n.title,
        actionLabel: n.actionLabel,
        actionType: n.actionType as NotificationItem['actionType'],
        actionData: n.actionData,
        priority: n.priority || 'low',
        read: n.read || false,
        createdAt: n.createdAt,
        expiresAt: n.expiresAt,
        snoozedUntil: n.snoozedUntil
      }))
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, mode === 'history' ? 50 : 20);
  }, [rawNotifications, user.id, mode]);

  const handleAcceptNotification = async (notification: NotificationItem) => {
    setProcessing(notification.id);
    try {
      // Handle different action types
      switch (notification.actionType) {
        case 'add_to_shopping': {
          const itemName = notification.actionData?.itemName
            ?? notification.actionData?.items?.[0]?.itemName;
          if (itemName) {
            onAddToShoppingList([itemName]);
            addToast(`Added "${itemName}" to shopping list`, 'success');
          } else {
            addToast('Could not determine item to add', 'error');
          }
          setActiveTab(Tab.SHOPPING);
          break;
        }
        case 'view_recipe':
          setActiveTab(Tab.RECIPES);
          addToast('Viewing your saved recipes', 'info');
          break;
        case 'view_item': {
          const itemId = notification.actionData?.items?.[0]?.itemId
            ?? notification.actionData?.itemId;
          const found = itemId ? inventory.findIndex(i => i.id === itemId) : -1;
          if (found !== -1) {
            setActiveTab(Tab.PANTRY);
            addToast(`Viewing "${inventory[found].item}" in pantry`, 'info');
          } else {
            setActiveTab(Tab.PANTRY);
            addToast('Item no longer found in pantry', 'info');
          }
          break;
        }
        case 'join_household':
          // Join household invitation. Delegates to joinHousehold(), which calls the
          // acceptInvitation Cloud Function — the server re-validates the invite
          // against the caller's own authenticated email before granting membership.
          // (Previously this wrote memberIds/members directly from the client, which
          // only "worked" because inviteMember used to pre-grant access at invite
          // time; that pre-grant was itself the vulnerability and has been removed.)
          if (notification.actionData?.householdId) {
            try {
              const updatedHousehold = await joinHousehold(notification.actionData.householdId, user);
              if (updatedHousehold) {
                addToast('Successfully joined household!', 'success');
              } else {
                addToast('Failed to join household - invitation not found', 'error');
              }
            } catch (error) {
              log.error('Error joining household', { error }, 'PendingNotifications');
              addToast('Failed to join household', 'error');
              throw error;
            }
          }
          break;
      }

      // Mark notification as read - try both methods
      try {
        await markNotificationRead(user.id, notification.id);
      } catch (_error) {
        // If top-level update fails, try updating in cache
        await updateNotificationInCache(user.id, notification.id, { read: true });
      }
    } catch (error) {
      log.error('Error accepting notification', { error }, 'PendingNotifications');
    } finally {
      setProcessing(null);
    }
  };

  const handleSnoozeNotification = async (notification: NotificationItem, minutes: number) => {
    setProcessing(notification.id);
    try {
      if (user?.id) {
        await snoozeNotificationInCache(user.id, notification.id, minutes);
      }
    } catch (error) {
      log.error('Error snoozing notification', { error }, 'PendingNotifications');
    } finally {
      setProcessing(null);
    }
  };

  const handleDismissNotification = async (notification: NotificationItem) => {
    setProcessing(notification.id);
    try {
      // Mark notification as read - try both methods
      try {
        await markNotificationRead(user.id, notification.id);
      } catch (_error) {
        // If top-level update fails, try updating in cache
        await updateNotificationInCache(user.id, notification.id, { read: true });
      }
    } catch (error) {
      log.error('Error dismissing notification', { error }, 'PendingNotifications');
    } finally {
      setProcessing(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-400 border-red-400/30';
      case 'high': return 'text-orange-400 border-orange-400/30';
      case 'medium': return 'text-yellow-400 border-yellow-400/30';
      case 'low': return 'text-blue-400 border-blue-400/30';
      default: return 'text-gray-400 border-gray-400/30';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertCircle className="w-4 h-4" />;
      case 'high':
      case 'medium':
      case 'low': return <Bell className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };


  return (
    <>
      {notifications.length === 0 ? (
        <div className="text-center py-8">
          <Bell className="w-12 h-12 text-theme-secondary mx-auto mb-3 opacity-50" />
          <p className="text-theme-secondary">{mode === 'history' ? 'No notifications yet' : 'No pending notifications'}</p>
          <p className="text-sm text-theme-secondary mt-1">
            {mode === 'history' ? "You'll see everything sent to you here." : "You're all caught up!"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`border rounded-lg p-3 bg-theme-primary/50 ${notification.read ? 'opacity-60 border-theme' : getPriorityColor(notification.priority)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getPriorityIcon(notification.priority)}
                  <span className="text-sm font-medium text-theme-primary capitalize">
                    {notification.type.replace('_', ' ')}
                  </span>
                  {mode === 'history' && (
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${notification.read ? 'bg-theme-secondary text-theme-secondary' : 'bg-[var(--accent-color)]/20 text-[var(--accent-color)]'}`}>
                      {notification.read ? 'Read' : 'Unread'}
                    </span>
                  )}
                </div>
                <span className="text-xs text-theme-secondary">
                  {(() => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const v: any = notification.createdAt;
                    let d: Date | null = null;
                    if (!v) return '—';
                    if (typeof v.toDate === 'function') d = v.toDate();
                    else if (typeof v.toMillis === 'function') d = new Date(v.toMillis());
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    else if (typeof v === 'string' || typeof v === 'number') d = new Date(v as any);
                    return d ? d.toLocaleDateString() : '—';
                  })()}
                </span>
              </div>

              <h4 className="font-medium text-theme-primary mb-1">{notification.title}</h4>
              <p className="text-sm text-theme-secondary mb-3">{notification.message}</p>

              {!notification.read && (
                <div className="flex gap-2">
                  {notification.actionType && notification.actionLabel && (
                    <button
                      onClick={() => handleAcceptNotification(notification)}
                      disabled={processing === notification.id}
                      className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <Check className="w-3 h-3" />
                      {notification.actionLabel}
                    </button>
                  )}

                  <button
                    onClick={() => handleSnoozeNotification(notification, 60)}
                    disabled={processing === notification.id}
                    className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Clock className="w-3 h-3" />
                    Snooze 1h
                  </button>

                  <button
                    onClick={() => handleDismissNotification(notification)}
                    disabled={processing === notification.id}
                    className="flex items-center gap-1 bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <X className="w-3 h-3" />
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
};