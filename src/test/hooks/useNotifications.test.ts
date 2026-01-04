import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNotifications } from '../../../hooks/useNotifications';

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false), // Mock as web platform for tests
  },
}));

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not schedule notifications on web platform', () => {
    const settings = {
      enabled: true,
      time: '09:00',
      types: {
        shoppingList: true,
        mealPlan: true,
      },
    };

    const { result } = renderHook(() => useNotifications(settings, 'test@example.com', []));

    // Should not throw any errors
    expect(result.current).toEqual({});
  });

  it('should handle disabled notifications', () => {
    const settings = {
      enabled: false,
      time: '09:00',
      types: {
        shoppingList: true,
        mealPlan: true,
      },
    };

    const { result } = renderHook(() => useNotifications(settings, 'test@example.com', []));

    expect(result.current).toEqual({});
  });

  it('should handle missing user email', () => {
    const settings = {
      enabled: true,
      time: '09:00',
      types: {
        shoppingList: true,
        mealPlan: true,
      },
    };

    const { result } = renderHook(() => useNotifications(settings, undefined, []));

    expect(result.current).toEqual({});
  });
});