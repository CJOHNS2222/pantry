import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PremiumFeature, FeatureLimit } from '../../../components/settings/PremiumFeature';
import { User } from '../../../types';

// Mock useSubscription hook
const mockUseSubscription = vi.fn();
vi.mock('../../../hooks/useSubscription', () => ({
  useSubscription: (...args: any[]) => mockUseSubscription(...args),
}));

// Mock AppContext to satisfy useApp() inside PremiumFeature
const mockSetActiveTab = vi.fn();
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ setActiveTab: mockSetActiveTab }),
}));

describe('PremiumFeature', () => {
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

  it('renders children when user is premium and active', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isActive: true,
      loading: false,
    });

    render(
      <PremiumFeature feature="mealPlanning" user={mockUser}>
        <div>Premium Content</div>
      </PremiumFeature>
    );

    expect(screen.getByText('Premium Content')).toBeInTheDocument();
  });

  it('renders children when no user is logged in', () => {
    render(
      <PremiumFeature feature="mealPlanning" user={null}>
        <div>Content</div>
      </PremiumFeature>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('shows loading skeleton when subscription is loading', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isActive: false,
      loading: true,
    });

    const { container } = render(
      <PremiumFeature feature="mealPlanning" user={mockUser}>
        <div>Content</div>
      </PremiumFeature>
    );

    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('renders custom fallback when provided and limit reached', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isActive: false,
      loading: false,
    });

    render(
      <PremiumFeature
        feature="recipes"
        user={mockUser}
        limit={5}
        currentCount={5}
        fallback={<div>Custom Fallback</div>}
      >
        <div>Premium Content</div>
      </PremiumFeature>
    );

    expect(screen.getByText('Custom Fallback')).toBeInTheDocument();
    expect(screen.queryByText('Premium Content')).not.toBeInTheDocument();
  });

  it('renders upgrade modal when limit reached and no custom fallback', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isActive: false,
      loading: false,
    });

    render(
      <PremiumFeature
        feature="recipes"
        user={mockUser}
        limit={5}
        currentCount={5}
        fallbackMessage="Custom limit message"
      >
        <div>Premium Content</div>
      </PremiumFeature>
    );

    expect(screen.getByText('Ready to Unlock More?')).toBeInTheDocument();
    expect(screen.getByText('Custom limit message')).toBeInTheDocument();
    expect(screen.getByText('Upgrade Now - Starting at $4.99/mo')).toBeInTheDocument();
  });

  it('renders upgrade modal for non-premium users without limit', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isActive: false,
      loading: false,
    });

    render(
      <PremiumFeature feature="mealPlanning" user={mockUser}>
        <div>Premium Content</div>
      </PremiumFeature>
    );

    expect(screen.getByText('Premium Feature')).toBeInTheDocument();
    expect(screen.getByText(/Unlock mealPlanning and discover recipes/)).toBeInTheDocument();
    expect(screen.getByText('Try Premium Free for 7 Days')).toBeInTheDocument();
  });

  it('returns null when showUpgrade is false and limit reached', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isActive: false,
      loading: false,
    });

    const { container } = render(
      <PremiumFeature
        feature="recipes"
        user={mockUser}
        limit={5}
        currentCount={5}
        showUpgrade={false}
      >
        <div>Premium Content</div>
      </PremiumFeature>
    );

    expect(container.firstChild).toBeNull();
  });

  it('returns null when showUpgrade is false for non-premium users', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isActive: false,
      loading: false,
    });

    const { container } = render(
      <PremiumFeature feature="mealPlanning" user={mockUser} showUpgrade={false}>
        <div>Premium Content</div>
      </PremiumFeature>
    );

    expect(container.firstChild).toBeNull();
  });

  it('handles upgrade button click with custom onUpgrade', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isActive: false,
      loading: false,
    });

    const onUpgrade = vi.fn();
    render(
      <PremiumFeature feature="mealPlanning" user={mockUser} onUpgrade={onUpgrade}>
        <div>Premium Content</div>
      </PremiumFeature>
    );

    const upgradeButton = screen.getByText('Try Premium Free for 7 Days');
    fireEvent.click(upgradeButton);

    expect(onUpgrade).toHaveBeenCalled();
  });

  it('handles upgrade button click with default navigation', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isActive: false,
      loading: false,
    });

    render(
      <PremiumFeature feature="mealPlanning" user={mockUser}>
        <div>Premium Content</div>
      </PremiumFeature>
    );

    const upgradeButton = screen.getByText('Try Premium Free for 7 Days');
    fireEvent.click(upgradeButton);

    expect(mockSetActiveTab).toHaveBeenCalled();
  });
});

describe('FeatureLimit', () => {
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

  it('renders children when user is premium and active', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: true,
      isActive: true,
    });

    render(
      <FeatureLimit current={3} limit={5} feature="recipes" user={mockUser}>
        <div>Content</div>
      </FeatureLimit>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders children when under limit for free users', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isActive: false,
    });

    render(
      <FeatureLimit current={3} limit={5} feature="recipes" user={mockUser}>
        <div>Content</div>
      </FeatureLimit>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('shows limit reached message when at limit for free users', () => {
    mockUseSubscription.mockReturnValue({
      isPremium: false,
      isActive: false,
    });

    render(
      <FeatureLimit current={5} limit={5} feature="recipes" user={mockUser}>
        <div>Content</div>
      </FeatureLimit>
    );

    expect(screen.getByText("You've reached the free limit of 5 recipes")).toBeInTheDocument();
    expect(screen.getByText('Upgrade for Unlimited')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders children when no user provided', () => {
    render(
      <FeatureLimit current={3} limit={5} feature="recipes" user={null}>
        <div>Content</div>
      </FeatureLimit>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});