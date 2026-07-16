export interface PantryItem {
  id: string;
  item: string;
  category: string;
  quantity_estimate: string; // Legacy field, keep for compatibility
  image?: string;
  // Optional photo of the container/storage for leftovers (user-supplied)
  containerImage?: string;
  storageLocation?: string; // legacy values include 'pantry' | 'freezer' | 'fridge' | 'spices' | 'other'
  expirationDate?: string; // ISO date string (YYYY-MM-DD)
  // Backwards-compatible alias used across components
  expiryDate?: string;
  expirationType?: 'use-by' | 'best-by'; // Type of expiration date
  dateAdded?: string; // ISO date string when item was first added
  lastRestocked?: string; // ISO date string when item was last restocked
  consumptionHistory?: string[]; // Array of ISO dates when item was consumed/replaced

  // Enhanced quantity tracking
  // Can be a simple numeric estimate or a structured quantity object
  quantity?: number | {
    amount: number;        // Numeric amount (e.g., 2.5)
    unit: string;          // Unit (cups, lbs, oz, etc.)
    originalAmount?: number; // Original purchase amount
    originalUnit?: string;   // Original purchase unit
  };
  originalQuantity?: string; // Preserve recipe quantities (e.g. "1/2 cup", "4 oz")

  // Support multiple purchase batches with independent expirations
  batches?: Batch[];
  // Visual quantity estimation
  visualLevel?: 'empty' | 'quarter' | 'half' | 'threeQuarter' | 'full';

  // Recipe reservations
  reservations?: {
    recipeId: string;
    recipeName: string;
    quantity: number;
    unit: string;
  }[];

  // Expiry alert tracking
  expiryAlertShown?: boolean; // Whether expiry alert has been displayed to user
  tags?: string[];
  // Denormalized product-level risk score (1-5)
  productRiskLevel?: number;
  // Product-level immortal flag: when true, item should never be treated as expired
  // (e.g., salt, sugar, honey). UI will show a 'Shelf Stable' badge and expiry
  // checks/notifications will be bypassed for these items.
  is_immortal?: boolean;
  // Leftover support: flag inventory items that represent leftovers
  is_leftover?: boolean;
  // User notes about the item
  notes?: string;
  leftoverMeta?: LeftoverMeta;
  // Cooked rice flag: denormalized boolean to indicate this item contains cooked rice
  // (affects safety window calculations). New writes should set this when applicable.
  cooked_rice?: boolean;
  // Freezer/frozen state
  is_frozen?: boolean;
  frozenAt?: string; // ISO date when item was moved to freezer
  freezerExpiry?: string; // ISO date for freezer-specific expiry
  freezerZone?: string; // Freezer zone hint (e.g., top, middle, bottom, door, drawer)
  freezerLabelPhotoUrl?: string; // Optional photo URL of freezer label/container
  freezerPortionCount?: number; // Optional portion count for frozen leftovers/items
  // Opened tracking for items with different shelf lives once opened
  isOpened?: boolean; // Whether the item has been opened
  openedAt?: string; // ISO date when item was opened
  openedExpiry?: string; // ISO date for opened-specific expiry
  // Staples: items that auto-reappear on shopping list when depleted
  isStaple?: boolean;
  estimatedPrice?: number; // Estimated price extracted from receipt or user input
}

export interface Batch {
  batchId: string;
  quantity: number;
  unit?: string;
  expires?: string; // ISO date string (YYYY-MM-DD)
  purchaseDate?: string; // ISO date when purchased
  note?: string;
}

export interface LeftoverMeta {
  createdAt?: string; // ISO date
  createdBy?: string; // UID
  // sourcePantryItemId removed: leftovers are independent of pantry items
  computedBestBefore?: string; // ISO date computed by leftoverService
  servings?: number; // Number of servings contained in this leftover
  riskLevel?: number; // 1-5 user risk mapping at creation
  notes?: string;
  lastConsumedAt?: string; // ISO date when last serving was consumed
}

export interface ShoppingItem {
  id: string;
  item: string;
  category: string;
  checked: boolean;
  quantity?: number | string; // Can be a number or string like "2 cups", "1 tbsp"
  amount?: number; // Numeric decimal amount (e.g., 1.5)
  unit?: string; // Unit of measurement
  source?: string; // How the item was added (e.g., "suggested", "recipe: Chicken Stir Fry")
  purchasedQuantity?: {
    amount: number;
    unit: string;
  }; // Quantity actually purchased
  purchasedBatch?: {
    amount: number;
    unit?: string;
    expires?: string; // ISO date
    note?: string;
    is_immortal?: boolean;
  };
  addedAt?: Date; // When the item was added to the shopping list
  consolidatedItems?: {
    id: string;
    addedAt?: Date | string;
    quantity?: string | number;
    amount?: number;
    unit?: string;
    source?: string;
  }[];
  completedAt?: Date; // When the item was checked off
  estimatedPrice?: number; // Estimated price for analytics
  priceData?: {
    averagePrice: number;
    minPrice: number;
    maxPrice: number;
    sampleSize: number;
    lastUpdated: Date;
    unit: string;
  }; // Full price data for reference
  priceOptions?: {
    amount: number;
    unit: string;
    price: number;
    store?: string;
  }[]; // Multiple price options for comparison
  assignedTo?: string; // Household member name the item is assigned to
  notes?: string; // Per-item note visible to all household members
  walmartItemId?: string; // Mapped Walmart item identifier for affiliate checkout
}

export interface GroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface StructuredRecipe {
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  cookTime: string | number;
  prepTime?: string | number;
  servings?: number;
  id?: string;
  type?: string;
  image?: string;
  url?: string;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    [key: string]: number | undefined;
  };
  tags?: string[];
}

export interface SavedRecipe extends StructuredRecipe {
  id: string;
  dateSaved: string;
  imagePlaceholder?: string; // CSS color or placeholder ID
  image?: string; // URL to recipe image
  userId?: string; // Owner UID for private recipes
  visibility?: 'public' | 'private';
}

export interface RecipeSearchResult {
  recipes: StructuredRecipe[];
  groundingChunks?: GroundingChunk[];
}

export interface MealPlanItem {
  id: string; // unique id for drag and drop
  recipe: StructuredRecipe;
  mealType: 'breakfast' | 'lunch' | 'dinner';
}

export interface DayPlan {
  date: string;
  dayName: string;
  breakfast: MealPlanItem[];
  lunch: MealPlanItem[];
  dinner: MealPlanItem[];
  meals?: MealPlanItem[]; // Legacy support for migration
}

export interface RecipeRatingInput {
  id: string;
  recipeTitle: string;
  rating: number;
  comment: string;
  userName: string;
  userAvatar?: string;
  date?: string; // Optional, will be set server-side
  recipe?: StructuredRecipe;
}

export interface RecipeRating extends RecipeRatingInput {
  id: string;
  recipeTitle: string;
  rating: number;
  comment: string;
  userName: string;
  userAvatar?: string;
  date: string;
  recipe?: StructuredRecipe;
  // Enhanced rating system
  wouldMakeAgain?: boolean;
  feedback?: RecipeFeedback[];
  photos?: RecipePhoto[];
  modifications?: RecipeModification[];
}

export interface RecipeFeedback {
  type: 'too-spicy' | 'too-bland' | 'too-time-consuming' | 'too-complicated' | 'love-it' | 'family-favorite' | 'easy-weeknight' | 'impressive-guests';
  comment?: string;
}

export interface RecipePhoto {
  id: string;
  url: string;
  caption?: string;
  uploadedBy?: string;
  uploadedAt: string;
  fileName?: string;
  ratingId?: string;
  recipeTitle?: string;
}

export interface RecipeModification {
  id: string;
  type: 'added' | 'removed' | 'substituted' | 'changed-quantity' | 'changed-method';
  originalIngredient?: string;
  modifiedIngredient?: string;
  description: string;
  userName: string;
  userAvatar?: string;
  date: string;
  helpful: number; // Number of people who found this helpful
}

export interface RecipeCommunityStats {
  totalRatings: number;
  averageRating: number;
  wouldMakeAgainPercentage: number;
  topFeedback: RecipeFeedback[];
  topModifications: RecipeModification[];
  householdStats?: {
    householdRatings: number;
    householdAverageRating: number;
    householdWouldMakeAgain: number;
  };
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface RecipeSearchParams {
  query?: string; // For specific searches
  ingredients: string; // From pantry
  restrictions?: string;
  maxCookTime?: number;
  maxIngredients?: number;
  measurementSystem: 'Metric' | 'Standard';
  strictMode?: boolean; // Only use inventory
  userId?: string;
  userProfile?: UserProfile; // For personalized recommendations
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: 'email' | 'google' | 'facebook' | 'guest';
  /** true for users who skipped sign-up; data is localStorage-only */
  isGuest?: boolean;
  hasSeenTutorial: boolean;
  subscription?: Subscription;
  profile?: UserProfile;
  customCategories?: CustomCategory[];
  householdId?: string;
  householdMembers?: HouseholdMember[];
  discoveredFeatures?: string[];
  dismissedTutorialTips?: string[];
  fcmTokens?: string[];
}

export interface UserProfile {
  name?: string; // Display name override
  height?: number; // in inches (stored as total inches, displayed as ft/in)
  weight?: number; // in pounds
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  dietGoal?: 'lose-weight' | 'maintain-weight' | 'gain-weight' | 'build-muscle' | 'improve-health';
  activityLevel?: 'sedentary' | 'lightly-active' | 'moderately-active' | 'very-active' | 'extremely-active';
  dietaryRestrictions?: string[];
  allergies?: string[];
  householdSize?: number; // number of people in household
  // Optional risk level for safety notifications (1 = low, 5 = highest)
  riskLevel?: number;
  // If true, user prefers stricter health/safety notifications
  sensitiveHealthMode?: boolean;
  // Leftover persona for food-safety guidance: 'strict' | 'normal' | 'relaxed'
  leftoverPersona?: 'strict' | 'normal' | 'relaxed';
  // Measurement system preference: 'Standard' (imperial) or 'Metric'
  measurementSystem?: 'Standard' | 'Metric';
  // Food preferences
  favoriteCuisines?: string[];
  preferredProteins?: string[];
  dislikedIngredients?: string[];
  specialNeeds?: string;
}

export interface HouseholdMember {
  name: string;
  dietaryRestrictions?: string[];
  allergies?: string[];
  dietGoal?: 'lose-weight' | 'maintain-weight' | 'gain-weight' | 'build-muscle' | 'improve-health';
  favoriteCuisines?: string[];
}

export interface Subscription {
  tier: 'free' | 'premium' | 'family';
  status: 'active' | 'cancelled' | 'past_due' | 'trialing';
  current_period_end: Date;
  cancel_at_period_end: boolean;
  trial_end?: Date;
  product_id?: string;
  purchase_token?: string;
  updated_at?: Date;
}

export interface ConsumptionSuggestion {
  item: string;
  category: string;
  suggestedAction: 'restock' | 'consider_buying';
  reason: string;
  confidence: number; // 0-1, how confident we are in this suggestion
  daysSinceLastPurchase?: number;
  averageInterval?: number; // average days between purchases
}

export interface ExpirationAlert {
  itemId: string;
  itemName: string;
  daysRemaining: number;
  alertLevel: 'expired' | 'critical' | 'warning' | 'info';
  expirationType: 'use-by' | 'best-by';
  message: string;
}

export interface RecipeSuggestion {
  itemId: string;
  itemName: string;
  daysRemaining: number;
  suggestedRecipes: string[];
  reason: string; // e.g., "expires in 2 days", "perfect for salads"
}

export interface CustomCategory {
  id: string;
  name: string;
  icon: string; // emoji or icon name
  color?: string; // hex color code
  createdAt: string;
  userId: string;
}

export interface PantryFilter {
  categories: string[];
  locations: string[];
  expirationStatus: 'all' | 'expiring-soon' | 'expired' | 'fresh';
  quantityStatus: 'all' | 'low-stock' | 'out-of-stock' | 'in-stock';
  sortBy: 'name' | 'expiration' | 'quantity' | 'category' | 'location';
  sortOrder: 'asc' | 'desc';
}

export interface Household {
  id: string;
  name: string;
  members: Member[];
  memberIds: string[]; // For querying households by user ID
  /** Live presence map written by householdActivityService — keyed by userId */
  memberActivity?: Record<string, { isOnline?: boolean; lastSeen?: { toDate(): Date } | string; currentActivity?: string }>;
  /**
   * The household owner/admin's current subscription tier, synced by the owner's
   * session via useSubscription.  Non-admin members inherit 'family' features while
   * this equals 'family' and they remain active members of the household.
   */
  ownerSubscriptionTier?: 'free' | 'premium' | 'family';
}

export interface Member {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'member';
  status: 'active' | 'pending' | 'inactive';
  joinedAt: string;
  lastSeen?: string; // ISO timestamp of last activity
  currentActivity?: string; // Current tab/page they're viewing
  isOnline?: boolean; // Real-time online status
  
  // Dietary preferences and restrictions
  dietaryRestrictions?: string[];
  allergies?: string[];
  dietGoal?: 'lose-weight' | 'maintain-weight' | 'gain-weight' | 'build-muscle' | 'improve-health';
  favoriteCuisines?: string[];
  specialNeeds?: string; // Any special dietary needs or medical conditions
  preferredProteins?: string[]; // Favorite proteins (chicken, beef, tofu, etc.)
  dislikedIngredients?: string[]; // Ingredients they don't like
}

export interface Settings {
  notifications: {
    enabled: boolean;
    time: string;
    types: {
      shoppingList: boolean;
      mealPlan: boolean;
      cookingReminders: boolean;
    };
    cookingReminderTime: number;
  };
  theme: {
    mode: string;
    accentColor: string;
    backgroundColor?: string;
    textColor?: string;
  };
  shopping?: {
    includeStaples?: boolean;
    autoReaddStaples?: boolean;
    storeLayout?: string[]; // Custom order of store aisles (legacy – used when no storeProfiles)
    storeProfiles?: Record<string, string[]>; // Named per-store aisle orderings
    activeStoreProfile?: string; // Currently selected store profile name
    showNutrition?: boolean;
    showPriceData?: boolean;
  };
  navigation?: {
    hiddenTabs?: string[]; // Tab enum values that are hidden from the bottom nav
  };
}

export interface HouseholdActivity {
  id: string;
  userId: string;
  userName: string;
  action: string; // 'added_item', 'removed_item', 'completed_meal', 'created_meal_plan', etc.
  details?: string;
  itemId?: string;
  itemName?: string;
  timestamp: unknown; // Firebase Timestamp
  householdId: string;
}
