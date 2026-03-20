import React from 'react';
import { Household, Member } from '../types';
import { Users, Eye, Clock } from 'lucide-react';

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

  // Members whose isOnline flag is true in memberActivity
  const onlineMembers = otherMembers.filter(m => getActivity(m.id).isOnline === true);

  // Members with a lastSeen within the last 30 minutes
  const recentlyActiveMembers = otherMembers.filter(m => {
    const rawLastSeen = getActivity(m.id).lastSeen;
    if (!rawLastSeen) return false;
    const lastSeen = typeof rawLastSeen === 'object' && rawLastSeen?.toDate
      ? rawLastSeen.toDate()
      : new Date(rawLastSeen as string);
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    return lastSeen > thirtyMinutesAgo;
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

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#2A0A10]/80 border border-amber-500/20 rounded-lg backdrop-blur-sm">
      <Users className="w-4 h-4 text-amber-500" />

      <div className="flex items-center gap-3">
        {onlineMembers.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-400">
              {onlineMembers.length === 1
                ? `${onlineMembers[0].name} is online`
                : `${onlineMembers.length} online`
              }
            </span>
          </div>
        )}

        {onlineMembers.length > 0 && recentlyActiveMembers.length > onlineMembers.length && (
          <span className="text-xs text-red-200/50">•</span>
        )}

        {recentlyActiveMembers.filter(m => !getActivity(m.id).isOnline).length > 0 && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-500/60" />
            <span className="text-xs text-amber-500/60">
              {(() => {
                const offlineRecent = recentlyActiveMembers.filter(m => !getActivity(m.id).isOnline);
                if (offlineRecent.length === 1) {
                  return `${offlineRecent[0].name} was active ${getTimeAgo(getActivity(offlineRecent[0].id).lastSeen)}`;
                }
                return `${offlineRecent.length} recently active`;
              })()}
            </span>
          </div>
        )}

        {onlineMembers.length === 0 && recentlyActiveMembers.length === 0 && otherMembers.length > 0 && (
          <span className="text-xs text-red-200/40">
            {otherMembers.length === 1
              ? `${otherMembers[0].name} hasn't been active recently`
              : `${otherMembers.length} members inactive`
            }
          </span>
        )}
      </div>

      {/* Current activity indicators for online members */}
      {onlineMembers.some(m => getActivity(m.id).currentActivity) && (
        <div className="flex items-center gap-1 ml-2">
          <Eye className="w-3 h-3 text-amber-500/60" />
          <div className="flex gap-1">
            {onlineMembers
              .filter(m => getActivity(m.id).currentActivity)
              .slice(0, 2)
              .map((member, index, arr) => (
                <span key={member.id} className="text-xs text-amber-500/80">
                  {member.name}: {getActivity(member.id).currentActivity}
                  {index < arr.length - 1 && ','}
                </span>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
};