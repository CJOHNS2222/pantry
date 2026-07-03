import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Sun, Moon, Undo2, Bell } from 'lucide-react';
import { User, Household, HouseholdActivity } from '../../types';
import { log } from '../../services/logService';
import { HouseholdActivityFeed } from '../household/HouseholdActivityFeed';
import { SyncIndicator } from '../ui/SyncIndicator';
import { OnlineIndicator } from '../ui/OnlineIndicator';
import { SyncStatus } from '../../hooks/useOfflineStatus';
import useUserNotifications from '../../hooks/useUserNotifications';
import { markAllNotificationsRead, markNotificationRead, deleteNotification, NotificationItem } from '../../services/notificationsService';
import { AppSettings } from '../../hooks/useSettings';
import { UndoAction } from '../../services/undoService';

interface AppHeaderProps {
  user: User;
  household: Household | null;
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onShowHousehold: () => void;
  recentActions?: UndoAction[];
  onUndo?: (action: UndoAction) => void;
  syncStatus: SyncStatus;
  onSyncClick?: () => void;
  onNavigateToSettings?: () => void;
  onNotificationAction?: (notification: NotificationItem) => void;
  recentActivities?: HouseholdActivity[];
  isLoadingActivities?: boolean;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  user,
  household,
  settings,
  setSettings,
  onShowHousehold,
  recentActions = [],
  onUndo,
  syncStatus,
  onSyncClick,
  onNavigateToSettings,
  onNotificationAction,
  recentActivities = [],
  isLoadingActivities = false
}) => {
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const [showNotifications, setShowNotifications] = useState(false);
  const [showActivityFeed, setShowActivityFeed] = useState(false);
  const [expandedNotifId, setExpandedNotifId] = useState<string | null>(null);
  const [visibleNotifCount, setVisibleNotifCount] = useState(50);
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const swipeLocked = useRef<'h' | 'v' | null>(null);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifPanelActiveRef = useRef(false);
  const notificationsContainerRef = useRef<HTMLDivElement>(null);
  const activityFeedContainerRef = useRef<HTMLDivElement>(null);
  const throttleMs = 5000; // UI update throttle for notifications
  const { items } = useUserNotifications(user?.id, throttleMs);
  const unreadNotificationsCount = (items || []).filter(i => !i.read).length;

  const clearNotifTimer = () => {
    if (notifTimerRef.current) {
      clearTimeout(notifTimerRef.current);
      notifTimerRef.current = null;
    }
  };

  const closeNotifications = useCallback(() => {
    notifPanelActiveRef.current = false;
    clearNotifTimer();
    setShowNotifications(false);
    setExpandedNotifId(null);
  }, []);

  const closeActivityFeed = useCallback(() => {
    setShowActivityFeed(false);
  }, []);

  const scheduleNotifTimer = (delayMs = 15000) => {
    clearNotifTimer();
    if (!showNotifications || notifPanelActiveRef.current) return;
    notifTimerRef.current = setTimeout(() => setShowNotifications(false), delayMs);
  };

  useEffect(() => {
    if (showNotifications) {
      scheduleNotifTimer(15000);
      return clearNotifTimer;
    }

    notifPanelActiveRef.current = false;
    clearNotifTimer();
    return undefined;
  }, [showNotifications]);

  const handleNotifPanelMouseEnter = () => {
    notifPanelActiveRef.current = true;
    clearNotifTimer();
  };

  const handleNotifPanelMouseLeave = () => {
    notifPanelActiveRef.current = false;
    scheduleNotifTimer(5000);
  };

  const handleNotifPanelTouchStart = () => {
    notifPanelActiveRef.current = true;
    clearNotifTimer();
  };

  const handleNotifPanelTouchEnd = () => {
    notifPanelActiveRef.current = false;
    scheduleNotifTimer(5000);
  };

  const handleToggleNotifications = () => {
    setShowActivityFeed(false);
    setShowNotifications(prev => {
      if (prev) {
        closeNotifications();
      }
      return !prev;
    });
  };

  const handleToggleActivityFeed = () => {
    closeNotifications();
    setShowActivityFeed(prev => !prev);
  };

  const handleNotificationBellDoubleClick = () => {
    if (onNavigateToSettings) {
      onNavigateToSettings();
    }
  };

  const handleMarkAllRead = async () => {
    if (!user?.id) return;
    try {
      await markAllNotificationsRead(user.id);
    } catch (err) {
      log.error('Failed to mark notifications read', err instanceof Error ? { message: err.message } : { err }, 'AppHeader');
    }
  };

  const handleMarkOneRead = async (notifId: string) => {
    if (!user?.id) return;
    try {
      await markNotificationRead(user.id, notifId);
    } catch (err) {
      log.error('Failed to mark notification read', err instanceof Error ? { message: err.message } : { err }, 'AppHeader');
    }
  };

  const handleDismissNotification = async (notifId: string) => {
    if (!user?.id) return;
    try {
      await deleteNotification(user.id, notifId);
    } catch (err) {
      log.error('Failed to dismiss notification', err instanceof Error ? { message: err.message } : { err }, 'AppHeader');
    }
  };

  const SWIPE_DISMISS_THRESHOLD = 80;

  const handleSwipeTouchStart = (e: React.TouchEvent, notifId: string) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    swipeLocked.current = null;
    setSwipingId(notifId);
    setSwipeX(0);
  };

  const handleSwipeTouchMove = (e: React.TouchEvent, notifId: string) => {
    if (swipingId !== notifId) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!swipeLocked.current) {
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
        swipeLocked.current = 'h';
      } else if (Math.abs(dy) > 6) {
        swipeLocked.current = 'v';
        setSwipingId(null);
        setSwipeX(0);
        return;
      }
    }
    if (swipeLocked.current === 'h' && dx < 0) {
      e.preventDefault();
      setSwipeX(dx);
    }
  };

  const handleSwipeTouchEnd = async (notifId: string) => {
    if (swipeX < -SWIPE_DISMISS_THRESHOLD) {
      await handleDismissNotification(notifId);
    }
    setSwipingId(null);
    setSwipeX(0);
    swipeLocked.current = null;
  };

  const handleNotifActionClick = (e: React.MouseEvent, n: NotificationItem) => {
    e.stopPropagation();
    closeNotifications();
    onNotificationAction?.(n);
  };

  const handleToggleExpand = (notifId: string) => {
    setExpandedNotifId(prev => prev === notifId ? null : notifId);
    scheduleNotifTimer(10000);
  };

  useEffect(() => {
    if (!showNotifications && !showActivityFeed) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeNotifications();
        closeActivityFeed();
      }
    };

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        showNotifications &&
        notificationsContainerRef.current &&
        !notificationsContainerRef.current.contains(event.target as Node)
      ) {
        closeNotifications();
      }
      if (
        showActivityFeed &&
        activityFeedContainerRef.current &&
        !activityFeedContainerRef.current.contains(event.target as Node)
      ) {
        closeActivityFeed();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showNotifications, showActivityFeed, closeNotifications, closeActivityFeed]);

  const getNotifTimeAgo = (ts: unknown): string => {
    if (!ts) return '';
    const firestoreTs = ts as { toDate?: () => Date };
    const time = firestoreTs.toDate ? firestoreTs.toDate() : new Date(ts as string | number | Date);
    if (isNaN(time.getTime())) return '';
    const diffMs = Date.now() - time.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return time.toLocaleDateString();
  };

  const priorityBadge = (priority?: string) => {
    if (!priority || priority === 'low') return null;
    const styles: Record<string, string> = {
      urgent: 'bg-red-500/20 text-red-400',
      high: 'bg-orange-500/20 text-orange-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
    };
    return (
      <span className={`text-[10px] px-1 rounded font-medium ${styles[priority] ?? ''}`}>
        {priority}
      </span>
    );
  };
  const activityText = useMemo(() => {
    if (!household) return '';
    
    // Filter out current user and get other active members
    const otherMembers = household.members.filter(m => m.id !== user.id && m.status === 'active');
    if (otherMembers.length === 0) return '';

    const getActivity = (memberId: string) => household.memberActivity?.[memberId] ?? {};
    
    const ONLINE_WINDOW_MS = 5 * 60 * 1000;
    const isConsideredOnline = (memberId: string) => {
      const activity = getActivity(memberId);
      if (!activity.isOnline) return false;
      const rawLastSeen = activity.lastSeen;
      if (!rawLastSeen) return false;
      const lastSeen = typeof rawLastSeen === 'object' && rawLastSeen?.toDate
        ? rawLastSeen.toDate()
        : new Date(rawLastSeen as string);
      return lastSeen > new Date(Date.now() - ONLINE_WINDOW_MS);
    };

    const onlineMembersWithActivity = otherMembers
      .filter(m => isConsideredOnline(m.id))
      .map(m => {
        const activity = getActivity(m.id);
        const activityStr = activity.currentActivity || 'using app';
        return {
          name: m.name.split(' ')[0],
          activity: activityStr
        };
      });

    if (onlineMembersWithActivity.length === 0) {
      // Find recently active member
      const recentlyActive = otherMembers
        .map(m => {
          const activity = getActivity(m.id);
          const rawLastSeen = activity.lastSeen;
          const lastSeen = rawLastSeen
            ? (typeof rawLastSeen === 'object' && rawLastSeen?.toDate ? rawLastSeen.toDate() : new Date(rawLastSeen as string))
            : null;
          return { member: m, lastSeen };
        })
        .filter(item => item.lastSeen !== null)
        .sort((a, b) => (b.lastSeen?.getTime() || 0) - (a.lastSeen?.getTime() || 0))[0];

      if (recentlyActive && recentlyActive.lastSeen) {
        const diffMs = Date.now() - recentlyActive.lastSeen.getTime();
        const diffMins = Math.floor(diffMs / (1000 * 60));
        if (diffMins < 30) {
          const name = recentlyActive.member.name.split(' ')[0];
          return `${name} was active recently`;
        }
      }
      return '';
    }

    // Format online members' activity
    if (onlineMembersWithActivity.length === 1) {
      const m = onlineMembersWithActivity[0];
      return `${m.name} is ${m.activity}`;
    } else if (onlineMembersWithActivity.length === 2) {
      const m1 = onlineMembersWithActivity[0];
      const m2 = onlineMembersWithActivity[1];
      return `${m1.name} & ${m2.name} are active`;
    } else {
      return `${onlineMembersWithActivity.length} members are active`;
    }
  }, [household, user.id]);

  return (
    <header 
      className="bg-theme-secondary p-3 fixed top-0 left-0 right-0 max-w-md mx-auto z-20 shadow-md border-b border-theme transition-colors duration-300"
      style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      role="banner"
    >
      <div className="flex justify-between items-center">
        <div className="flex flex-col items-start min-w-0 flex-shrink">
          <div className="w-full mb-1">
            <div className="text-xs font-medium text-theme-primary opacity-80 text-center" id="user-email">
              <span className="block">{greeting},</span>
              <span className="block">{(user.profile?.name || user.name || user.email.split('@')[0]).split(' ')[0]}!</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              data-tutorial="household-button"
              onClick={onShowHousehold}
              className="flex items-center px-1 py-1 rounded-full hover:bg-black/5 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
              aria-label={`Switch household or account. Current user: ${user.name}`}
              aria-describedby="user-email"
            >
              {user.avatar ? (
                <img 
                  src={user.avatar} 
                  className="w-7 h-7 rounded-full border border-theme" 
                  alt={`${user.name}'s profile picture`}
                />
              ) : (
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white" 
                  style={{backgroundColor: 'var(--accent-color)'}}
                  aria-hidden="true"
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </button>
            {user?.id && (
              <div className="relative" ref={notificationsContainerRef}>
                <button
                  onClick={handleToggleNotifications}
                  onDoubleClick={handleNotificationBellDoubleClick}
                  className="relative p-1 text-amber-500 hover:text-amber-400 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 rounded"
                  aria-label={`${unreadNotificationsCount} unread notifications`}
                  title="Click to view notifications, double-click to view pending notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-medium text-[10px]">
                      {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                    </span>
                  )}
                </button>
 
                {/* Notification bell */}
                {showNotifications && (
                  <div
                    className="absolute left-0 mt-2 w-80 max-w-[calc(100vw-1rem)] max-h-96 overflow-auto bg-theme-primary border border-theme rounded shadow-lg z-50 p-2"
                    onMouseEnter={handleNotifPanelMouseEnter}
                    onMouseLeave={handleNotifPanelMouseLeave}
                    onTouchStart={handleNotifPanelTouchStart}
                    onTouchEnd={handleNotifPanelTouchEnd}
                    onFocusCapture={handleNotifPanelMouseEnter}
                    onBlurCapture={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                        handleNotifPanelMouseLeave();
                      }
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold">Notifications</div>
                      <div className="flex items-center gap-2">
                        <button onClick={handleMarkAllRead} className="text-xs text-theme-secondary hover:underline">Mark all read</button>
                        <button onClick={closeNotifications} className="text-xs text-theme-secondary hover:text-theme-primary transition-colors px-1" aria-label="Close notifications">
                          ✕
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {(items || []).filter(n => !n.read).slice().reverse().slice(0, visibleNotifCount).map((n: NotificationItem) => {
                        const isExpanded = expandedNotifId === n.id;
                        const bodyText = n.message || n.body;
                        const isSwiping = swipingId === n.id;
                        const currentSwipeX = isSwiping ? swipeX : 0;
                        const isPastThreshold = currentSwipeX < -SWIPE_DISMISS_THRESHOLD;
                        return (
                          <div
                            key={n.id}
                            className="relative overflow-hidden rounded"
                            onTouchStart={e => handleSwipeTouchStart(e, n.id)}
                            onTouchMove={e => handleSwipeTouchMove(e, n.id)}
                            onTouchEnd={() => handleSwipeTouchEnd(n.id)}
                          >
                            {/* Swipe-reveal dismiss background */}
                            <div
                              className={`absolute inset-0 flex items-center justify-end px-3 rounded transition-colors ${isPastThreshold ? 'bg-red-500' : 'bg-red-500/70'}`}
                              aria-hidden="true"
                            >
                              <span className="text-white text-xs font-semibold">Dismiss</span>
                            </div>
                          <div
                            className={`p-2 rounded cursor-pointer transition-colors relative ${
                              n.read
                                ? 'bg-theme-secondary/40 hover:bg-theme-secondary/70'
                                : 'bg-amber-500/10 border-l-2 border-amber-500/60 hover:bg-amber-500/20'
                            }`}
                            style={{
                              transform: `translateX(${currentSwipeX}px)`,
                              transition: isSwiping ? 'none' : 'transform 0.2s ease',
                            }}
                            onClick={() => !isSwiping && handleToggleExpand(n.id)}
                          >
                            {/* Title row */}
                            <div className="flex items-start justify-between gap-1">
                              <div className="text-sm font-medium flex-1 leading-tight">{n.title}</div>
                              <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                                {priorityBadge(n.priority)}
                                {!n.read && (
                                  <button
                                    type="button"
                                    onTouchStart={e => e.stopPropagation()}
                                    onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); handleMarkOneRead(n.id); }}
                                    onClick={e => { e.stopPropagation(); handleMarkOneRead(n.id); }}
                                    className="flex items-center justify-center min-w-[28px] min-h-[28px] text-xs text-theme-secondary hover:text-green-400 active:text-green-400 transition-colors rounded"
                                    title="Mark as read"
                                    aria-label="Mark notification as read"
                                  >✓</button>
                                )}
                                <button
                                  type="button"
                                  onTouchStart={e => e.stopPropagation()}
                                  onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); handleDismissNotification(n.id); }}
                                  onClick={e => { e.stopPropagation(); handleDismissNotification(n.id); }}
                                  className="flex items-center justify-center min-w-[28px] min-h-[28px] text-xs text-theme-secondary hover:text-red-400 active:text-red-400 transition-colors rounded"
                                  title="Dismiss notification"
                                  aria-label="Dismiss notification"
                                >✕</button>
                              </div>
                            </div>
 
                            {/* Body — collapsed = 1 line, expanded = full */}
                            {bodyText && (
                              <div className={`text-xs text-theme-secondary mt-0.5 leading-snug ${isExpanded ? '' : 'line-clamp-1'}`}>
                                {bodyText}
                              </div>
                            )}
 
                            {/* Expanded details */}
                            {isExpanded && (
                              <div className="mt-1.5 space-y-1 border-t border-theme/40 pt-1.5">
                                {n.type && (
                                  <div className="text-[10px] text-theme-secondary capitalize">{n.type.replace(/_/g, ' ')}</div>
                                )}
                                {n.actionLabel && n.actionType && (
                                  <button
                                    type="button"
                                    onClick={e => handleNotifActionClick(e, n)}
                                    className="text-xs text-amber-500 font-medium hover:text-amber-300 underline underline-offset-2 transition-colors text-left"
                                  >
                                    {n.actionLabel}
                                  </button>
                                )}
                                {n.actionLabel && !n.actionType && (
                                  <div className="text-xs text-amber-500 font-medium">{n.actionLabel}</div>
                                )}
                              </div>
                            )}
 
                            {/* Timestamp */}
                            <div className="text-[10px] text-theme-secondary mt-1 opacity-70">
                              {getNotifTimeAgo(n.createdAt)}
                            </div>
                          </div>
                          </div>
                        );
                      })}
                      {(items || []).filter(n => !n.read).length === 0 && <div className="text-xs text-theme-secondary py-2 text-center">No unread notifications</div>}
                      {(items || []).filter(n => !n.read).length > visibleNotifCount && (
                        <button
                          onClick={() => setVisibleNotifCount(n => n + 50)}
                          className="w-full text-xs text-theme-secondary hover:text-theme-primary py-2 border-t border-theme/30 mt-1 transition-colors"
                        >
                          Load more ({(items || []).filter(n => !n.read).length - visibleNotifCount} remaining)
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center flex-1 min-w-0">
          <h1 
            className="text-2xl xs:text-3xl font-serif font-bold text-theme-primary whitespace-nowrap" 
            style={{color: 'var(--accent-color)'}}
            id="app-title"
          >
            Stock & Spoon
          </h1>
          {household && household.members.length > 1 && (
            <div className="relative mt-0.5" ref={activityFeedContainerRef}>
              <button
                onClick={handleToggleActivityFeed}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                aria-label="View household activity feed"
                title="Tap to view household activity"
              >
                {activityText ? (
                  <>
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[10px] sm:text-xs text-green-500 font-medium tracking-wide truncate max-w-[160px]">
                      {activityText}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] sm:text-xs text-theme-secondary opacity-60">
                    No active members
                  </span>
                )}
              </button>

              {showActivityFeed && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-auto bg-theme-primary border border-theme rounded shadow-lg z-50 p-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-semibold">Household Activity</div>
                    <button
                      onClick={closeActivityFeed}
                      className="text-xs text-theme-secondary hover:text-theme-primary transition-colors px-1"
                      aria-label="Close activity feed"
                    >✕</button>
                  </div>
                  <HouseholdActivityFeed
                    activities={recentActivities}
                    isLoading={isLoadingActivities}
                    maxItems={15}
                  />
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="flex items-center gap-2">
            {recentActions.length > 0 && onUndo && (
              <button
                onClick={() => onUndo(recentActions[0])}
                className="p-2 text-theme-secondary opacity-70 hover:opacity-100 relative focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
                aria-label={`Undo last action (${recentActions.length} available)`}
                title="Undo last action"
              >
                <Undo2 className="w-5 h-5" aria-hidden="true" />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {recentActions.length}
                </span>
              </button>
            )}
            <button
              data-tutorial="theme-toggle"
              onClick={() => setSettings((prev: AppSettings) => ({
                ...prev,
                theme: {
                  ...prev.theme,
                  mode: prev.theme.mode === 'dark' ? 'light' : 'dark'
                }
              }))}
              className="p-2 text-theme-secondary opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)] focus:ring-offset-2"
              aria-label={`Switch to ${settings.theme.mode === 'dark' ? 'light' : 'dark'} theme`}
            >
              {settings.theme.mode === 'dark' ? <Sun className="w-5 h-5" aria-hidden="true" /> : <Moon className="w-5 h-5" aria-hidden="true" />}
            </button>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <SyncIndicator
              syncStatus={syncStatus}
              compact={true}
              onSyncClick={onSyncClick}
            />
            <OnlineIndicator isOnline={syncStatus.isOnline} />
          </div>
        </div>
      </div>
    </header>
  );
};