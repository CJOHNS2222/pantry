import { useEffect, useCallback } from 'react';
import { User, PantryItem, Household } from '../types';
import { Tab } from '../types/app';
import { AppNotification, NotificationService } from '../services/notificationService';
import { markNotificationRead, deleteNotification, snoozeNotificationInCache, updateNotificationInCache } from '../services/notificationsService';
import { joinHousehold } from '../services/householdService';
import { migrateUserDataToHousehold } from '../services/householdMigrationService';
import { log } from '../services/logService';

interface UseNotificationHandlersProps {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setHousehold: (household: Household | null) => void;
  inventory: PantryItem[];
  addToShoppingList: (items: (string | { item: string; source: string; notes?: string })[]) => void;
  setActiveTab: (tab: Tab) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning', ttl?: number, actionLabel?: string, action?: () => void) => void;
  setNotifications: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  setShowHouseholdInviteModal: (show: boolean) => void;
  householdInvites: AppNotification[];
  setHouseholdInvites: React.Dispatch<React.SetStateAction<AppNotification[]>>;
  setExpiredItemsModalSpecificItems: (items: PantryItem[] | undefined) => void;
  setShowExpiredItemsModal: (show: boolean) => void;
  setNotificationViewItem: (item: { item: PantryItem; index: number } | null) => void;
}

export function useNotificationHandlers({
  user,
  setUser,
  setHousehold,
  inventory,
  addToShoppingList,
  setActiveTab,
  addToast,
  setNotifications,
  setShowHouseholdInviteModal,
  householdInvites,
  setHouseholdInvites,
  setExpiredItemsModalSpecificItems,
  setShowExpiredItemsModal,
  setNotificationViewItem,
}: UseNotificationHandlersProps) {

  // Check for household invites when user logs in
  useEffect(() => {
    const checkHouseholdInvites = async () => {
      if (!user) return;

      log.debug('Checking household invites for user', { userId: user.id });

      if (user.email) {
        await NotificationService.migrateRootInviteNotifications(user.id, user.email);
      }

      if (!user.householdId) {
        try {
          const unreadNotifications = await NotificationService.getUnreadNotifications(user.id, user.email);
          log.debug('Unread notifications count:', unreadNotifications.length);
          const invites = unreadNotifications.filter(n => n.type === 'household_invite' && n.actionType === 'join_household');
          log.debug('Household invites found:', invites.length);
          if (invites.length > 0) {
            setHouseholdInvites(invites);
            setShowHouseholdInviteModal(true);
            addToast(
              `You have ${invites.length === 1 ? 'a household invitation' : `${invites.length} household invitations`}!`,
              'info',
              0,
              'View',
              () => setShowHouseholdInviteModal(true)
            );
          }
        } catch (error) {
          log.error('Error checking household invites', { error }, 'App');
        }
      }

      localStorage.removeItem('lastNotificationShown');
    };

    checkHouseholdInvites();
  }, [user?.id, user?.email, user?.householdId, addToast, setHouseholdInvites, setShowHouseholdInviteModal]);

  const handleNotificationDismiss = useCallback(async (notificationId: string) => {
    try {
      if (user?.id) await markNotificationRead(user.id, notificationId);
      else await NotificationService.markAsRead('', notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      log.error('Failed to mark read', { err }, 'App');
    }
  }, [user, setNotifications]);

  const handleNotificationAction = useCallback(async (notification: AppNotification) => {
    try {
      if (user && user.id) {
        try {
          await markNotificationRead(user.id, notification.id);
        } catch {
          await updateNotificationInCache(user.id, notification.id, { read: true });
        }
      } else {
        await NotificationService.markAsRead('', notification.id);
      }
      setNotifications(prev => prev.filter(n => n.id !== notification.id));

      const actionData = notification.actionData;
      switch (notification.actionType) {
        case 'add_to_shopping':
          if (actionData?.itemName) {
            addToShoppingList([actionData.itemName]);
            addToast(`Added "${actionData.itemName}" to shopping list`, 'success');
          } else if (actionData?.items?.[0]?.itemName) {
            const names = actionData.items.map((i: {itemName: string}) => i.itemName) as string[];
            addToShoppingList(names);
            addToast(`Added ${names.length} item${names.length > 1 ? 's' : ''} to shopping list`, 'success');
          }
          break;
        case 'view_recipe':
          setActiveTab(Tab.RECIPES);
          addToast('Viewing your saved recipes', 'info');
          break;
        case 'view_item': {
          const notificationItems = actionData?.items;
          if (notificationItems && notificationItems.length > 1) {
            const specificItems = notificationItems
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((item: any) => inventory.find(invItem => invItem.id === item.itemId))
              .filter((item: PantryItem | undefined): item is PantryItem => item !== undefined);
            
            if (specificItems.length > 0) {
              setExpiredItemsModalSpecificItems(specificItems);
              setShowExpiredItemsModal(true);
            } else {
              addToast('Items no longer found in pantry', 'info');
            }
          } else if (actionData?.filterAttention) {
            try {
              sessionStorage.setItem('pantry-filter-attention', 'true');
            } catch { /* ignore */ }
            setActiveTab(Tab.PANTRY);
            window.dispatchEvent(new Event('apply-attention-filter'));
          } else {
            const itemId = actionData?.items?.[0]?.itemId ?? actionData?.itemId;
            const found = itemId ? inventory.findIndex(i => i.id === itemId) : -1;
            if (found !== -1) {
              setActiveTab(Tab.PANTRY);
              setNotificationViewItem({ item: inventory[found], index: found });
            } else if (actionData?.tab === 'shopping') {
              setActiveTab(Tab.SHOPPING);
            } else {
              setActiveTab(Tab.PANTRY);
              addToast('Item no longer found in pantry', 'info');
            }
          }
          break;
        }
        case 'join_household':
          if (actionData?.householdId && user) {
            try {
              const updatedHousehold = await joinHousehold(actionData.householdId, user);
              if (updatedHousehold) {
                setUser({ ...user, householdId: actionData.householdId });
                setHousehold(updatedHousehold);
                addToast('Successfully joined household!', 'success');
              } else {
                addToast('Failed to join household - invitation not found', 'error');
              }
            } catch (error: unknown) {
              log.error('Error joining household', { error }, 'App');
              let message = 'Failed to join household';
              if (error instanceof Error && error.message?.includes('not invited')) {
                message = 'Unable to join: You are not invited to this household or have already joined';
              }
              addToast(message, 'error');
            }
          }
          break;
      }
    } catch (error) {
      log.error('Error handling notification action', { error }, 'App');
      addToast('Failed to process notification', 'error');
    }
  }, [user, setNotifications, addToShoppingList, addToast, setActiveTab, inventory, setExpiredItemsModalSpecificItems, setShowExpiredItemsModal, setNotificationViewItem, setUser, setHousehold]);

  const handleNotificationSnooze = useCallback(async (notificationId: string, minutes: number) => {
    try {
      if (user?.id) await snoozeNotificationInCache(user.id, notificationId, minutes);
      else await NotificationService.snoozeNotification('', notificationId, minutes);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      log.error('Failed to snooze notification', { err }, 'App');
    }
  }, [user, setNotifications]);

  const handleHouseholdInviteAccept = useCallback(async (invite: AppNotification) => {
    if (!user) return;
    try {
      await markNotificationRead(user.id, invite.id);
      const updatedHousehold = await joinHousehold(invite.actionData.householdId, user);
      
      if (updatedHousehold) {
        const joinedHouseholdId = invite.actionData.householdId;
        setUser({ ...user, householdId: joinedHouseholdId });
        setHousehold(updatedHousehold);
        setHouseholdInvites(prev => prev.filter(i => i.id !== invite.id));
        
        if (householdInvites.length <= 1) {
          setShowHouseholdInviteModal(false);
        }

        const migrationOk = await migrateUserDataToHousehold(joinedHouseholdId, user.id);
        
        addToast(
          migrationOk
            ? 'Successfully joined household! Your personal data has been merged in.'
            : 'Joined household, but some data could not be migrated. You can retry from Settings.',
          migrationOk ? 'success' : 'warning'
        );
      } else {
        addToast('Failed to join household - invitation not found', 'error');
      }
    } catch (error: unknown) {
      log.error('Error accepting household invite', { error }, 'App');
      let message = 'Failed to join household';
      if (error instanceof Error && error.message?.includes('not invited')) {
        message = 'Unable to join: You are not invited to this household or have already joined';
      }
      addToast(message, 'error');
    }
  }, [user, setUser, setHousehold, setHouseholdInvites, householdInvites.length, setShowHouseholdInviteModal, addToast]);

  const handleHouseholdInviteDecline = useCallback(async (invite: AppNotification) => {
    if (!user) return;
    try {
      await deleteNotification(user.id, invite.id);
      setHouseholdInvites(prev => prev.filter(i => i.id !== invite.id));
      
      if (householdInvites.length <= 1) {
        setShowHouseholdInviteModal(false);
      }
      
      addToast('Household invitation declined and removed', 'info');
    } catch (error: unknown) {
      log.error('Error declining household invite', { error }, 'App');
      addToast('Failed to decline invitation', 'error');
    }
  }, [user, setHouseholdInvites, householdInvites.length, setShowHouseholdInviteModal, addToast]);

  return {
    handleNotificationDismiss,
    handleNotificationAction,
    handleNotificationSnooze,
    handleHouseholdInviteAccept,
    handleHouseholdInviteDecline,
  };
}
