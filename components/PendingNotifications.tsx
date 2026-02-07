import React, { useState, useEffect } from 'react';
import { Bell, Clock, Check, X, AlertCircle } from 'lucide-react';
import { NotificationService, NotificationItem } from '../services/notificationService';
import { User } from '../types';
import { doc, updateDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';

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

  useEffect(() => {
    loadNotifications();
  }, [user.id]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const unreadNotifications = await NotificationService.getUnreadNotifications(user.id, user.email);
      setNotifications(unreadNotifications);
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
        case 'add_to_shopping':
          // Add item to shopping list
          if (notification.actionData?.item) {
            // This would need to be implemented based on your shopping list service
            console.log('Adding to shopping list:', notification.actionData.item);
          }
          break;
        case 'view_recipe':
          // Navigate to recipe
          if (notification.actionData?.recipeId) {
            console.log('Viewing recipe:', notification.actionData.recipeId);
          }
          break;
        case 'join_household':
          // Join household invitation
          if (notification.actionData?.householdId) {
            try {
              // Update user document with householdId
              const userRef = doc(db, 'users', user.id);
              await updateDoc(userRef, {
                householdId: notification.actionData.householdId,
                updatedAt: serverTimestamp()
              });

              // Update household document to add member
              const householdRef = doc(db, 'households', notification.actionData.householdId);
              const householdDoc = await getDoc(householdRef);
              
              if (householdDoc.exists()) {
                const householdData = householdDoc.data();
                const updatedMemberIds = [...(householdData.memberIds || []), user.id];
                const newMember = {
                  id: user.id,
                  name: user.name,
                  email: user.email,
                  role: 'member',
                  status: 'Active',
                  joinedAt: new Date().toISOString()
                };
                const updatedMembers = [...(householdData.members || []), newMember];
                
                await updateDoc(householdRef, {
                  memberIds: updatedMemberIds,
                  members: updatedMembers,
                  updatedAt: serverTimestamp()
                });
              }
              
              console.log('Joined household:', notification.actionData.householdId);
            } catch (error) {
              console.error('Error joining household:', error);
              throw error;
            }
          }
          break;
      }

      await NotificationService.markAsRead(notification.id);
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
      await NotificationService.snoozeNotification(notification.id, minutes);
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
      await NotificationService.markAsRead(notification.id);
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
                  {notification.createdAt.toDate().toLocaleDateString()}
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