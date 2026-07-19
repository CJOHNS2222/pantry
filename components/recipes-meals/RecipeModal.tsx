import React, { useState, useMemo, useRef, useEffect } from 'react';
import { X, Star, Clock, UtensilsCrossed, Globe } from 'lucide-react';
import { useIntl } from 'react-intl';
import { StructuredRecipe, RecipeRating, SavedRecipe, PantryItem, Household, RecipeCommunityStats, User, UserProfile } from '../../types';
import { CookingMode } from './CookingMode';
import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useModalOpen } from '../../utils/useModalOpen';
import { useAndroidBack } from '../../hooks/useAndroidBack';
import { scaleRecipeIngredients, calculatePortionScaling } from '../../utils/portionUtils';
import { getUserMeasurementSystem } from '../../utils/measurementUtils';
import { useAppActions } from '../../contexts/AppActionsContext';
import AnalyticsService from '../../services/analyticsService';
import { RecipeModalActionSection } from '../recipe-modal/RecipeModalActionSection';
import { RecipeModalDetailsSection } from '../recipe-modal/RecipeModalDetailsSection';
import { RecipeModalImageSection } from '../recipe-modal/RecipeModalImageSection';
import { RecipeModalLeftoverOverlay } from '../recipe-modal/RecipeModalLeftoverOverlay';
import { RecipeModalRatingModal } from '../recipe-modal/RecipeModalRatingModal';
import { RecipeModalDeductPantryModal } from '../recipe-modal/RecipeModalDeductPantryModal';
import { parseIngredientForShoppingList, generateBlurDataURL } from '../../utils/appUtils';
import { RecipeRatingService } from '../../services/recipeRatingService';
import { ProgressiveImage } from '../ui/ProgressiveImage';
import { log } from '../../services/logService';

const parseTimeToSeconds = (time: string | number | undefined): number => {
  if (time === undefined || time === null || time === '') return 0;
  if (typeof time === 'number') return Math.max(0, Math.floor(time)) * 60;
  const match = (time || '').toString().match(/(\d+)\s*(min|minute|minutes|hour|hours|hr|h|sec|s)/i);
  if (!match) {
    const n = parseInt(time as string, 10);
    return Number.isFinite(n) && !Number.isNaN(n) ? n * 60 : 0;
  }
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('h')) return value * 3600;
  if (unit.startsWith('m')) return value * 60;
  if (unit.startsWith('s')) return value;
  return value * 60;
};

interface RecipeModalProps {
  recipe: StructuredRecipe | SavedRecipe;
  isOpen: boolean;
  onClose: () => void;
  onAddToPlan?: (recipe: StructuredRecipe) => void;
  onSaveRecipe?: (recipe: StructuredRecipe) => void;
  onDeleteRecipe?: (recipe: SavedRecipe) => void;
  onRate?: (rating: RecipeRating) => void;
  onMarkAsMade?: (recipe: StructuredRecipe, deductions?: { itemId: string; ingredient: string }[]) => void;
  onRemoveFromMealPlan?: (recipe: StructuredRecipe) => void;
  showSaveButton?: boolean;
  showDeleteButton?: boolean;
  showMarkAsMade?: boolean;
  showAddToPlan?: boolean;
  inventory?: PantryItem[];
  isFromMealPlan?: boolean;
  recipeSaveLimitExceeded?: boolean;
  mealPlanLimitExceeded?: boolean;
  recipeSavedCount?: number;
  household?: Household | null;
  user?: User | {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    profile?: UserProfile;
  };
  editable?: boolean;
  activeRecipes?: (StructuredRecipe | SavedRecipe)[];
}

export const RecipeModal: React.FC<RecipeModalProps> = ({
  recipe,
  isOpen,
  onClose,
  onAddToPlan,
  onSaveRecipe,
  onDeleteRecipe,
  onRate,
  onMarkAsMade,
  onRemoveFromMealPlan,
  showSaveButton = true,
  showDeleteButton = false,
  showMarkAsMade = false,
  showAddToPlan = true,
  inventory = [],
  isFromMealPlan = false,
  recipeSaveLimitExceeded = false,
  mealPlanLimitExceeded = false,
  recipeSavedCount,
  household = null,
  user,
  editable = false,
  activeRecipes = [],
}) => {
  const intl = useIntl();
  const { addToast } = useAppActions();
  const [showLeftoverCapture, setShowLeftoverCapture] = useState(false);
  const [showCookingMode, setShowCookingMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'ingredients' | 'instructions'>('ingredients');
  const [communityStats, setCommunityStats] = useState<RecipeCommunityStats | null>(null);
  const [servings, setServings] = useState(household?.members?.length || 4); // Default to household size
  const [isSaving, setIsSaving] = useState(false); // Prevent double-clicks
  const ratingRef = useRef<HTMLDivElement>(null);
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showDeductPantryModal, setShowDeductPantryModal] = useState(false);
  // Editable fields for recipe creation
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIngredientsText, setEditIngredientsText] = useState('');
  const [editInstructionsText, setEditInstructionsText] = useState('');
  const [editCookTime, setEditCookTime] = useState('');
  const [editType, setEditType] = useState('Dinner');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitForInclusion, setSubmitForInclusion] = useState(false);
  
  // Focus trap for accessibility
  const modalRef = useFocusTrap({ isActive: isOpen });
  useModalOpen();
  useAndroidBack(isOpen, onClose);

  // Reset saving state when modal opens/closes & Fetch Community Stats
  useEffect(() => {
    if (isOpen) {
      setIsSaving(false);
      // Track recipe view
      AnalyticsService.trackRecipeView(
        recipe.id || recipe.title,
        recipe.title,
        isFromMealPlan ? 'meal_plan' : 'search'
      );

      // Fetch Community Rating Stats
      if (recipe.title) {
        RecipeRatingService.getCommunityStats(recipe.title, household?.id || undefined)
          .then(setCommunityStats)
          .catch(err => log.error('Failed to load community stats in RecipeModal', { err }));
      }
    }
  }, [isOpen, recipe, isFromMealPlan, household?.id]);

  // Populate editable fields when modal opens for editing
  useEffect(() => {
    if (isOpen && editable && recipe) {
      setEditTitle(recipe.title || '');
      setEditDescription(recipe.description || '');
      setEditIngredientsText(Array.isArray(recipe.ingredients) ? recipe.ingredients.join('\n') : '');
      setEditInstructionsText(Array.isArray(recipe.instructions) ? recipe.instructions.join('\n') : '');
      setEditCookTime(typeof recipe.cookTime === 'string' ? recipe.cookTime : String(recipe.cookTime || ''));
      setEditType(recipe.type || 'Dinner');
      setImagePreview(recipe.image || null);
      setImageFile(null);
      setSubmitForInclusion(false);
    }
  }, [isOpen, editable, recipe]);
  // Smart Substitutions State
  const [showSubstitutions, setShowSubstitutions] = useState(false);
  const [ingredientSubstitutions, setIngredientSubstitutions] = useState<{ingredient: string, substitutes: {name: string, ratio: string, notes: string}[]}[]>([]);

  // Sub-modal back-button registration (LIFO — closed inner-first)
  useAndroidBack(showCookingMode, () => setShowCookingMode(false));
  useAndroidBack(showLeftoverCapture, () => setShowLeftoverCapture(false));
  useAndroidBack(showReviewPrompt, () => setShowReviewPrompt(false));
  useAndroidBack(showRatingModal, () => setShowRatingModal(false));
  useAndroidBack(showSubstitutions, () => setShowSubstitutions(false));

  // Keyboard navigation support
  useKeyboardNavigation({
    onEscape: onClose,
    enabled: isOpen
  });

  // Common ingredient substitution lookup
  const SUBSTITUTIONS: Record<string, {name: string, ratio: string, notes: string}[]> = {
    'butter': [
      { name: 'Coconut oil', ratio: '1:1', notes: 'Works well in most baking; adds slight coconut flavour' },
      { name: 'Vegetable oil', ratio: '¾ cup per 1 cup butter', notes: 'Best for moist cakes and quick breads' },
      { name: 'Applesauce', ratio: '½ cup per 1 cup butter', notes: 'Reduces fat; best in muffins and brownies' },
    ],
    'egg': [
      { name: 'Flaxseed meal + water', ratio: '1 tbsp flax + 3 tbsp water per egg', notes: 'Let sit 5 min; great binder for baking' },
      { name: 'Applesauce', ratio: '¼ cup per egg', notes: 'Adds moisture; best in cakes and muffins' },
      { name: 'Plain yogurt', ratio: '¼ cup per egg', notes: 'Adds richness; good for dense baked goods' },
    ],
    'milk': [
      { name: 'Almond milk', ratio: '1:1', notes: 'Neutral flavour; works in most recipes' },
      { name: 'Oat milk', ratio: '1:1', notes: 'Slightly sweet; great for baking and sauces' },
      { name: 'Coconut milk', ratio: '1:1', notes: 'Richer; adds coconut flavour to sweet dishes' },
    ],
    'buttermilk': [
      { name: 'Milk + vinegar', ratio: '1 cup milk + 1 tbsp white vinegar', notes: 'Let sit 5 min before using' },
      { name: 'Plain yogurt', ratio: '1:1', notes: 'Thin with a little water if needed' },
    ],
    'heavy cream': [
      { name: 'Evaporated milk', ratio: '1:1', notes: 'Lower fat; works in soups and sauces' },
      { name: 'Coconut cream', ratio: '1:1', notes: 'Dairy-free; adds subtle coconut flavour' },
    ],
    'cream': [
      { name: 'Evaporated milk', ratio: '1:1', notes: 'Lower fat; works in soups and sauces' },
      { name: 'Coconut cream', ratio: '1:1', notes: 'Dairy-free substitute' },
    ],
    'flour': [
      { name: 'Almond flour', ratio: '1:1 (may need extra egg)', notes: 'Denser, gluten-free; great for cookies' },
      { name: 'Oat flour', ratio: '1:1', notes: 'Mild flavour; good for pancakes and muffins' },
      { name: 'Cornstarch (as thickener)', ratio: '1 tbsp per 2 tbsp flour', notes: 'Use only for thickening sauces' },
    ],
    'sugar': [
      { name: 'Honey', ratio: '¾ cup per 1 cup sugar', notes: 'Reduce liquids by ¼ cup; lower oven temp by 25°F' },
      { name: 'Maple syrup', ratio: '¾ cup per 1 cup sugar', notes: 'Reduce liquids slightly; adds warm flavour' },
      { name: 'Coconut sugar', ratio: '1:1', notes: 'Less processed; slight caramel flavour' },
    ],
    'brown sugar': [
      { name: 'White sugar + molasses', ratio: '1 cup sugar + 1 tbsp molasses', notes: 'Mix well before using' },
      { name: 'Coconut sugar', ratio: '1:1', notes: 'Similar depth of flavour' },
    ],
    'olive oil': [
      { name: 'Vegetable oil', ratio: '1:1', notes: 'Neutral flavour; good for high-heat cooking' },
      { name: 'Avocado oil', ratio: '1:1', notes: 'High smoke point; great for sautéing' },
    ],
    'vegetable oil': [
      { name: 'Olive oil', ratio: '1:1', notes: 'Adds flavour; best for lower-heat cooking' },
      { name: 'Coconut oil', ratio: '1:1', notes: 'Solid at room temp; slight coconut flavour' },
      { name: 'Applesauce', ratio: '1:1', notes: 'For baking only; reduces fat significantly' },
    ],
    'sour cream': [
      { name: 'Plain Greek yogurt', ratio: '1:1', notes: 'Higher protein; slightly tangier' },
      { name: 'Crème fraîche', ratio: '1:1', notes: 'Richer texture; milder tang' },
    ],
    'cream cheese': [
      { name: 'Mascarpone', ratio: '1:1', notes: 'Richer and less tangy' },
      { name: 'Plain Greek yogurt', ratio: '1:1 (drained)', notes: 'Lower fat; tangier flavour' },
    ],
    'parmesan': [
      { name: 'Pecorino Romano', ratio: '1:1', notes: 'Sharper and saltier' },
      { name: 'Nutritional yeast', ratio: '1:1', notes: 'Dairy-free; nutty, cheesy flavour' },
    ],
    'chicken broth': [
      { name: 'Vegetable broth', ratio: '1:1', notes: 'Good vegetarian substitute' },
      { name: 'Water + bouillon cube', ratio: '1 cup water + 1 cube', notes: 'Quick pantry fix' },
    ],
    'beef broth': [
      { name: 'Vegetable broth', ratio: '1:1', notes: 'Lighter; add a dash of soy sauce for depth' },
      { name: 'Water + bouillon cube', ratio: '1 cup water + 1 cube', notes: 'Good enough for most stews' },
    ],
    'lemon juice': [
      { name: 'White wine vinegar', ratio: '½ tsp per 1 tsp lemon juice', notes: 'More acidic; use less' },
      { name: 'Apple cider vinegar', ratio: '½ tsp per 1 tsp lemon juice', notes: 'Mild fruitiness' },
      { name: 'Lime juice', ratio: '1:1', notes: 'Similar acidity; slightly different flavour' },
    ],
    'vinegar': [
      { name: 'Lemon juice', ratio: '1:1', notes: 'Brighter, citrusy acidity' },
      { name: 'White wine', ratio: '2:1', notes: 'Less acidic; good in sauces' },
    ],
    'soy sauce': [
      { name: 'Tamari', ratio: '1:1', notes: 'Gluten-free; slightly richer' },
      { name: 'Coconut aminos', ratio: '1:1', notes: 'Soy-free; slightly sweeter' },
      { name: 'Worcestershire sauce', ratio: '1:1', notes: 'Adds umami; slightly different flavour' },
    ],
    'honey': [
      { name: 'Maple syrup', ratio: '1:1', notes: 'Vegan alternative; slightly thinner' },
      { name: 'Agave syrup', ratio: '1:1', notes: 'Milder; vegan-friendly' },
      { name: 'Sugar', ratio: '¾ cup per 1 cup honey + 1 tbsp water', notes: 'Adjust liquids accordingly' },
    ],
    'baking powder': [
      { name: 'Baking soda + cream of tartar', ratio: '¼ tsp soda + ½ tsp cream of tartar per 1 tsp baking powder', notes: 'Use immediately after mixing' },
      { name: 'Baking soda + yogurt', ratio: '¼ tsp soda per 1 tsp baking powder (reduce liquids)', notes: 'Adds slight tang' },
    ],
    'baking soda': [
      { name: 'Baking powder', ratio: '3 tsp per 1 tsp baking soda', notes: 'Less effective leavening; may affect taste' },
    ],
    'vanilla extract': [
      { name: 'Vanilla bean paste', ratio: '1:1', notes: 'Stronger flavour with visible seeds' },
      { name: 'Almond extract', ratio: '½ tsp per 1 tsp vanilla', notes: 'More intense; pairs well with fruit' },
      { name: 'Maple syrup', ratio: '1:1', notes: 'Adds sweetness alongside flavour' },
    ],
    'breadcrumbs': [
      { name: 'Rolled oats', ratio: '1:1', notes: 'Pulse in blender for finer crumb' },
      { name: 'Crushed crackers', ratio: '1:1', notes: 'Works well as a topping or binder' },
      { name: 'Almond flour', ratio: '1:1', notes: 'Gluten-free option; slightly nutty' },
    ],
    'cornstarch': [
      { name: 'Arrowroot powder', ratio: '1:1', notes: 'Works better at lower temps; stays clear' },
      { name: 'Flour', ratio: '2 tbsp per 1 tbsp cornstarch', notes: 'Less effective; may cloud sauces' },
    ],
    'tomato paste': [
      { name: 'Tomato sauce', ratio: '3 tbsp per 1 tbsp paste (reduce other liquids)', notes: 'Less concentrated; adjust seasoning' },
      { name: 'Ketchup', ratio: '1:1', notes: 'Sweeter; works in a pinch' },
    ],
    'mayo': [
      { name: 'Plain Greek yogurt', ratio: '1:1', notes: 'Lighter; tangier flavour' },
      { name: 'Sour cream', ratio: '1:1', notes: 'Richer; similar creaminess' },
    ],
    'mayonnaise': [
      { name: 'Plain Greek yogurt', ratio: '1:1', notes: 'Lighter; tangier flavour' },
      { name: 'Sour cream', ratio: '1:1', notes: 'Richer; similar creaminess' },
    ],
    'mustard': [
      { name: 'Horseradish', ratio: '1:1', notes: 'Spicier; use sparingly' },
      { name: 'Wasabi', ratio: 'use half the amount', notes: 'Much hotter; use carefully' },
    ],
    'garlic': [
      { name: 'Garlic powder', ratio: '⅛ tsp per clove', notes: 'Less pungent; no texture' },
      { name: 'Shallots', ratio: '1 shallot per 2 cloves', notes: 'Milder; adds slight sweetness' },
    ],
    'onion': [
      { name: 'Onion powder', ratio: '1 tsp per medium onion', notes: 'No texture; works in cooked dishes' },
      { name: 'Leeks', ratio: '1:1 (white part only)', notes: 'Milder flavour; same technique' },
      { name: 'Shallots', ratio: '3 shallots per 1 onion', notes: 'Sweeter, more delicate' },
    ],
    'wine': [
      { name: 'Broth (chicken or veg)', ratio: '1:1', notes: 'Reduces richness; non-alcoholic' },
      { name: 'Grape juice + vinegar', ratio: '¾ cup juice + splash of vinegar per 1 cup wine', notes: 'Closest flavour match' },
    ],
    'red wine': [
      { name: 'Beef broth', ratio: '1:1', notes: 'Savoury; works well in stews and braises' },
      { name: 'Cranberry juice', ratio: '1:1', notes: 'Sweet and tart; good for braised meats' },
    ],
    'white wine': [
      { name: 'Chicken broth', ratio: '1:1', notes: 'Good in savory dishes and risotto' },
      { name: 'Apple juice', ratio: '1:1', notes: 'Adds sweetness; works in sauces' },
    ],
    // Dairy extras
    'half and half': [
      { name: 'Equal parts milk + heavy cream', ratio: '1:1 combined', notes: 'Closest substitute' },
      { name: 'Whole milk', ratio: '1:1', notes: 'Less rich; fine for most uses' },
    ],
    'evaporated milk': [
      { name: 'Heavy cream', ratio: '1:1', notes: 'Richer; use in equal amounts' },
      { name: 'Coconut milk (canned)', ratio: '1:1', notes: 'Dairy-free; adds coconut note' },
    ],
    'condensed milk': [
      { name: 'Coconut condensed milk', ratio: '1:1', notes: 'Dairy-free; similar sweetness' },
      { name: 'Evaporated milk + sugar', ratio: '1 cup evap + ¾ cup sugar (simmer until thick)', notes: 'DIY version' },
    ],
    'ricotta': [
      { name: 'Cottage cheese (blended smooth)', ratio: '1:1', notes: 'Drain first for best texture' },
      { name: 'Cream cheese (softened)', ratio: '1:1', notes: 'Richer and denser; works in pasta fillings' },
      { name: 'Tofu (silken, blended)', ratio: '1:1', notes: 'Dairy-free; add a pinch of salt' },
    ],
    'yogurt': [
      { name: 'Sour cream', ratio: '1:1', notes: 'Richer; slightly more tang' },
      { name: 'Buttermilk', ratio: '¾ cup per 1 cup yogurt (reduce other liquids)', notes: 'More liquid; best in batter' },
      { name: 'Coconut yogurt', ratio: '1:1', notes: 'Dairy-free option' },
    ],
    'whipped cream': [
      { name: 'Coconut cream (chilled, whipped)', ratio: '1:1', notes: 'Dairy-free; whip when very cold' },
      { name: 'Chilled heavy cream', ratio: '1:1', notes: 'The real thing; whip to stiff peaks' },
    ],
    'feta': [
      { name: 'Goat cheese', ratio: '1:1', notes: 'Creamier; similar tang' },
      { name: 'Halloumi (crumbled)', ratio: '1:1', notes: 'Saltier; holds up to heat' },
      { name: 'Firm tofu + lemon + salt', ratio: '1:1', notes: 'Dairy-free; marinate for 30 min' },
    ],
    'mozzarella': [
      { name: 'Provolone', ratio: '1:1', notes: 'Melts well; slightly stronger flavour' },
      { name: 'Monterey Jack', ratio: '1:1', notes: 'Very good melter; mild flavour' },
    ],
    'cheddar': [
      { name: 'Colby Jack', ratio: '1:1', notes: 'Milder; melts similarly' },
      { name: 'Gruyère', ratio: '1:1', notes: 'Nuttier flavour; excellent for gratins' },
    ],
    // Baking extras
    'cocoa powder': [
      { name: 'Carob powder', ratio: '1:1', notes: 'Naturally sweet; caffeine-free' },
      { name: 'Dark chocolate (melted)', ratio: '1 oz per 3 tbsp cocoa + reduce fat by 1 tbsp', notes: 'Richer flavour' },
    ],
    'chocolate': [
      { name: 'Cocoa powder + butter', ratio: '3 tbsp cocoa + 1 tbsp butter per 1 oz chocolate', notes: 'Works in baking; adjust sweetness' },
      { name: 'Carob chips', ratio: '1:1', notes: 'Caffeine-free; naturally sweeter' },
    ],
    'shortening': [
      { name: 'Butter', ratio: '1:1', notes: 'Adds flavour; very slight texture change' },
      { name: 'Coconut oil (solid)', ratio: '1:1', notes: 'Similar texture; slight coconut taste' },
    ],
    'lard': [
      { name: 'Butter', ratio: '1:1', notes: 'Adds flavour; works in pastry' },
      { name: 'Vegetable shortening', ratio: '1:1', notes: 'Neutral flavour; closest texture match' },
    ],
    'cream of tartar': [
      { name: 'Lemon juice', ratio: '2 tsp per 1 tsp cream of tartar', notes: 'Works for stabilising egg whites' },
      { name: 'White vinegar', ratio: '2 tsp per 1 tsp cream of tartar', notes: 'Same function; no flavour impact' },
    ],
    'molasses': [
      { name: 'Honey', ratio: '¾ cup per 1 cup molasses', notes: 'Sweeter; lighter colour' },
      { name: 'Maple syrup', ratio: '¾ cup per 1 cup molasses', notes: 'Milder; works well in marinades' },
      { name: 'Dark corn syrup', ratio: '1:1', notes: 'Similar texture; less bold' },
    ],
    'corn syrup': [
      { name: 'Honey', ratio: '1:1', notes: 'Adds flavour; use light honey if possible' },
      { name: 'Maple syrup', ratio: '1:1', notes: 'Works in most candies and bakes' },
      { name: 'Sugar + water (simple syrup)', ratio: '1¼ cups sugar + ¼ cup water per 1 cup syrup', notes: 'Simmer until dissolved' },
    ],
    'powdered sugar': [
      { name: 'Blended granulated sugar + cornstarch', ratio: '1 cup sugar + 1 tbsp cornstarch, blended fine', notes: 'Blend until powdery' },
      { name: 'Coconut sugar (blended)', ratio: '1:1', notes: 'Less sweet; slightly caramel flavour' },
    ],
    'cake flour': [
      { name: 'All-purpose flour + cornstarch', ratio: '¾ cup + 2 tbsp AP flour + 2 tbsp cornstarch per 1 cup', notes: 'Sift together before using' },
    ],
    'self-rising flour': [
      { name: 'All-purpose flour + baking powder + salt', ratio: '1 cup AP + 1½ tsp baking powder + ¼ tsp salt', notes: 'Mix before using' },
    ],
    'whole wheat flour': [
      { name: 'All-purpose flour', ratio: '1:1', notes: 'Lighter texture; loses some fibre' },
      { name: 'Spelt flour', ratio: '1:1', notes: 'Similar nutrients; slightly nuttier' },
    ],
    'yeast': [
      { name: 'Baking powder', ratio: '1 tsp per ¼ oz yeast (no rise time)', notes: 'Quick breads only; no fermentation flavour' },
      { name: 'Sourdough starter', ratio: '1 cup per packet of yeast (adjust liquid)', notes: 'Adds tang; longer rise time' },
    ],
    // Sauces & condiments
    'worcestershire sauce': [
      { name: 'Soy sauce + ketchup + vinegar', ratio: '1 tbsp soy + ½ tsp ketchup + ½ tsp vinegar per 1 tbsp', notes: 'Good approximation for marinades' },
      { name: 'Fish sauce', ratio: '1:1', notes: 'More pungent; very similar umami base' },
      { name: 'Coconut aminos + apple cider vinegar', ratio: '1 tbsp aminos + dash vinegar', notes: 'Vegan alternative' },
    ],
    'fish sauce': [
      { name: 'Soy sauce + lime juice', ratio: '1 tbsp soy + ½ tsp lime juice per 1 tbsp', notes: 'Less pungent; works in most dishes' },
      { name: 'Worcestershire sauce', ratio: '1:1', notes: 'Similar umami depth' },
      { name: 'Miso paste + water', ratio: '1 tsp miso + 1 tsp water per 1 tbsp fish sauce', notes: 'Vegan; fermented depth' },
    ],
    'hoisin sauce': [
      { name: 'Soy sauce + honey + garlic powder', ratio: '2 tbsp soy + 1 tbsp honey + ¼ tsp garlic powder', notes: 'Close substitution for glazes' },
      { name: 'Oyster sauce', ratio: '1:1', notes: 'Less sweet; similar consistency' },
    ],
    'oyster sauce': [
      { name: 'Hoisin sauce', ratio: '1:1', notes: 'Sweeter; works in stir-fries' },
      { name: 'Soy sauce + sugar', ratio: '1 tbsp soy + ½ tsp sugar', notes: 'Quick substitute; thinner' },
    ],
    'hot sauce': [
      { name: 'Chili flakes + vinegar', ratio: '½ tsp flakes + 1 tsp vinegar per 1 tbsp', notes: 'More texture; adjust heat level' },
      { name: 'Sriracha', ratio: '1:1', notes: 'Slightly thicker and garlicky' },
      { name: 'Cayenne + water + vinegar', ratio: 'pinch cayenne + 1 tsp each water and vinegar', notes: 'Very close to tabasco-style' },
    ],
    'ketchup': [
      { name: 'Tomato paste + sugar + vinegar', ratio: '2 tbsp paste + 1 tsp sugar + 1 tsp vinegar', notes: 'Mix well; closest match' },
      { name: 'BBQ sauce', ratio: '1:1', notes: 'Smokier; avoid in delicate dishes' },
    ],
    // Fats & nut butters
    'tahini': [
      { name: 'Peanut butter', ratio: '1:1', notes: 'Stronger flavour; works in sauces and dressings' },
      { name: 'Almond butter', ratio: '1:1', notes: 'Milder; good in hummus and dips' },
      { name: 'Sunflower seed butter', ratio: '1:1', notes: 'Nut-free option; similar consistency' },
    ],
    'peanut butter': [
      { name: 'Almond butter', ratio: '1:1', notes: 'Milder; slightly less protein' },
      { name: 'Sunflower butter', ratio: '1:1', notes: 'Nut-free; similar texture' },
      { name: 'Tahini', ratio: '1:1', notes: 'More savoury; great in sauces and noodles' },
    ],
    'almond butter': [
      { name: 'Peanut butter', ratio: '1:1', notes: 'Stronger flavour' },
      { name: 'Cashew butter', ratio: '1:1', notes: 'Creamier; very mild flavour' },
    ],
    'coconut oil': [
      { name: 'Vegetable oil', ratio: '1:1', notes: 'Neutral flavour; liquid at room temp' },
      { name: 'Butter', ratio: '1:1', notes: 'Adds dairy flavour; solid at room temp' },
    ],
    // Spices & aromatics
    'ginger': [
      { name: 'Ground ginger', ratio: '¼ tsp per 1 tbsp fresh', notes: 'More concentrated; no moisture' },
      { name: 'Galangal', ratio: '1:1', notes: 'Sharper, more citrusy; common in Thai cooking' },
    ],
    'ground ginger': [
      { name: 'Fresh ginger (grated)', ratio: '1 tbsp fresh per ¼ tsp ground', notes: 'More moisture; brighter flavour' },
      { name: 'Allspice + cinnamon', ratio: 'pinch of each', notes: 'Warm spice notes without the sharp bite' },
    ],
    'cinnamon': [
      { name: 'Allspice', ratio: '¼ tsp per ½ tsp cinnamon', notes: 'Bolder; use less' },
      { name: 'Nutmeg + cardamom', ratio: 'pinch each per ½ tsp cinnamon', notes: 'Warm but different aroma' },
    ],
    'cumin': [
      { name: 'Coriander', ratio: '1:1', notes: 'Earthier and citrusy; similar warmth' },
      { name: 'Chili powder', ratio: '1:1', notes: 'Contains cumin; adds other spices too' },
      { name: 'Caraway seeds', ratio: '1:1', notes: 'Similar earthy note; works in savoury dishes' },
    ],
    'paprika': [
      { name: 'Cayenne pepper', ratio: 'use ¼ the amount', notes: 'Much hotter; adjust to taste' },
      { name: 'Chili powder', ratio: '1:1', notes: 'More complex blend; similar colour' },
      { name: 'Ancho chili powder', ratio: '1:1', notes: 'Smoky and mild; great substitute' },
    ],
    'turmeric': [
      { name: 'Saffron (small pinch)', ratio: 'pinch per 1 tsp turmeric', notes: 'Similar colour; very different flavour' },
      { name: 'Curry powder', ratio: '1:1', notes: 'Contains turmeric plus other spices' },
    ],
    'cayenne': [
      { name: 'Chili flakes', ratio: '½ tsp per ¼ tsp cayenne', notes: 'Coarser texture; similar heat' },
      { name: 'Hot sauce', ratio: '1 tsp per ¼ tsp cayenne', notes: 'Adds moisture; tangy' },
      { name: 'Chili powder', ratio: '4:1 (less heat)', notes: 'Milder blend; use more' },
    ],
    'oregano': [
      { name: 'Thyme', ratio: '1:1', notes: 'Earthier; slightly more floral' },
      { name: 'Marjoram', ratio: '1:1', notes: 'Very close; milder oregano cousin' },
      { name: 'Italian seasoning', ratio: '1:1', notes: 'Contains oregano plus other herbs' },
    ],
    'thyme': [
      { name: 'Oregano', ratio: '1:1', notes: 'Bolder; works in most savoury dishes' },
      { name: 'Marjoram', ratio: '1:1', notes: 'Milder and sweeter than thyme' },
    ],
    'basil': [
      { name: 'Oregano', ratio: '1:1', notes: 'Earthier but similar Italian profile' },
      { name: 'Spinach + pinch of oregano', ratio: 'matches volume', notes: 'Adds greenery without herbiness' },
    ],
    'rosemary': [
      { name: 'Thyme', ratio: '1:1', notes: 'Milder pine notes; very compatible' },
      { name: 'Savory', ratio: '1:1', notes: 'Peppery and herby; rare but close' },
    ],
    'cilantro': [
      { name: 'Parsley', ratio: '1:1', notes: 'No citrus note; mild green flavour' },
      { name: 'Thai basil', ratio: '1:1', notes: 'Slightly anise-like; good in Asian dishes' },
    ],
    // Acids & juices
    'lime juice': [
      { name: 'Lemon juice', ratio: '1:1', notes: 'Very close; slightly less bitter' },
      { name: 'White wine vinegar', ratio: '½ tsp per 1 tsp lime', notes: 'More acidic; use less' },
    ],
    'orange juice': [
      { name: 'Tangerine juice', ratio: '1:1', notes: 'Sweeter; nearly identical' },
      { name: 'Pineapple juice', ratio: '1:1', notes: 'Sweeter and tropical' },
      { name: 'Lemon juice + water + pinch of sugar', ratio: '¼ cup lemon + ¾ cup water + 2 tbsp sugar', notes: 'Closest citrus sub' },
    ],
    // Proteins
    'anchovies': [
      { name: 'Worcestershire sauce', ratio: '1 tsp per 3 fillets', notes: 'Similar umami punch' },
      { name: 'Capers', ratio: '1:1', notes: 'Briny; no fishiness' },
      { name: 'Miso paste', ratio: '1 tsp per 3 fillets', notes: 'Vegan umami depth' },
    ],
    'tofu': [
      { name: 'Tempeh', ratio: '1:1', notes: 'More protein; nuttier and firmer texture' },
      { name: 'Chickpeas', ratio: '1:1', notes: 'Good for scrambles and curries' },
      { name: 'Paneer', ratio: '1:1', notes: 'Dairy-based; holds shape well when cooked' },
    ],
    // Nuts & seeds
    'pine nuts': [
      { name: 'Slivered almonds', ratio: '1:1', notes: 'Toast first for similar nutty warmth' },
      { name: 'Walnuts (chopped)', ratio: '1:1', notes: 'Stronger flavour; good in pesto' },
      { name: 'Sunflower seeds', ratio: '1:1', notes: 'Nut-free; toast for best flavour' },
    ],
    'walnuts': [
      { name: 'Pecans', ratio: '1:1', notes: 'Sweeter; similar crunch' },
      { name: 'Almonds', ratio: '1:1', notes: 'Drier; slightly firmer texture' },
    ],
    // Misc
    'espresso': [
      { name: 'Strong brewed coffee', ratio: '2x the amount', notes: 'Less concentrated; use double' },
      { name: 'Instant coffee + water', ratio: '1 tsp instant + 1 tbsp water per shot', notes: 'Good enough for baking' },
    ],
    'coffee': [
      { name: 'Chicory', ratio: '1:1', notes: 'Caffeine-free; similar bitter notes' },
      { name: 'Instant coffee dissolved in water', ratio: '1:1', notes: 'Use in baking for flavour' },
    ],
    'beer': [
      { name: 'Apple cider + splash of vinegar', ratio: '1:1', notes: 'Good for batters and braises' },
      { name: 'Chicken or beef broth', ratio: '1:1', notes: 'No fizz; works in stews' },
      { name: 'Ginger ale', ratio: '1:1', notes: 'Lighter; good for tempura batter' },
    ],
    'coconut milk': [
      { name: 'Evaporated milk', ratio: '1:1', notes: 'Dairy-based; no coconut flavour' },
      { name: 'Heavy cream + water', ratio: '¾ cup cream + ¼ cup water', notes: 'Similar richness' },
    ],
    'miso': [
      { name: 'Soy sauce + splash of tahini', ratio: '½ tsp soy + small dab tahini per 1 tbsp miso', notes: 'Close umami flavour' },
      { name: 'Fish sauce', ratio: '½ the amount', notes: 'Much saltier; use sparingly' },
    ],
    'arrowroot': [
      { name: 'Cornstarch', ratio: '1:1', notes: 'Works hot; may go cloudy' },
      { name: 'Tapioca starch', ratio: '1:1', notes: 'Similar; stays clear in sauces' },
    ],
    'tapioca': [
      { name: 'Cornstarch', ratio: '1:1 (for starch)', notes: 'Good thickener but different texture in puddings' },
      { name: 'Arrowroot powder', ratio: '1:1', notes: 'Closest match; stays clear' },
    ],
  };

  const findSubstitutions = () => {
    const recipeIngredients = (recipe as StructuredRecipe).ingredients || [];
    if (recipeIngredients.length === 0) return;

    const results: {ingredient: string, substitutes: {name: string, ratio: string, notes: string}[]}[] = [];

    // Sort longest keys first so "evaporated milk" matches before "milk",
    // "buttermilk" before "butter", "heavy cream" before "cream", etc.
    const sortedEntries = Object.entries(SUBSTITUTIONS).sort((a, b) => b[0].length - a[0].length);

    for (const ing of recipeIngredients) {
      const ingLower = ing.toLowerCase();
      for (const [key, subs] of sortedEntries) {
        if (ingLower.includes(key)) {
          results.push({ ingredient: ing, substitutes: subs });
          break;
        }
      }
    }

    if (results.length === 0) {
      addToast('No common substitutions found for these ingredients.', 'info');
      return;
    }

    setIngredientSubstitutions(results);
    setShowSubstitutions(true);
  };

  const handleMarkAsMadeClick = async () => {
    if (!editable && recipe.ingredients && recipe.ingredients.length > 0 && inventory && inventory.length > 0) {
      const matches: { ingredient: string; pantryItem: PantryItem; checked: boolean }[] = [];
      recipe.ingredients.forEach(ing => {
        const parsed = parseIngredientForShoppingList(ing);
        const name = parsed.itemName.toLowerCase().trim();
        const match = inventory.find(pi => {
          const piName = pi.item.toLowerCase();
          return piName.includes(name) || name.includes(piName);
        });
        if (match) {
          matches.push({ ingredient: ing, pantryItem: match, checked: true });
        }
      });

      if (matches.length > 0) {
        setShowDeductPantryModal(true);
        return;
      }
    }
    completeMarkAsMade([]);
  };

  const completeMarkAsMade = (deductions: { itemId: string; ingredient: string }[]) => {
    // Track recipe completion
    AnalyticsService.trackRecipeCompleted(
      recipe.id || recipe.title,
      recipe.title,
      parseTimeToSeconds(recipe.cookTime) / 60 // Convert to minutes
    );

    // Call the onMarkAsMade handler with inventory info
    if (onMarkAsMade) {
      onMarkAsMade(recipe as StructuredRecipe, deductions);
    }

    // Step 3: If from meal plan, remove it from the meal plan
    if (isFromMealPlan && onRemoveFromMealPlan) {
      onRemoveFromMealPlan(recipe as StructuredRecipe);
    }

    // Step 3.5: If this was triggered from the meal plan, open leftover capture
    if (isFromMealPlan) {
      // Track leftover capture start
      AnalyticsService.trackFeatureUsage('leftover_capture', {
        recipe_id: recipe.id || recipe.title,
        recipe_name: recipe.title,
        trigger: 'mark_as_made'
      });
      setShowLeftoverCapture(true);
      return; // Defer review prompt/close until leftover capture completes
    }
    // Step 4: Show rating modal
    setTimeout(() => {
      setShowRatingModal(true);
    }, 100);
  };

  const handleConfirmDeductions = (deductions: { itemId: string; ingredient: string }[]) => {
    setShowDeductPantryModal(false);
    completeMarkAsMade(deductions);
  };

  const handleSkipDeductions = () => {
    setShowDeductPantryModal(false);
    completeMarkAsMade([]);
  };

   
  const handleLeftoverSaved = (_id?: string) => {
    setShowLeftoverCapture(false);
    setTimeout(() => setShowRatingModal(true), 100);
  };

  // Scale ingredients based on servings
  const scaledIngredients = useMemo(() => {
    if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) return [];

    // Use the proper portion scaling utility
    const portionConfig = calculatePortionScaling(household, servings);
    const system = getUserMeasurementSystem(user?.profile);
    return scaleRecipeIngredients(recipe, portionConfig, system);
  }, [recipe.ingredients, servings, household, user?.profile]);

  if (!isOpen || !recipe) return null;

  // Cooking mode fullscreen overlay — rendered above the modal
  if (showCookingMode) {
    const list = activeRecipes && activeRecipes.length > 0 ? activeRecipes : [recipe];
    const initialIdx = list.findIndex(r => r.title === recipe.title);
    return (
      <CookingMode
        recipes={list as StructuredRecipe[]}
        initialIndex={initialIdx >= 0 ? initialIdx : 0}
        onExit={() => setShowCookingMode(false)}
      />
    );
  }

  const handleStartCookingMode = () => {
    AnalyticsService.trackFeatureUsage('cooking_mode', {
      recipe_id: recipe.id || recipe.title,
      recipe_name: recipe.title,
    });
    setShowCookingMode(true);
  };

  const handleEditableSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const built: StructuredRecipe & { __imageFile?: File; __submitForInclusion?: boolean } = {
        title: editTitle.trim(),
        description: editDescription.trim(),
        ingredients: editIngredientsText.split('\n').map(s => s.trim()).filter(Boolean),
        instructions: editInstructionsText.split('\n').map(s => s.trim()).filter(Boolean),
        cookTime: editCookTime.trim(),
        type: editType,
        image: imagePreview || ''
      };

      if (imageFile) built.__imageFile = imageFile;
      if (submitForInclusion) built.__submitForInclusion = true;

      if (onSaveRecipe) {
        await onSaveRecipe(built as StructuredRecipe);
      }
      AnalyticsService.trackRecipeSave((built as StructuredRecipe).id || built.title, built.title);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleNonEditableSave = async () => {
    if (isSaving || !onSaveRecipe) return;
    setIsSaving(true);
    try {
      const sanitized: StructuredRecipe = {
        title: recipe.title || '',
        description: recipe.description || '',
        ingredients: Array.isArray(recipe.ingredients) ? [...recipe.ingredients] : [],
        instructions: Array.isArray(recipe.instructions) ? [...recipe.instructions] : [],
        cookTime: recipe.cookTime || '',
        image: recipe.image
      };

      const placeholderPattern = /Full recipe not available in this rating/i;
      if (sanitized.ingredients.length === 1 && placeholderPattern.test(String(sanitized.ingredients[0]))) {
        sanitized.ingredients = [];
      }
      if (sanitized.instructions.length === 1 && placeholderPattern.test(String(sanitized.instructions[0]))) {
        sanitized.instructions = [];
      }

      await onSaveRecipe(sanitized as StructuredRecipe);
      AnalyticsService.trackRecipeSave(sanitized.id || sanitized.title, sanitized.title);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDetailsRatingSubmitted = (rating: RecipeRating) => {
    AnalyticsService.trackRecipeRating(
      recipe.id || recipe.title,
      recipe.title,
      rating.rating
    );
    if (onRate) onRate(rating);
    setShowReviewPrompt(false);
    setTimeout(() => onClose(), 300);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4 pt-[var(--safe-area-inset-top,0px)] pb-[var(--safe-area-inset-bottom,0px)]" onClick={onClose}>
      <RecipeModalLeftoverOverlay
        showLeftoverCapture={showLeftoverCapture}
        user={user}
        servings={servings}
        recipeImageUrl={recipe.image}
        recipeTitle={recipe.title}
        onSaved={(id) => handleLeftoverSaved(id)}
        onClose={() => {
          setShowLeftoverCapture(false);
          handleLeftoverSaved();
        }}
      />
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label={recipe.title} className="bg-theme-primary rounded-2xl shadow-2xl max-w-lg w-full relative flex flex-col h-full overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Render either the non-editable fixed header (image, title, rating, cook time, start cooking button, tabs) or the editable header */}
        {!editable ? (
          <div className="flex-shrink-0 bg-theme-primary border-b border-theme relative">
            {/* Relative Image container */}
            {recipe.image ? (
              <div className="relative h-48 w-full overflow-hidden">
                <ProgressiveImage
                  src={recipe.image}
                  alt={recipe.title}
                  className="w-full h-full object-cover"
                  blurDataURL={generateBlurDataURL(400, 192)}
                  placeholderSrc="/images/placeholder.svg"
                />
                {/* Close Button overlay */}
                <button
                  className="absolute top-3 right-3 bg-black/40 text-white hover:bg-black/60 rounded-full p-1.5 transition-colors shadow-md z-10"
                  onClick={onClose}
                  aria-label="Close recipe details"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              /* If no image, render a standard header with Close button */
              <div className="flex items-center justify-between p-4 pb-2">
                <span className="text-xs font-bold text-theme-secondary uppercase tracking-widest">Recipe Details</span>
                <button className="p-1 hover:bg-theme-secondary rounded-full transition-colors" onClick={onClose} aria-label="Close recipe details">
                  <X className="w-5 h-5 text-theme-secondary" />
                </button>
              </div>
            )}

            {/* Title & Metadata Area */}
            <div className="p-4 pb-3 space-y-2">
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-xl font-bold font-serif text-theme-primary leading-tight truncate flex-1">{recipe.title || 'Untitled'}</h2>
                {/* Star rating summary */}
                {communityStats && communityStats.totalRatings > 0 && (
                  <div className="flex items-center gap-1 text-sm bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-lg font-semibold flex-shrink-0">
                    <Star className="w-3.5 h-3.5 fill-yellow-500 text-yellow-500" />
                    <span>{communityStats.averageRating.toFixed(1)}</span>
                    <span className="text-xs text-theme-secondary font-normal">({communityStats.totalRatings})</span>
                  </div>
                )}
              </div>

              {recipe.description && (
                <p className="text-xs text-theme-secondary line-clamp-2 opacity-80 mb-1 leading-relaxed">{recipe.description}</p>
              )}

              {recipe.url && (
                <div className="flex items-center gap-1.5 mb-2 mt-0.5">
                  <Globe className="w-3.5 h-3.5 text-theme-secondary opacity-70 flex-shrink-0" />
                  <a
                    href={recipe.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[var(--accent-color)] hover:underline flex items-center gap-1 truncate max-w-full font-medium"
                  >
                    <span>{intl.formatMessage({ id: 'recipes.originalSource' })}</span>
                    <span className="text-[10px] opacity-75">↗</span>
                  </a>
                </div>
              )}

              {/* Cooking time & servings metadata */}
              <div className="flex items-center gap-3 text-xs text-theme-secondary">
                {recipe.cookTime && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {typeof recipe.cookTime === 'number' ? `${recipe.cookTime} mins` : recipe.cookTime}
                  </span>
                )}
                <span>•</span>
                <span>{servings} servings</span>
              </div>

              {/* Start Cooking button positioned prominent right below the metadata */}
              {Array.isArray(recipe.instructions) && recipe.instructions.some(s => s.trim()) && (
                <button
                  onClick={handleStartCookingMode}
                  className="mt-2 w-full py-2.5 bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white font-bold text-sm rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm"
                >
                  <UtensilsCrossed className="w-4 h-4" />
                  <span>Start Cooking Mode</span>
                </button>
              )}
            </div>

            {/* Panel Navigation Tabs */}
            <div className="flex border-t border-theme bg-theme-secondary/10">
              <button
                onClick={() => setActiveTab('ingredients')}
                className={`flex-1 py-2.5 text-center text-xs uppercase tracking-wider font-bold transition-all border-b-2 ${
                  activeTab === 'ingredients'
                    ? 'border-[var(--accent-color)] text-[var(--accent-color)] bg-[var(--accent-color)]/[0.02]'
                    : 'border-transparent text-theme-secondary hover:text-theme-primary'
                }`}
              >
                Ingredients
              </button>
              <button
                onClick={() => setActiveTab('instructions')}
                className={`flex-1 py-2.5 text-center text-xs uppercase tracking-wider font-bold transition-all border-b-2 ${
                  activeTab === 'instructions'
                    ? 'border-[var(--accent-color)] text-[var(--accent-color)] bg-[var(--accent-color)]/[0.02]'
                    : 'border-transparent text-theme-secondary hover:text-theme-primary'
                }`}
              >
                Steps
              </button>
            </div>
          </div>
        ) : (
          /* Editable Header (with standard Close button) */
          <div className="flex items-center justify-between p-4 pb-3 border-b border-theme flex-shrink-0 rounded-t-2xl bg-theme-primary">
            <h2 className="text-lg font-semibold text-theme-primary truncate pr-2">Edit Recipe</h2>
            <button className="p-1 hover:bg-theme-secondary rounded-full transition-colors" onClick={onClose} aria-label="Close recipe details">
              <X className="w-5 h-5 text-theme-secondary" />
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-4">
          {editable && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-2">Recipe Title</label>
                <input 
                  value={editTitle} 
                  onChange={e => setEditTitle(e.target.value)} 
                  placeholder="Enter recipe title" 
                  className="w-full px-3 py-2 border border-theme rounded-lg bg-theme-primary text-theme-primary focus:border-[var(--accent-color)] focus:outline-none" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-2">Description</label>
                <input 
                  value={editDescription} 
                  onChange={e => setEditDescription(e.target.value)} 
                  placeholder="Brief description of the recipe" 
                  className="w-full px-3 py-2 border border-theme rounded-lg bg-theme-primary text-theme-primary focus:border-[var(--accent-color)] focus:outline-none" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-primary mb-2">Meal Type</label>
                <select 
                  value={editType} 
                  onChange={e => setEditType(e.target.value)} 
                  className="w-full px-3 py-2 border border-theme rounded-lg bg-theme-primary text-theme-primary focus:border-[var(--accent-color)] focus:outline-none"
                >
                  <option value="Breakfast">Breakfast</option>
                  <option value="Lunch">Lunch</option>
                  <option value="Dinner">Dinner</option>
                  <option value="Snack">Snack</option>
                  <option value="Dessert">Dessert</option>
                  <option value="Appetizer">Appetizer</option>
                  <option value="Beverage">Beverage</option>
                  <option value="Vegan">Vegan</option>
                  <option value="Vegetarian">Vegetarian</option>
                  <option value="Keto">Keto</option>
                  <option value="Paleo">Paleo</option>
                  <option value="Gluten-Free">Gluten-Free</option>
                  <option value="Dairy-Free">Dairy-Free</option>
                  <option value="Low-Carb">Low-Carb</option>
                  <option value="Mediterranean">Mediterranean</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-primary mb-2">Cook Time</label>
                <input 
                  value={editCookTime} 
                  onChange={e => setEditCookTime(e.target.value)} 
                  placeholder="e.g., 30 mins, 1 hour 15 mins" 
                  className="w-full px-3 py-2 border border-theme rounded-lg bg-theme-primary text-theme-primary focus:border-[var(--accent-color)] focus:outline-none" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-primary mb-2">Servings</label>
                <input 
                  type="number"
                  min="1"
                  value={servings}
                  onChange={e => setServings(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-theme rounded-lg bg-theme-primary text-theme-primary focus:border-[var(--accent-color)] focus:outline-none" 
                />
              </div>

              <RecipeModalImageSection
                editable={editable}
                imagePreview={imagePreview}
                recipeImage={recipe.image}
                recipeTitle={recipe.title}
                setImageFile={setImageFile}
                setImagePreview={setImagePreview}
              />
            </div>
          )}

          <RecipeModalDetailsSection
            editable={editable}
            servings={servings}
            setServings={setServings}
            editIngredientsText={editIngredientsText}
            setEditIngredientsText={setEditIngredientsText}
            editInstructionsText={editInstructionsText}
            setEditInstructionsText={setEditInstructionsText}
            scaledIngredients={scaledIngredients}
            recipe={recipe}
            onRate={onRate}
            showReviewPrompt={showReviewPrompt}
            setShowReviewPrompt={setShowReviewPrompt}
            onRatingSubmitted={handleDetailsRatingSubmitted}
            household={household}
            user={user}
            ratingRef={ratingRef}
            inventory={inventory}
            activeTab={activeTab}
            findSubstitutions={findSubstitutions}
            showSubstitutions={showSubstitutions}
            setShowSubstitutions={setShowSubstitutions}
            ingredientSubstitutions={ingredientSubstitutions}
          />
        </div>
        <RecipeModalActionSection
          editable={editable}
          submitForInclusion={submitForInclusion}
          setSubmitForInclusion={setSubmitForInclusion}
          recipeSavedCount={recipeSavedCount}
          recipeSaveLimitExceeded={recipeSaveLimitExceeded}
          isSaving={isSaving}
          onSaveEditable={handleEditableSave}
          showMarkAsMade={showMarkAsMade}
          onMarkAsMade={onMarkAsMade}
          onMarkAsMadeClick={handleMarkAsMadeClick}
          showAddToPlan={showAddToPlan}
          onAddToPlan={onAddToPlan}
          recipe={recipe}
          onClose={onClose}
          mealPlanLimitExceeded={mealPlanLimitExceeded}
          canStartCooking={false}
          onStartCooking={handleStartCookingMode}
          isFromMealPlan={isFromMealPlan}
          onShowLeftovers={() => setShowLeftoverCapture(true)}
          showDeleteButton={showDeleteButton}
          onDeleteRecipe={onDeleteRecipe}
          showSaveButton={showSaveButton}
          onSaveRecipe={onSaveRecipe}
          onSaveNonEditable={handleNonEditableSave}
        />
      </div>

      <RecipeModalDeductPantryModal
        isOpen={showDeductPantryModal}
        recipe={recipe}
        inventory={inventory}
        onClose={handleSkipDeductions}
        onConfirm={handleConfirmDeductions}
      />

      <RecipeModalRatingModal
        showRatingModal={showRatingModal}
        setShowRatingModal={setShowRatingModal}
        recipe={recipe}
        onRate={onRate}
        onClose={onClose}
        household={household}
        user={user}
      />
    </div>
  );
};

export default RecipeModal;
