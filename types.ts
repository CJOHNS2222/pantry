export interface PantryItem {
  id: string;
  item: string;
  category: string;
  quantity_estimate: string; // Legacy field, keep for compatibility
  image?: string;
  storageLocation?: 'pantry' | 'freezer' | 'fridge' | 'spices' | 'other';
  expirationDate?: string; // ISO date string (YYYY-MM-DD)
  expirationType?: 'use-by' | 'best-by'; // Type of expiration date
  dateAdded?: string; // ISO date string when item was first added
  lastRestocked?: string; // ISO date string when item was last restocked
  consumptionHistory?: string[]; // Array of ISO dates when item was consumed/replaced

  // Enhanced quantity tracking
  quantity?: {
    amount: number;        // Numeric amount (e.g., 2.5)
    unit: string;          // Unit (cups, lbs, oz, etc.)
    originalAmount?: number; // Original purchase amount
    originalUnit?: string;   // Original purchase unit
  };

  // Visual quantity estimation
  visualLevel?: 'empty' | 'quarter' | 'half' | 'threeQuarter' | 'full';

  // Recipe reservations
  reservations?: {
    recipeId: string;
    recipeName: string;
    quantity: number;
    unit: string;
  }[];
}

export interface ShoppingItem {
  id: string;
  item: string;
  category: string;
  checked: boolean;
  quantity?: number | string; // Can be a number or string like "2 cups", "1 tbsp"
  source?: string; // How the item was added (e.g., "suggested", "recipe: Chicken Stir Fry")
  purchasedQuantity?: {
    amount: number;
    unit: string;
  }; // Quantity actually purchased
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
  cookTime: string;
  type?: string;
  image?: string;
}

export interface SavedRecipe extends StructuredRecipe {
  id: string;
  dateSaved: string;
  imagePlaceholder?: string; // CSS color or placeholder ID
  image?: string; // URL to recipe image
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

export interface RecipeRating {
  id: string;
  recipeTitle: string;
  rating: number;
  comment: string;
  userName: string;
  userAvatar?: string;
  date: string;
  recipe?: StructuredRecipe;
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
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: 'email' | 'google' | 'facebook';
  hasSeenTutorial: boolean;
  subscription?: Subscription;
  profile?: UserProfile;
  customCategories?: CustomCategory[];
  householdId?: string;
  householdMembers?: HouseholdMember[];
}

export interface UserProfile {
  height?: number; // in inches (stored as total inches, displayed as ft/in)
  weight?: number; // in pounds
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  dietGoal?: 'lose-weight' | 'maintain-weight' | 'gain-weight' | 'build-muscle' | 'improve-health';
  activityLevel?: 'sedentary' | 'lightly-active' | 'moderately-active' | 'very-active' | 'extremely-active';
  dietaryRestrictions?: string[];
  allergies?: string[];
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

export interface Household {
  id: string;
  name: string;
  members: Member[];
  memberIds?: string[]; // convenience array of member UIDs for fast rule checks
}

export interface Member {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'member';
  status?: 'Active' | 'Invited' | 'Inactive';
  joinedAt: string;
}