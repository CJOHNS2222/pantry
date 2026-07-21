import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AppProvider } from '../../../contexts/AppContext'

// Mock useDataManagement so we can assert addItem calls
const mockAddItem = vi.fn()
vi.mock('../../../hooks/useDataManagement', () => ({
  useDataManagement: () => ({ addItem: mockAddItem })
}))

// Mock LeftoverService.create using hoist-safe factory and capture the mock later
vi.mock('../../../services/leftoverService', () => {
  return {
    LeftoverService: {
      create: vi.fn()
    }
  };
});

// Minimal mocks for services that might be imported by the component
vi.mock('../../../services/leftoverImageService', () => ({ uploadLeftoverImage: vi.fn() }))
vi.mock('../../../services/databaseMonitoringService', () => ({
  default: {
    doc: vi.fn(),
    getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => ({}) }),
    updateDoc: vi.fn(),
    setDoc: vi.fn().mockResolvedValue(undefined)
  }
}))

import LeftoverQuickCapture from '../../../components/leftovers/LeftoverQuickCapture'
import { LeftoverService } from '../../../services/leftoverService'

const mockedLeftoverService = vi.mocked(LeftoverService)

describe('LeftoverQuickCapture', () => {
  beforeEach(() => {
    vi.mocked(mockedLeftoverService.create).mockReset()
  })

  it('sends cooked_rice flag when checkbox is checked and calls LeftoverService.create', async () => {
    vi.mocked(mockedLeftoverService.create).mockResolvedValue({ id: 'leftover-1', createdAt: '2023-01-01T00:00:00Z', computedBestBefore: '2023-01-02T00:00:00Z' } as any)

    const appValue = {
      user: { id: 'user-1', profile: { leftoverPersona: 'normal' } },
      household: { id: 'h1', members: [] },
      activeTab: 0,
      setActiveTab: () => {},
      inventory: [],
      setInventory: () => {},
      shoppingList: [],
      setShoppingList: (() => {}) as any,
      mealPlan: [],
      setMealPlan: (() => {}) as any,
      savedRecipes: [],
      ratings: [],
      persistedRecipeResult: null,
      setPersistedRecipeResult: () => {},
      initialSearchQuery: '',
      setInitialSearchQuery: () => {},
      settings: { notifications: { enabled: false, time: '09:00', types: { shoppingList: true, mealPlan: true, cookingReminders: true }, cookingReminderTime: 60 }, theme: { mode: 'light', accentColor: '#0078d4', backgroundColor: undefined, textColor: undefined }, shopping: { includeStaples: true } },
      setSettings: () => {},
      customCategories: [],
      recipeSaveLimitExceeded: false,
      mealPlanLimitExceeded: false,
      isLoadingInventory: false,
      isLoadingShoppingList: false,
      isLoadingMealPlan: false,
      isLoadingSavedRecipes: false,
      isLoadingRatings: false,
      isLoadingHousehold: false,
      consumptionSuggestions: [],
      expirationAlerts: [],
      recipeSuggestions: [],
      recentActivities: [],
      isLoadingActivities: false,
    }

    render(
      <AppProvider value={appValue as any}>
        <LeftoverQuickCapture createdBy="user-1" />
      </AppProvider>
    )

    // Check the cooked-rice checkbox and click Save
    const checkbox = screen.getByLabelText(/Contains cooked rice/i) as HTMLInputElement
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)

    const saveButton = screen.getByRole('button', { name: /Save Leftover/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(vi.mocked(mockedLeftoverService.create)).toHaveBeenCalled()
    })

    const payload = vi.mocked(mockedLeftoverService.create).mock.calls[0][0]
    expect(payload).toBeTruthy()
    expect(payload.householdId).toBe('h1')
    expect(payload.createdBy).toBe('user-1')
    expect(payload.cooked_rice).toBe(true)
  })
})
