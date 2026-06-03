import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn(),
  doc: vi.fn(),
  getFirestore: vi.fn(() => 'mock-db'),
}));

// Mock DatabaseMonitoringService
const mockOnSnapshot = vi.fn();
vi.mock('../../../services/databaseMonitoringService', () => ({
  default: {
    onSnapshot: mockOnSnapshot,
    doc: vi.fn((collection: string, id: string) => ({ path: `${collection}/${id}` })),
    updateDoc: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock UsageService
vi.mock('../../../services/usageService', () => ({
  UsageService: {
    updatePlanLimits: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock logService
vi.mock('../../../services/logService', () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { useSubscription } from '../../../hooks/useSubscription';

const freeUser: any = {
  id: 'user123',
  name: 'Test User',
  email: 'test@example.com',
  householdId: 'household1',
  subscription: { tier: 'free', status: 'active', current_period_end: new Date(), cancel_at_period_end: false },
};

describe('useSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('elevates non-admin member to family tier when household owner has family plan', async () => {
    // Simulate two onSnapshot calls: own subscription doc + household doc
    mockOnSnapshot.mockImplementation((_ref: any, callback: (doc: any) => void, _errCb?: any) => {
      const path = _ref?.path ?? '';
      if (path.includes('households')) {
        // Simulate household doc: user is non-admin, owner has family tier
        callback({
          exists: () => true,
          data: () => ({
            ownerSubscriptionTier: 'family',
            members: [{ id: 'user123', role: 'member' }],
          }),
        });
      } else {
        // Own subscription doc
        callback({
          data: () => ({
            subscription: { tier: 'free', status: 'active', current_period_end: new Date(), cancel_at_period_end: false },
          }),
        });
      }
      return vi.fn(); // unsubscribe
    });

    const { result } = renderHook(() => useSubscription(freeUser));

    // Wait for state updates to settle
    await act(async () => {});

    expect(result.current.effectiveTier).toBe('family');
    expect(result.current.isPremium).toBe(true);
    expect(result.current.isFamily).toBe(true);
  });

  it('does not elevate admin — admin uses own subscription tier', async () => {
    mockOnSnapshot.mockImplementation((_ref: any, callback: (doc: any) => void, _errCb?: any) => {
      const path = _ref?.path ?? '';
      if (path.includes('households')) {
        callback({
          exists: () => true,
          data: () => ({
            ownerSubscriptionTier: 'family',
            members: [{ id: 'user123', role: 'admin' }],
          }),
        });
      } else {
        callback({
          data: () => ({
            subscription: { tier: 'free', status: 'active', current_period_end: new Date(), cancel_at_period_end: false },
          }),
        });
      }
      return vi.fn();
    });

    const { result } = renderHook(() => useSubscription(freeUser));
    await act(async () => {});

    // Admin uses own free tier, not elevated
    expect(result.current.effectiveTier).toBe('free');
    expect(result.current.isPremium).toBe(false);
  });

  it('free member in a free-tier household stays free', async () => {
    mockOnSnapshot.mockImplementation((_ref: any, callback: (doc: any) => void, _errCb?: any) => {
      const path = _ref?.path ?? '';
      if (path.includes('households')) {
        callback({
          exists: () => true,
          data: () => ({
            ownerSubscriptionTier: 'free',
            members: [{ id: 'user123', role: 'member' }],
          }),
        });
      } else {
        callback({
          data: () => ({
            subscription: { tier: 'free', status: 'active', current_period_end: new Date(), cancel_at_period_end: false },
          }),
        });
      }
      return vi.fn();
    });

    const { result } = renderHook(() => useSubscription(freeUser));
    await act(async () => {});

    expect(result.current.effectiveTier).toBe('free');
    expect(result.current.isPremium).toBe(false);
  });
});
