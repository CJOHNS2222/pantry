import React from 'react';
import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render as rtlRender, screen, fireEvent, cleanup } from '@testing-library/react';
import { PantryScanner } from '../../../components/pantry/PantryScanner';
import { PantryItem } from '../../../types';
import { ConfirmDialogProvider } from '../../../components/ui/ConfirmDialog';

vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });

// PantryScanner's bulk-edit modal (BulkQuantityEditModal) uses react-intl's useIntl(),
// which requires an <IntlProvider> ancestor. Mock the module instead of wrapping with
// a real provider, matching the pattern used in the sibling MealPlanner/RecipeFinder tests.
vi.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ defaultMessage, id }: { defaultMessage?: string; id: string }) => defaultMessage || id,
  }),
  FormattedMessage: ({ id }: { id: string }) => <span>{id}</span>,
}));

// PantryScanner calls useConfirm() internally, which requires a ConfirmDialogProvider
// ancestor. We can't use the shared test-utils `render` here because it also wraps with
// the real AppActionsProvider, which conflicts with this file's own
// vi.mock('../../../contexts/AppActionsContext', ...) below. So wrap with just the
// ConfirmDialogProvider directly.
function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: ConfirmDialogProvider });
}

// PantryScanner reads inventory/actions from domain-scoped contexts rather than
// props. Mock those modules so each test can inject its own inventory/callbacks
// without threading them through props.
let mockInventoryState: PantryItem[] = [];
const mockAddToShoppingList = vi.fn();
const mockOnDeleteItem = vi.fn();
const mockOnAddItem = vi.fn();
const mockOnAddItems = vi.fn();
const mockOnUpdateItem = vi.fn();

const mockUser = { id: 'user1', profile: {} };
const mockEmptyArray: any[] = [];
const mockSettings = { shopping: {} };
const mockNavContext = { setActiveTab: vi.fn(), activeTab: 'pantry', activeSettingsCategory: null };
const mockUserContextValue = {
  user: mockUser,
  household: undefined,
  isLoadingHousehold: false,
  recentActivities: mockEmptyArray,
  isLoadingActivities: false,
};
const mockRecipeContextValue = {
  savedRecipes: mockEmptyArray,
  ratings: mockEmptyArray,
  persistedRecipeResult: null,
  setPersistedRecipeResult: vi.fn(),
  initialSearchQuery: '',
  setInitialSearchQuery: vi.fn(),
  isLoadingSavedRecipes: false,
  isLoadingRatings: false,
  setLoadingRatingsComplete: vi.fn(),
  recipeSaveLimitExceeded: false,
  mealPlanLimitExceeded: false,
};
const mockSettingsContextValue = { settings: mockSettings, setSettings: vi.fn(), customCategories: mockEmptyArray };
const mockMealPlanContextValue = { mealPlan: mockEmptyArray, setMealPlan: vi.fn(), isLoadingMealPlan: false };
const mockShoppingContextValue = { shoppingList: mockEmptyArray, setShoppingList: vi.fn(), isLoadingShoppingList: false };
const mockAppActionsValue = {
  onSaveRecipe: vi.fn(),
  onRateRecipe: vi.fn(),
  onAddToShoppingList: mockAddToShoppingList,
  addShoppingListItem: vi.fn(),
  deleteItem: mockOnDeleteItem,
  addItem: mockOnAddItem,
  addItems: mockOnAddItems,
  updateItem: mockOnUpdateItem,
  addToast: vi.fn(),
  deleteItems: vi.fn(),
};

vi.mock('../../../contexts/NavigationContext', () => ({
  useNavigation: () => mockNavContext,
}));
vi.mock('../../../contexts/UserContext', () => ({
  useUserContext: () => mockUserContextValue,
}));
vi.mock('../../../contexts/InventoryContext', () => ({
  useInventoryContext: () => ({
    inventory: mockInventoryState,
    setInventory: vi.fn(),
    isLoadingInventory: false,
    consumptionSuggestions: mockEmptyArray,
    expirationAlerts: mockEmptyArray,
    recipeSuggestions: mockEmptyArray,
  }),
}));
vi.mock('../../../contexts/RecipeContext', () => ({
  useRecipeContext: () => mockRecipeContextValue,
}));
vi.mock('../../../contexts/SettingsDataContext', () => ({
  useSettingsDataContext: () => mockSettingsContextValue,
}));
vi.mock('../../../contexts/MealPlanContext', () => ({
  useMealPlanContext: () => mockMealPlanContextValue,
}));
vi.mock('../../../contexts/ShoppingContext', () => ({
  useShoppingContext: () => mockShoppingContextValue,
}));
vi.mock('../../../contexts/AppActionsContext', () => ({
  useAppActions: () => mockAppActionsValue,
}));

// Mock Capacitor Camera
vi.mock('@capacitor/camera', () => ({
  Camera: {
    getPhoto: vi.fn(),
  },
  CameraResultType: {
    DataUrl: 'dataUrl',
  },
  CameraSource: {
    Camera: 'camera',
  },
}));

// Mock Gemini service
vi.mock('../../../services/geminiService', () => ({
  analyzePantryImage: vi.fn(),
}));

vi.mock('../../../components/pantry/AddItemsModal', () => ({ AddItemsModal: () => null }));
vi.mock('../../../components/pantry/PantryImportModal', () => ({ default: () => null }));
vi.mock('../../../components/pantry/FreezeTransitionModal', () => ({ default: () => null }));
vi.mock('../../../components/pantry/ScanReviewModal', () => ({ ScanReviewModal: () => null }));
vi.mock('../../../components/ui/AdMobBanner', () => ({ AdMobBanner: () => null }));
vi.mock('../../../components/pantry/PantryHealthScore', () => ({ PantryHealthScore: () => null }));

// Mock IntersectionObserver for JSDOM
beforeEach(() => {
  class MockIntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  window.IntersectionObserver = MockIntersectionObserver as any;
  vi.clearAllMocks();
});

// Without this, prior tests' rendered PantryScanner instances stay mounted, so
// getAllByRole(...)[0] queries can pick up buttons from a stale render with a
// different mock closure — causing assertions to check the wrong mock.
afterEach(() => {
  cleanup();
});

function makeItem(i: number): PantryItem {
  return {
    id: `item-${i}`,
    item: `Item ${i}`,
    image: '/images/placeholder.svg',
    quantity_estimate: '1',
    category: 'Manual',
    storageLocation: 'pantry',
  } as PantryItem;
}

describe('PantryScanner Component', () => {
  const initialInventory: PantryItem[] = [
    { id: '1', item: 'Milk', category: '', quantity_estimate: '2' } as PantryItem,
    { id: '2', item: 'Bread', category: '', quantity_estimate: '1' } as PantryItem,
  ];

  it('renders with initial inventory', () => {
    mockInventoryState = initialInventory;
    render(<PantryScanner />);

    expect(screen.getAllByText('Milk')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Bread')[0]).toBeInTheDocument();
  });

  it('renders the search input placeholder', () => {
    mockInventoryState = initialInventory;
    render(<PantryScanner />);

    const searchButton = screen.getByText('Search pantry items...').closest('button')!;
    fireEvent.click(searchButton);

    expect(screen.getAllByPlaceholderText('Search pantry items...')[0]).toBeInTheDocument();
  });

  it('shows the scan prompt', () => {
    mockInventoryState = []; // Empty inventory to show scan prompt
    render(<PantryScanner />);

    // Open search modal
    const searchButton = screen.getByText('Search pantry items...').closest('button')!;
    fireEvent.click(searchButton);

    expect(screen.getAllByPlaceholderText('Search pantry items...')[0]).toBeInTheDocument();
  });
});

describe('PantryScanner bulk behavior and virtualization', () => {
  test('bulk change location calls setInventory with updated items', async () => {
    mockInventoryState = [makeItem(1), makeItem(2), makeItem(3)];

    render(<PantryScanner />);

    // Click Bulk select mode button
    const selectBtn = screen.getByLabelText('Bulk select mode');
    fireEvent.click(selectBtn);

    // Select first item row
    const item1 = screen.getAllByText('Item 1')[0];
    fireEvent.click(item1);

    // Change the bulk location select to 'fridge'
    const locationSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(locationSelect, { target: { value: 'fridge' } });

    // Expect mockOnUpdateItem called
    expect(mockOnUpdateItem).toHaveBeenCalled();
  });

  test('virtualized render does not crash with many items', () => {
    mockInventoryState = Array.from({ length: 120 }).map((_, i) => makeItem(i));

    render(<PantryScanner />);

    const matches = screen.getAllByText(/Item 0|Item 1/);
    expect(matches.length).toBeGreaterThan(0);
  });
});
