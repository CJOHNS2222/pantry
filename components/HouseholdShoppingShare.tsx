import React, { useState, useEffect } from 'react';
import { Users, UserCheck, Clock, MessageCircle } from 'lucide-react';

interface HouseholdMember {
  id: string;
  name: string;
  avatar?: string;
  lastActive: Date;
  currentActivity?: string;
}

interface HouseholdActivity {
  id: string;
  memberId: string;
  memberName: string;
  action: string;
  itemName?: string;
  timestamp: Date;
}

interface HouseholdShoppingShareProps {
  householdMembers: HouseholdMember[];
  recentActivity: HouseholdActivity[];
  currentUserId: string;
  onSendMessage?: (message: string) => void;
}

export const HouseholdShoppingShare: React.FC<HouseholdShoppingShareProps> = ({
  householdMembers,
  recentActivity,
  currentUserId,
  onSendMessage
}) => {
  const [showActivity, setShowActivity] = useState(false);
  const [message, setMessage] = useState('');

  const activeMembers = householdMembers.filter(member =>
    Date.now() - member.lastActive.getTime() < 24 * 60 * 60 * 1000 // Active in last 24 hours
  );

  const getActivityIcon = (action: string) => {
    if (action.includes('checked') || action.includes('bought')) return '✅';
    if (action.includes('added')) return '➕';
    if (action.includes('removed')) return '🗑️';
    return '📝';
  };

  const formatActivityTime = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const handleSendMessage = () => {
    if (message.trim() && onSendMessage) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  return (
    <div className="bg-theme-secondary rounded-xl p-4 border border-theme">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-theme-primary flex items-center gap-2">
          <Users className="w-4 h-4" />
          Household ({activeMembers.length})
        </h3>
        <button
          onClick={() => setShowActivity(!showActivity)}
          className="text-xs text-[var(--accent-color)] hover:underline"
        >
          {showActivity ? 'Hide' : 'Show'} activity
        </button>
      </div>

      {/* Active Members */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto">
        {activeMembers.slice(0, 5).map(member => (
          <div key={member.id} className="flex flex-col items-center gap-1 min-w-[50px]">
            <div className="relative">
              {member.avatar ? (
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-8 h-8 rounded-full border-2 border-theme"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[var(--accent-color)] flex items-center justify-center text-white text-xs font-bold">
                  {member.name.charAt(0).toUpperCase()}
                </div>
              )}
              {member.currentActivity && (
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </div>
              )}
            </div>
            <span className="text-xs text-theme-secondary text-center leading-tight">
              {member.name.split(' ')[0]}
            </span>
          </div>
        ))}

        {activeMembers.length > 5 && (
          <div className="flex flex-col items-center justify-center min-w-[50px]">
            <div className="w-8 h-8 rounded-full bg-theme-primary border-2 border-theme flex items-center justify-center">
              <span className="text-xs text-theme-secondary">+{activeMembers.length - 5}</span>
            </div>
          </div>
        )}
      </div>

      {/* Current Activity Summary */}
      {activeMembers.some(m => m.currentActivity) && (
        <div className="text-xs text-theme-secondary opacity-70 mb-3">
          {activeMembers
            .filter(m => m.currentActivity)
            .map(m => `${m.name.split(' ')[0]} is ${m.currentActivity}`)
            .join(', ')}
        </div>
      )}

      {/* Recent Activity */}
      {showActivity && (
        <div className="space-y-2 mb-3 animate-fade-in">
          <div className="text-xs text-theme-secondary opacity-70 mb-2">
            Recent activity:
          </div>

          {recentActivity.slice(0, 5).map(activity => (
            <div key={activity.id} className="flex items-center gap-2 text-xs">
              <span className="text-base">{getActivityIcon(activity.action)}</span>
              <div className="flex-1">
                <span className="font-medium text-theme-primary">{activity.memberName}</span>
                <span className="text-theme-secondary"> {activity.action}</span>
                {activity.itemName && (
                  <span className="font-medium text-[var(--accent-color)]"> {activity.itemName}</span>
                )}
              </div>
              <span className="text-theme-secondary opacity-60">
                {formatActivityTime(activity.timestamp)}
              </span>
            </div>
          ))}

          {recentActivity.length === 0 && (
            <div className="text-xs text-theme-secondary opacity-60 italic">
              No recent activity
            </div>
          )}
        </div>
      )}

      {/* Quick Message */}
      {onSendMessage && (
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Quick message to household..."
            className="flex-1 text-sm bg-theme-primary border border-theme rounded-lg px-3 py-2 text-theme-primary placeholder-theme-secondary/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
          />
          <button
            onClick={handleSendMessage}
            disabled={!message.trim()}
            className="px-3 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-[var(--accent-color)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <MessageCircle className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default HouseholdShoppingShare;