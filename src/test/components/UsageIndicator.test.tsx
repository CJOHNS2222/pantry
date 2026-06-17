import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { UsageIndicator } from '../../../components/admin-analytics/UsageIndicator';
import { User } from '../../../types';

// Mock useSubscription hook
const mockUseSubscription = vi.fn();
vi.mock('../../../hooks/useSubscription', () => ({
  useSubscription: (...args: any[]) => mockUseSubscription(...args),
}));

// Mock UsageService
vi.mock('../../../services/usageService', () => ({
  UsageService: {
    getUsageLimits: vi.fn(),
  },
}));

describe('UsageIndicator', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockUser: User = {
    id: 'user1',
    email: 'test@example.com',
    name: 'Test User',
    householdId: 'household1',
  };

  const mockUsageLimits = {
    recipes: { used: 5, max: 10 },
    searches: { used: 15, weekly: 20, resetDate: new Date() },
    mealPlanning: { weeklyUsed: 3, weeklyRecipes: 5 },
    gemini: { used: 0, max: 0 },
  };

  it('renders nothing when loading', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isFamily: false,
      subscription: null,
    });

    const { container } = render(<UsageIndicator user={mockUser} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no user provided', () => {
    const { container } = render(<UsageIndicator user={null} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for premium users in non-compact mode', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isFamily: false,
      subscription: { status: 'active' },
    });

    // Mock UsageService.getUsageLimits
    const { UsageService } = await import('../../../services/usageService');
    vi.mocked(UsageService.getUsageLimits).mockResolvedValue(mockUsageLimits);

    const { container } = render(<UsageIndicator user={mockUser} />);

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(container.firstChild).toBeNull();
  });

  it('renders compact version for premium users when compact=true', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isFamily: false,
      subscription: { status: 'active' },
    });

    const { UsageService } = await import('../../../services/usageService');
    vi.mocked(UsageService.getUsageLimits).mockResolvedValue(mockUsageLimits);

    render(<UsageIndicator user={mockUser} compact={true} />);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(screen.getByText('Recipes: 5/10')).toBeInTheDocument();
    expect(screen.getByText('Searches: 15/20')).toBeInTheDocument();
  });

  it('renders full usage overview for free users', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isFamily: false,
      subscription: null,
    });

    const { UsageService } = await import('../../../services/usageService');
    vi.mocked(UsageService.getUsageLimits).mockResolvedValue(mockUsageLimits);

    render(<UsageIndicator user={mockUser} />);

    await new Promise(resolve => setTimeout(resolve, 0));

    // Header is always visible (collapsed by default)
    expect(screen.getByText('Free Plan')).toBeInTheDocument();

    // Expand the panel to verify detail content
    fireEvent.click(screen.getByText('Free Plan'));
    expect(screen.getByText('Saved Recipes')).toBeInTheDocument();
    expect(screen.getByText('Weekly Searches')).toBeInTheDocument();
    expect(screen.getByText('Weekly Meal Plans')).toBeInTheDocument();
  });

  it('shows warning icon when usage is high', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isFamily: false,
      subscription: null,
    });

    const highUsageLimits = {
      recipes: { used: 9, max: 10 }, // 90% - critical
      searches: { used: 15, weekly: 20, resetDate: new Date() },
      mealPlanning: { weeklyUsed: 3, weeklyRecipes: 5 },
      gemini: { used: 0, max: 0 },
    };

    const { UsageService } = await import('../../../services/usageService');
    vi.mocked(UsageService.getUsageLimits).mockResolvedValue(highUsageLimits);

    render(<UsageIndicator user={mockUser} compact={true} />);

    await new Promise(resolve => setTimeout(resolve, 0));

    // Should show warning triangle
    const alertIcon = document.querySelector('.lucide-triangle-alert');
    expect(alertIcon).toBeInTheDocument();
  });

  it('displays unlimited usage correctly', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isFamily: false,
      subscription: null,
    });

    const unlimitedUsageLimits = {
      recipes: { used: 5, max: -1 }, // Unlimited
      searches: { used: 15, weekly: 20, resetDate: new Date() },
      mealPlanning: { weeklyUsed: 3, weeklyRecipes: 5 },
      gemini: { used: 0, max: 0 },
    };

    const { UsageService } = await import('../../../services/usageService');
    vi.mocked(UsageService.getUsageLimits).mockResolvedValue(unlimitedUsageLimits);

    render(<UsageIndicator user={mockUser} compact={true} />);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(screen.getByText('Recipes: 5/∞')).toBeInTheDocument();
  });

  it('handles usage service errors gracefully', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isFamily: false,
      subscription: null,
    });

    const { UsageService } = await import('../../../services/usageService');
    vi.mocked(UsageService.getUsageLimits).mockRejectedValue(new Error('Service error'));

    const { container } = render(<UsageIndicator user={mockUser} />);

    await new Promise(resolve => setTimeout(resolve, 0));

    // Should render nothing on error
    expect(container.firstChild).toBeNull();
  });

  it('shows upgrade CTA by default', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isFamily: false,
      subscription: null,
    });

    const { UsageService } = await import('../../../services/usageService');
    vi.mocked(UsageService.getUsageLimits).mockResolvedValue(mockUsageLimits);

    render(<UsageIndicator user={mockUser} />);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(screen.getByText('Upgrade')).toBeInTheDocument();
  });

  it('hides upgrade CTA when showUpgradeCTA is false', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isFamily: false,
      subscription: null,
    });

    const { UsageService } = await import('../../../services/usageService');
    vi.mocked(UsageService.getUsageLimits).mockResolvedValue(mockUsageLimits);

    render(<UsageIndicator user={mockUser} showUpgradeCTA={false} />);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(screen.queryByText('Upgrade')).not.toBeInTheDocument();
  });

  it('calls onUpgrade when upgrade button is clicked', async () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isFamily: false,
      subscription: null,
    });

    const { UsageService } = await import('../../../services/usageService');
    vi.mocked(UsageService.getUsageLimits).mockResolvedValue(mockUsageLimits);

    const onUpgrade = vi.fn();
    render(<UsageIndicator user={mockUser} onUpgrade={onUpgrade} />);

    await new Promise(resolve => setTimeout(resolve, 0));

    const upgradeButton = screen.getByText('Upgrade');
    upgradeButton.click();

    expect(onUpgrade).toHaveBeenCalled();
  });
});