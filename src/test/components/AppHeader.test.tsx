import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AppHeader } from '../../../components/layout/AppHeader';

// Mock the UsageIndicator component
vi.mock('../../../components/UsageIndicator', () => ({
  UsageIndicator: ({ user, compact, onUpgrade }: any) => (
    <div data-testid="usage-indicator" data-compact={compact}>
      Usage: {user?.name}
    </div>
  )
}));

// Mock cleanup to prevent DOM accumulation
afterEach(() => {
  document.body.innerHTML = '';
});

describe('AppHeader', () => {
  const mockUser = {
    id: 'user1',
    name: 'Test User',
    email: 'test@example.com',
    avatar: 'avatar.jpg'
  };

  const mockSettings = {
    theme: {
      mode: 'dark'
    }
  };

  const mockSetSettings = vi.fn();
  const mockOnShowHousehold = vi.fn();
  const mockOnUndo = vi.fn();

  const mockSyncStatus = {
    isOnline: true,
    isSyncing: false,
    lastSyncTime: new Date(),
    pendingOperations: 0,
    syncError: null,
    syncProgress: null,
    hasConflicts: false
  };

  const defaultProps = {
    user: mockUser,
    settings: mockSettings,
    setSettings: mockSetSettings,
    onShowHousehold: mockOnShowHousehold,
    syncStatus: mockSyncStatus
  };

  it('renders user information', () => {
    render(<AppHeader {...defaultProps} />);

    // The header shows the user's display name
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('Stock & Spoon')).toBeInTheDocument();
    expect(screen.getByText('AI Kitchen Assistant')).toBeInTheDocument();
  });

  it('renders user avatar when available', () => {
    render(<AppHeader {...defaultProps} />);

    const avatar = screen.getByAltText("Test User's profile picture");
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', 'avatar.jpg');
  });

  it('renders user initial when no avatar', () => {
    const userWithoutAvatar = { ...mockUser, avatar: undefined };
    render(<AppHeader {...defaultProps} user={userWithoutAvatar} />);

    expect(screen.getByText('T')).toBeInTheDocument(); // First letter of "Test User"
  });

  it('calls onShowHousehold when household button is clicked', () => {
    render(<AppHeader {...defaultProps} />);

    const householdButton = screen.getByLabelText('Switch household or account. Current user: Test User');
    fireEvent.click(householdButton);

    expect(mockOnShowHousehold).toHaveBeenCalled();
  });

  it('renders theme toggle button', () => {
    render(<AppHeader {...defaultProps} />);

    const themeButton = document.querySelector('[data-tutorial="theme-toggle"]') as HTMLButtonElement;
    expect(themeButton).toBeInTheDocument();
  });

  it('toggles theme when theme button is clicked', () => {
    render(<AppHeader {...defaultProps} />);

    const themeButton = document.querySelector('[data-tutorial="theme-toggle"]') as HTMLButtonElement;
    fireEvent.click(themeButton);

    expect(mockSetSettings).toHaveBeenCalled();
    const callArg = mockSetSettings.mock.calls[0][0];
    expect(typeof callArg).toBe('function');

    // Test that the function produces the expected result
    const result = callArg(mockSettings);
    expect(result).toEqual({
      ...mockSettings,
      theme: {
        ...mockSettings.theme,
        mode: 'light'
      }
    });
  });

  it('shows sun icon in dark mode', () => {
    render(<AppHeader {...defaultProps} />);

    // In dark mode, should show Sun icon for switching to light
    const themeButton = document.querySelector('[data-tutorial="theme-toggle"]') as HTMLButtonElement;
    const sunIcon = themeButton.querySelector('svg');
    expect(sunIcon).toBeInTheDocument();
  });

  it('shows moon icon in light mode', () => {
    const lightSettings = {
      ...mockSettings,
      theme: { mode: 'light' }
    };
    render(<AppHeader {...defaultProps} settings={lightSettings} />);

    // In light mode, should show Moon icon for switching to dark
    const themeButton = document.querySelector('[data-tutorial="theme-toggle"]') as HTMLButtonElement;
    const moonIcon = themeButton.querySelector('svg');
    expect(moonIcon).toBeInTheDocument();
  });

  it('renders usage indicator', () => {
    render(<AppHeader {...defaultProps} />);

    const usageIndicator = screen.getByTestId('usage-indicator');
    expect(usageIndicator).toBeInTheDocument();
    expect(usageIndicator).toHaveAttribute('data-compact', 'true');
  });

  it('renders undo button when recent actions exist', () => {
    const recentActions = [{ id: 'action1', type: 'delete' }];
    render(<AppHeader {...defaultProps} recentActions={recentActions} onUndo={mockOnUndo} />);

    const undoButton = screen.getByTitle('Undo last action');
    expect(undoButton).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // Action count
  });

  it('calls onUndo when undo button is clicked', () => {
    const recentActions = [{ id: 'action1', type: 'delete' }];
    render(<AppHeader {...defaultProps} recentActions={recentActions} onUndo={mockOnUndo} />);

    const undoButton = screen.getByTitle('Undo last action');
    fireEvent.click(undoButton);

    expect(mockOnUndo).toHaveBeenCalledWith(recentActions[0]);
  });

  it('does not render undo button when no recent actions', () => {
    render(<AppHeader {...defaultProps} recentActions={[]} />);

    const undoButton = screen.queryByTitle('Undo last action');
    expect(undoButton).not.toBeInTheDocument();
  });

  it('does not render undo button when onUndo is not provided', () => {
    const recentActions = [{ id: 'action1', type: 'delete' }];
    render(<AppHeader {...defaultProps} recentActions={recentActions} />);

    const undoButton = screen.queryByTitle('Undo last action');
    expect(undoButton).not.toBeInTheDocument();
  });
});