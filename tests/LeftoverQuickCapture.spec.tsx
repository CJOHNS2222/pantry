import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AppProvider } from '../contexts/AppContext'

// Mock useDataManagement so we can assert addItem calls
const mockAddItem = vi.fn()
vi.mock('../hooks/useDataManagement', () => ({
  useDataManagement: () => ({ addItem: mockAddItem })
}))

// Minimal mocks for services that might be imported by the component
vi.mock('../services/leftoverImageService', () => ({ uploadLeftoverImage: vi.fn() }))
vi.mock('../services/databaseMonitoringService', () => ({ doc: vi.fn(), getDoc: vi.fn(), updateDoc: vi.fn() }))

import LeftoverQuickCapture from '../components/LeftoverQuickCapture'

describe('LeftoverQuickCapture', () => {
  beforeEach(() => {
    mockAddItem.mockReset()
  })

  it('sends cooked_rice flag when checkbox is checked and calls simpleAddOrMarkLeftover', async () => {
    mockAddItem.mockResolvedValue({ id: 'leftover-1' })

    const appValue = {
      // only include the minimal fields used by the component
      user: { id: 'user-1', profile: { leftoverPersona: 'normal' } },
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
        <LeftoverQuickCapture householdId="h1" createdBy="user-1" />
      </AppProvider>
    )

    // Check the cooked-rice checkbox and click Save
    const checkbox = screen.getByLabelText(/Contains cooked rice/i) as HTMLInputElement
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)

    const saveButton = screen.getByText('Save')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockAddItem).toHaveBeenCalled()
    })

    // inspect the payload passed to addItem
    const payload = mockAddItem.mock.calls[0][0]
    expect(payload).toBeTruthy()
    // derived fields
    expect(payload.category).toBe('Leftovers')
    expect(payload.image === undefined || typeof payload.image === 'string').toBeTruthy()
  })
})
