import React from 'react';
import { Household, Member } from '../types';
import { Users, Clock } from 'lucide-react';

interface HouseholdStatusIndicatorProps {
  household: Household;
  currentUserId: string;
}

export const HouseholdStatusIndicator: React.FC<HouseholdStatusIndicatorProps> = ({
  household,
  currentUserId
}) => {
  // Helper to read live activity data for a member from the memberActivity map
  const getActivity = (memberId: string) => household.memberActivity?.[memberId] ?? {};

  // Filter out current user and get other active members
  const otherMembers = household.members.filter(m => m.id !== currentUserId && m.status === 'active');

  if (otherMembers.length === 0) {
    return null;
  }

  // Members whose isOnline flag is true AND have been seen within the last 5 minutes.
  // If someone closes the app without logging out, isOnline stays true but lastSeen
  // stops updating — so we require both signals to avoid stale "online" indicators.
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

  const onlineMembers = otherMembers.filter(m => isConsideredOnline(m.id));

  // Members with a lastSeen within the last 30 minutes (but not counted as actively online)
  const recentlyActiveMembers = otherMembers.filter(m => {
    const rawLastSeen = getActivity(m.id).lastSeen;
    if (!rawLastSeen) return false;
    const lastSeen = typeof rawLastSeen === 'object' && rawLastSeen?.toDate
      ? rawLastSeen.toDate()
      : new Date(rawLastSeen as string);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    return lastSeen > thirtyMinutesAgo && !isConsideredOnline(m.id);
  });

  const getTimeAgo = (rawTime: any) => {
    if (!rawTime) return '';
    const time = typeof rawTime === 'object' && rawTime?.toDate
      ? rawTime.toDate()
      : new Date(rawTime as string);
    if (isNaN(time.getTime())) return '';
    const diffMs = Date.now() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return time.toLocaleDateString();
  };

  // Build at most 2 display lines.
  // Line 1: first online/recently-active member by name
  // Line 2: "+N other" summary if there are more, or a single recently-active member
  const offlineRecent = recentlyActiveMembers;
  const lines: { color: string; dot?: 'green' | 'amber'; text: string }[] = [];

  if (onlineMembers.length >= 1) {
    lines.push({ color: 'text-green-400', dot: 'green', text: `${onlineMembers[0].name} is online` });
    const remaining = onlineMembers.length - 1;
    if (remaining > 0) {
      lines.push({ color: 'text-green-400/70', text: `+${remaining} other${remaining > 1 ? 's' : ''} online` });
    } else if (offlineRecent.length > 0) {
      lines.push({ color: 'text-amber-500/60', dot: 'amber', text: `${offlineRecent[0].name} was active ${getTimeAgo(getActivity(offlineRecent[0].id).lastSeen)}` });
    }
  } else if (offlineRecent.length >= 1) {
    lines.push({ color: 'text-amber-500/60', dot: 'amber', text: `${offlineRecent[0].name} was active ${getTimeAgo(getActivity(offlineRecent[0].id).lastSeen)}` });
    const remaining = offlineRecent.length - 1;
    if (remaining > 0) {
      lines.push({ color: 'text-amber-500/40', text: `+${remaining} other${remaining > 1 ? 's' : ''} recently active` });
    }
  } else if (otherMembers.length > 0) {
    lines.push({
      color: 'text-red-200/40',
      text: otherMembers.length === 1
        ? `${otherMembers[0].name} hasn't been active recently`
        : `${otherMembers.length} members inactive`
    });
  }

  return (
    <div className="flex items-start gap-2 px-3 py-1.5 bg-[#2A0A10]/80 border border-amber-500/20 rounded-lg backdrop-blur-sm">
      <Users className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
      <div className="flex flex-col gap-0.5">
        {lines.slice(0, 2).map((line, i) => (
          <div key={i} className="flex items-center gap-1">
            {line.dot === 'green' && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />}
            {line.dot === 'amber' && <Clock className="w-3 h-3 text-amber-500/60 flex-shrink-0" />}
            {!line.dot && <div className="w-2 h-2 flex-shrink-0" />}
            <span className={`text-xs ${line.color} leading-tight`}>{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};