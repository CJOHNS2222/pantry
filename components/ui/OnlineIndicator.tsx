import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';

interface OnlineIndicatorProps {
  isOnline: boolean;
  className?: string;
}

export const OnlineIndicator: React.FC<OnlineIndicatorProps> = ({
  isOnline,
  className = ''
}) => {
  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      title={isOnline ? 'Online' : 'Offline'}
      aria-label={isOnline ? 'Online' : 'Offline'}
    >
      <div
        className={`inline-flex items-center justify-center w-3 h-3 rounded-full ${
          isOnline ? 'bg-green-500' : 'bg-orange-500'
        }`}
      >
        {isOnline ? (
          <Wifi className="w-2 h-2 text-white" />
        ) : (
          <WifiOff className="w-2 h-2 text-white" />
        )}
      </div>
      <span className="text-xs text-theme-secondary opacity-70">
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  );
};