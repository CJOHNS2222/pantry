import React, { useState, useEffect } from 'react';
import { Bell, Clock, Check, X, AlertCircle } from 'lucide-react';
import { NotificationService, NotificationItem } from '../services/notificationService';
import { markNotificationRead, snoozeNotificationInCache, updateNotificationInCache } from '../services/notificationsService';
import { User } from '../types';
import { serverTimestamp } from 'firebase/firestore';
import DatabaseMonitoringService from '../services/databaseMonitoringService';
import { getNotificationsOnce } from '../services/notificationsService';
import { Timestamp } from 'firebase/firestore';
import { useApp } from '../contexts/AppContext';
import { useAppActions } from '../contexts/AppActionsContext';
import { Tab } from '../types/app';

interface PendingNotificationsProps {
  user: User;
  onNavigateToSettings?: () => void;
}

export const PendingNotifications: React.FC<PendingNotificationsProps> = ({
  user,
  onNavigateToSettings
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const { inventory } = useApp();
  const { setActiveTab, onAddToShoppingList, addToast } = useAppActions();

  useEffect(() => {
    loadNotifications();
  }, [user.id]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      
      // Get notifications from both sources
      const [topLevelNotifications, cachedNotifications] = await Promise.all([
        NotificationService.getUnreadNotifications(user.id, user.email),
        getNotificationsOnce(user.id)
      ]);
      
      // Combine and deduplicate notifications
      const allNotifications = [...topLevelNotifications];
      
      // Add cached notifications that aren't already in the top-level list
      for (const cached of cachedNotifications) {
        if (!cached.read && !allNotifications.find(n => n.id === cached.id)) {
          // Convert cached notification format to NotificationItem format
          allNotifications.push({
            id: cached.id,
            userId: user.id,
            type: (cached as any).type || 'system',
            title: cached.title,
            message: (cached as any).body || cached.title,
            actionLabel: (cached as any).actionLabel,
            actionType: (cached as any).actionType,
            actionData: (cached as any).actionData,
            priority: (cached as any).priority || 'low',
            read: cached.read || false,
            createdAt: (cached as any).createdAt instanceof Date ? Timestamp.fromDate((cached as any).createdAt) : 
                      typeof (cached as any).createdAt === 'string' ? Timestamp.fromDate(new Date((cached as any).createdAt)) :
                      Timestamp.now(),
            expiresAt: (cached as any).expiresAt,
            snoozedUntil: (cached as any).snoozedUntil
          });
        }
      }
      
      // Sort by createdAt desc and limit to 20
      const sorted = allNotifications.slice().sort((a: any, b: any) => {
        const aTime = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const bTime = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return bTime - aTime;
      }).slice(0, 20);
      
      setNotifications(sorted);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
    }
  };

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
          // Join household invitation
          if (notification.actionData?.householdId) {
            try {
              // Update user document with householdId
              const userRef = DatabaseMonitoringService.doc('users', user.id);
              await DatabaseMonitoringService.updateDoc(userRef, {
                householdId: notification.actionData.householdId,
                updatedAt: serverTimestamp()
              });

              // Update household document to add member
              const householdRef = DatabaseMonitoringService.doc('households', notification.actionData.householdId);
              const householdDoc = await DatabaseMonitoringService.getDoc(householdRef);
              
              if (householdDoc.exists()) {
                const householdData = householdDoc.data();
                
                // Handle both array and map formats for members (same as checkInvitation function)
                let existingMembers = [];
                if (householdData && Array.isArray(householdData.members)) {
                  existingMembers = householdData.members;
                } else if (householdData?.members && typeof householdData.members === 'object') {
                  // Convert map to array (handle legacy data where members might be stored as a map)
                  const mapMembers = householdData.members as Record<string, any>;
                  existingMembers = Object.keys(mapMembers).map(id => ({ id, ...mapMembers[id] }));
                }
                
                const updatedMemberIds = [...(householdData.memberIds || []), user.id];
                const newMember = {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  role: 'member',
                  status: 'active',
                  joinedAt: new Date().toISOString()
                };
                const updatedMembers = [...existingMembers, newMember];
                
                await DatabaseMonitoringService.updateDoc(householdRef, {
                  memberIds: updatedMemberIds,
                  members: updatedMembers,
                  updatedAt: serverTimestamp()
                });
              }
              
            } catch (error) {
              console.error('Error joining household:', error);
              throw error;
            }
          }
          break;
      }

      // Mark notification as read - try both methods
      try {
        await markNotificationRead(user.id, notification.id);
      } catch (error) {
        // If top-level update fails, try updating in cache
        await updateNotificationInCache(user.id, notification.id, { read: true });
      }
      
      await loadNotifications(); // Refresh the list
    } catch (error) {
      console.error('Error accepting notification:', error);
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
      await loadNotifications(); // Refresh the list
    } catch (error) {
      console.error('Error snoozing notification:', error);
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
      } catch (error) {
        // If top-level update fails, try updating in cache
        await updateNotificationInCache(user.id, notification.id, { read: true });
      }
      await loadNotifications(); // Refresh the list
    } catch (error) {
      console.error('Error dismissing notification:', error);
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

  if (loading) {
    return (
      <div className="bg-theme-secondary rounded-xl border border-theme p-4">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-theme-primary">Pending Notifications</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500"></div>
          <span className="ml-2 text-theme-secondary">Loading notifications...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-theme-primary">Pending Notifications</h3>
          {notifications.length > 0 && (
            <span className="bg-amber-500 text-black text-xs px-2 py-1 rounded-full font-medium">
              {notifications.length}
            </span>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-8">
          <Bell className="w-12 h-12 text-theme-secondary mx-auto mb-3 opacity-50" />
          <p className="text-theme-secondary">No pending notifications</p>
          <p className="text-sm text-theme-secondary mt-1">You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`border rounded-lg p-3 ${getPriorityColor(notification.priority)} bg-theme-primary/50`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getPriorityIcon(notification.priority)}
                  <span className="text-sm font-medium text-theme-primary capitalize">
                    {notification.type.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-xs text-theme-secondary">
                  {(() => {
                    const v: any = notification.createdAt;
                    let d: Date | null = null;
                    if (!v) return '—';
                    if (typeof v.toDate === 'function') d = v.toDate();
                    else if (typeof v.toMillis === 'function') d = new Date(v.toMillis());
                    else if (typeof v === 'string' || typeof v === 'number') d = new Date(v as any);
                    return d ? d.toLocaleDateString() : '—';
                  })()}
                </span>
              </div>

              <h4 className="font-medium text-theme-primary mb-1">{notification.title}</h4>
              <p className="text-sm text-theme-secondary mb-3">{notification.message}</p>

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
            </div>
          ))}
        </div>
      )}
    </div>
  );
};