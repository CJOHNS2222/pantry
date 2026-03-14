import React, { useState, useRef, useCallback } from 'react';
import PullToRefresh from 'react-pull-to-refresh';

interface PullToRefreshWrapperProps {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
  disabled?: boolean;
}

export const PullToRefreshWrapper: React.FC<PullToRefreshWrapperProps> = ({
  onRefresh,
  children,
  disabled = false
}) => {
  const handleRefresh = useCallback(async () => {
    if (disabled) return;
    await onRefresh();
  }, [onRefresh, disabled]);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      style={{
        height: '100%',
        overflow: 'auto'
      }}
    >
      {children}
    </PullToRefresh>
  );
};