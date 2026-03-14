import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AppProvider } from '../contexts/AppContext'

// Mock the actual LeftoverService used by the component and the image uploader
const mockCreate = vi.fn()
vi.mock('../services/leftoverService', () => ({ LeftoverService: { create: mockCreate } }))
vi.mock('../services/leftoverImageService', () => ({ uploadLeftoverImage: vi.fn().mockResolvedValue('https://example.com/photo.jpg') }))

import LeftoverQuickCapture from '../components/LeftoverQuickCapture'

describe('LeftoverQuickCapture', () => {
  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('sends cooked_rice flag when checkbox is checked and calls LeftoverService.create', async () => {
    mockCreate.mockResolvedValue({ id: 'leftover-1' })
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
        <LeftoverQuickCapture createdBy="user-1" />
      </AppProvider>
    )

    // Check the cooked-rice checkbox and click Save
    const checkbox = screen.getByLabelText(/Contains cooked rice/i) as HTMLInputElement
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(true)

    const saveButton = screen.getByText('Save Leftover')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalled()
    })

    // inspect the payload passed to LeftoverService.create
    const payload = mockCreate.mock.calls[0][0]
    expect(payload).toBeTruthy()
    expect(payload.cooked_rice).toBe(true)
    expect(payload.createdBy).toBe('user-1')
    expect(typeof payload.householdId === 'string').toBeTruthy()
  })
})
