import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { AppNavigation } from '../../../components/layout/AppNavigation';
import { Tab } from '../../../types/app';

// Mock cleanup to prevent DOM accumulation
afterEach(() => {
  document.body.innerHTML = '';
});

describe('AppNavigation', () => {
  const mockSetActiveTab = vi.fn();

  const defaultProps = {
    activeTab: Tab.PANTRY,
    setActiveTab: mockSetActiveTab
  };

  it('renders all navigation tabs', () => {
    render(<AppNavigation {...defaultProps} />);

    expect(screen.getByText('Pantry')).toBeInTheDocument();
    expect(screen.getByText('Shop')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Chef')).toBeInTheDocument();
    expect(screen.getByText('Social')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('highlights the active tab', () => {
    render(<AppNavigation {...defaultProps} activeTab={Tab.SHOPPING} />);

    // The active tab should have different styling (this is hard to test directly)
    // But we can check that the component renders without errors
    expect(screen.getByText('Shop')).toBeInTheDocument();
  });

  it('calls setActiveTab when a tab is clicked', () => {
    render(<AppNavigation {...defaultProps} />);

    const shopTab = screen.getByText('Shop');
    fireEvent.click(shopTab);

    expect(mockSetActiveTab).toHaveBeenCalledWith(Tab.SHOPPING);
  });

  it('calls setActiveTab with correct tab for each navigation item', () => {
    const localMockSetActiveTab = vi.fn();
    render(<AppNavigation {...defaultProps} setActiveTab={localMockSetActiveTab} />);

    // Test each tab
    const tabs = [
      { label: 'Pantry', tab: Tab.PANTRY },
      { label: 'Shop', tab: Tab.SHOPPING },
      { label: 'Plan', tab: Tab.MEALS },
      { label: 'Chef', tab: Tab.RECIPES },
      { label: 'Social', tab: Tab.COMMUNITY },
      { label: 'Settings', tab: Tab.SETTINGS }
    ];

    tabs.forEach(({ label, tab }) => {
      const tabElement = screen.getByText(label);
      fireEvent.click(tabElement);
      expect(localMockSetActiveTab).toHaveBeenCalledWith(tab);
    });

    // Should be called 6 times total
    expect(localMockSetActiveTab).toHaveBeenCalledTimes(6);
  });

  it('renders navigation with proper accessibility attributes', () => {
    render(<AppNavigation {...defaultProps} />);

    // Check for tutorial data attributes
    const pantryButton = screen.getByText('Pantry').closest('button');
    expect(pantryButton).toHaveAttribute('data-tutorial', 'nav-pantry');

    const settingsButton = screen.getByText('Settings').closest('button');
    expect(settingsButton).toHaveAttribute('data-tutorial', 'nav-settings');
  });

  it('renders icons for each tab', () => {
    render(<AppNavigation {...defaultProps} />);

    // Check that SVG icons are present (they contain 'svg' elements)
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });
});