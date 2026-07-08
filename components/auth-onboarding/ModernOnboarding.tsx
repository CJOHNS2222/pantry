import React, { useState, useRef, useEffect } from 'react';
import {
  SkipForward,
  Sparkles,
  ChefHat,
  Users,
  ArrowRight,
  CheckCircle,
  X,
  Zap,
  Heart,
  Bell,
  UtensilsCrossed,
  ShoppingCart,
  CalendarCheck,
  Loader2,
} from 'lucide-react';
import { pushNotificationService } from '../../services/pushNotificationService';
import { getCachedPopularRecipes } from '../../services/recipeService';
import { SavedRecipe, StructuredRecipe } from '../../types';

// ── Fallback curated starters (used when Firestore returns < 24 recipes) ──────
const FALLBACK_STARTERS: Omit<SavedRecipe, 'id' | 'dateSaved'>[] = [
  { title: 'Spaghetti Carbonara', description: 'Creamy Italian pasta with pancetta and egg.', ingredients: ['200g spaghetti', '100g pancetta', '2 eggs', '50g Pecorino Romano', '2 cloves garlic', 'Black pepper', 'Salt'], instructions: ['Boil pasta in salted water.', 'Fry pancetta and garlic.', 'Beat eggs with cheese.', 'Combine pasta with pancetta, remove from heat, add egg mixture.', 'Season with pepper.'], cookTime: '20 min', type: 'Italian', image: '' },
  { title: 'Chicken Tacos', description: 'Juicy spiced chicken in warm corn tortillas.', ingredients: ['500g chicken breast', '8 corn tortillas', '1 lime', '1 avocado', 'Salsa', 'Chili powder', 'Cumin', 'Salt'], instructions: ['Season chicken with spices.', 'Grill until cooked through.', 'Slice and serve in tortillas.', 'Top with avocado and salsa.'], cookTime: '25 min', type: 'Mexican', image: '' },
  { title: 'Butter Chicken', description: 'Rich tomato-cream curry with tender chicken.', ingredients: ['600g chicken thighs', '400ml tomato puree', '200ml cream', '1 onion', '3 cloves garlic', '1 tsp garam masala', '1 tsp cumin', '1 tsp turmeric', 'Butter', 'Salt'], instructions: ['Marinate chicken in spices.', 'Cook onion and garlic in butter.', 'Add tomato puree and simmer.', 'Add chicken and cream.', 'Simmer 15 minutes.'], cookTime: '35 min', type: 'Indian', image: '' },
  { title: 'Caesar Salad', description: 'Classic crunchy romaine with Caesar dressing.', ingredients: ['1 head romaine lettuce', '50g Parmesan', '1 cup croutons', '3 tbsp Caesar dressing', '1 clove garlic', 'Lemon juice', 'Salt', 'Black pepper'], instructions: ['Tear romaine into pieces.', 'Toss with dressing, garlic and lemon.', 'Top with croutons and Parmesan.'], cookTime: '10 min', type: 'American', image: '' },
  { title: 'Fluffy Pancakes', description: 'Light and airy breakfast pancakes.', ingredients: ['1 cup flour', '1 cup milk', '1 egg', '2 tbsp butter', '1 tsp baking powder', '1 tbsp sugar', 'Pinch of salt'], instructions: ['Mix dry ingredients.', 'Whisk wet ingredients separately.', 'Combine gently.', 'Cook on buttered pan until golden.'], cookTime: '15 min', type: 'American', image: '' },
  { title: 'Ramen Noodle Bowl', description: 'Umami-rich broth with springy noodles and toppings.', ingredients: ['2 packs ramen noodles', '4 cups chicken broth', '2 soft-boiled eggs', '100g pork belly', '2 spring onions', 'Soy sauce', 'Sesame oil', 'Nori'], instructions: ['Bring broth to boil with soy sauce.', 'Cook noodles separately.', 'Assemble bowls with noodles, broth and toppings.'], cookTime: '30 min', type: 'Japanese', image: '' },
  { title: 'Beef Stew', description: 'Hearty slow-cooked beef in rich gravy.', ingredients: ['700g beef chuck', '3 potatoes', '2 carrots', '1 onion', '2 cups beef broth', '2 tbsp tomato paste', 'Thyme', 'Bay leaf', 'Salt', 'Pepper'], instructions: ['Brown beef in batches.', 'Sauté onion.', 'Add broth, tomato paste and herbs.', 'Simmer with vegetables 45 minutes.'], cookTime: '60 min', type: 'European', image: '' },
  { title: 'Grilled Salmon', description: 'Perfectly grilled salmon with lemon-herb butter.', ingredients: ['4 salmon fillets', '2 tbsp butter', '1 lemon', '2 cloves garlic', 'Fresh dill', 'Salt', 'Pepper', 'Olive oil'], instructions: ['Season salmon with salt and pepper.', 'Grill skin-side down 4 minutes.', 'Flip and grill 3 more minutes.', 'Top with garlic-herb butter.'], cookTime: '20 min', type: 'Mediterranean', image: '' },
  { title: 'Homemade Pizza', description: 'Crispy pizza with fresh tomato sauce and mozzarella.', ingredients: ['Pizza dough', '200ml tomato sauce', '200g mozzarella', 'Pepperoni', 'Fresh basil', 'Olive oil', 'Salt', 'Oregano'], instructions: ['Roll dough thin.', 'Spread sauce and add toppings.', 'Bake at 250°C for 12 minutes.', 'Top with fresh basil.'], cookTime: '40 min', type: 'Italian', image: '' },
  { title: 'Veggie Burrito Bowl', description: 'Colourful Mexican bowl with rice, beans and veggies.', ingredients: ['1 cup rice', '1 can black beans', '1 bell pepper', '1 cup corn', '1 avocado', 'Salsa', 'Lime juice', 'Cumin', 'Salt', 'Coriander'], instructions: ['Cook rice with cumin.', 'Warm beans with salt.', 'Sauté pepper and corn.', 'Build bowl with rice, beans, veggies, avocado.'], cookTime: '20 min', type: 'Mexican', image: '' },
  { title: 'Chicken Fried Rice', description: 'Quick wok-tossed fried rice with chicken and vegetables.', ingredients: ['2 cups cooked rice', '200g chicken breast', '2 eggs', '1 cup frozen peas', '2 spring onions', '3 tbsp soy sauce', 'Sesame oil', 'Garlic', 'Ginger'], instructions: ['Stir-fry chicken in hot wok.', 'Push aside and scramble eggs.', 'Add cold rice and vegetables.', 'Season with soy and sesame.'], cookTime: '20 min', type: 'Asian', image: '' },
  { title: 'Tomato Basil Soup', description: 'Velvety blended tomato soup with fresh basil.', ingredients: ['800g canned tomatoes', '1 onion', '3 cloves garlic', '200ml cream', 'Fresh basil', 'Olive oil', 'Salt', 'Pepper', 'Sugar'], instructions: ['Sauté onion and garlic.', 'Add tomatoes and simmer 20 minutes.', 'Blend until smooth.', 'Stir in cream and basil.'], cookTime: '25 min', type: 'European', image: '' },
  { title: 'Shakshuka', description: 'Eggs poached in spiced tomato and pepper sauce.', ingredients: ['6 eggs', '400g crushed tomatoes', '1 red pepper', '1 onion', '2 cloves garlic', 'Cumin', 'Paprika', 'Cayenne', 'Olive oil', 'Fresh parsley'], instructions: ['Sauté onion, pepper and garlic.', 'Add spices and tomatoes.', 'Simmer 10 minutes.', 'Make wells and crack in eggs.', 'Cover and cook until whites set.'], cookTime: '25 min', type: 'Middle Eastern', image: '' },
  { title: 'Greek Souvlaki', description: 'Herb-marinated pork skewers with tzatziki.', ingredients: ['500g pork neck', '1 lemon', '3 cloves garlic', 'Oregano', 'Olive oil', 'Salt', 'Pepper', 'Tzatziki', 'Pita bread'], instructions: ['Marinate pork in lemon, garlic and oregano.', 'Thread onto skewers.', 'Grill until charred.', 'Serve with tzatziki and pita.'], cookTime: '30 min', type: 'Greek', image: '' },
  { title: 'Thai Green Curry', description: 'Fragrant coconut curry with vegetables and chicken.', ingredients: ['500g chicken thigh', '400ml coconut milk', '2 tbsp green curry paste', '1 zucchini', '1 bell pepper', 'Thai basil', 'Fish sauce', 'Lime juice', 'Rice'], instructions: ['Fry curry paste in oil.', 'Add coconut milk.', 'Add chicken and vegetables.', 'Simmer 15 minutes.', 'Finish with fish sauce, lime and basil.'], cookTime: '25 min', type: 'Thai', image: '' },
  { title: 'Classic Chili', description: 'Bold and hearty beef and bean chili.', ingredients: ['500g ground beef', '1 can kidney beans', '400g crushed tomatoes', '1 onion', '2 cloves garlic', 'Chili powder', 'Cumin', 'Paprika', 'Salt', 'Cheddar for topping'], instructions: ['Brown beef with onion and garlic.', 'Add spices, tomatoes and beans.', 'Simmer 30 minutes.', 'Serve with cheese.'], cookTime: '45 min', type: 'American', image: '' },
  { title: 'French Omelette', description: 'Silky, buttery folded omelette.', ingredients: ['3 eggs', '1 tbsp butter', '1 tbsp cream', 'Fresh chives', 'Salt', 'Pepper'], instructions: ['Beat eggs with cream.', 'Melt butter in non-stick pan over medium heat.', 'Pour in eggs and stir gently.', 'Fold when just set.'], cookTime: '5 min', type: 'French', image: '' },
  { title: 'Honey Garlic Shrimp', description: 'Sweet and savory shrimp ready in minutes.', ingredients: ['400g shrimp, peeled', '3 cloves garlic', '3 tbsp honey', '2 tbsp soy sauce', '1 tbsp butter', 'Red pepper flakes', 'Sesame seeds'], instructions: ['Melt butter and sauté garlic.', 'Add shrimp and cook 2 minutes per side.', 'Pour in honey and soy.', 'Cook until sauce thickens.'], cookTime: '15 min', type: 'Asian', image: '' },
  { title: 'Lemon Herb Chicken', description: 'Juicy baked chicken thighs with fresh herbs.', ingredients: ['6 chicken thighs', '2 lemons', '4 cloves garlic', 'Fresh rosemary', 'Fresh thyme', 'Olive oil', 'Salt', 'Pepper'], instructions: ['Marinate chicken in lemon, garlic and herbs.', 'Bake at 200°C for 35 minutes.', 'Rest 5 minutes before serving.'], cookTime: '45 min', type: 'Mediterranean', image: '' },
  { title: 'Mushroom Risotto', description: 'Creamy Arborio rice with sautéed mushrooms.', ingredients: ['1.5 cups Arborio rice', '400g mixed mushrooms', '1 onion', '4 cups vegetable broth', '100ml white wine', '50g Parmesan', '2 tbsp butter', 'Olive oil', 'Salt', 'Thyme'], instructions: ['Sauté onion and mushrooms.', 'Add rice and toast 1 minute.', 'Add wine, then broth ladle by ladle.', 'Stir in butter and Parmesan.'], cookTime: '35 min', type: 'Italian', image: '' },
  { title: 'Black Bean Quesadillas', description: 'Crispy quesadillas stuffed with beans and cheese.', ingredients: ['4 large flour tortillas', '1 can black beans', '200g cheddar', '1 red onion', '1 jalapeño', 'Cumin', 'Sour cream', 'Salsa'], instructions: ['Mix beans with cumin and onion.', 'Layer on tortilla with cheese and jalapeño.', 'Fold and cook in dry pan until golden.', 'Serve with sour cream and salsa.'], cookTime: '15 min', type: 'Mexican', image: '' },
  { title: 'Banana Bread', description: 'Moist, sweet loaf perfect for over-ripe bananas.', ingredients: ['3 ripe bananas', '1.5 cups flour', '1 tsp baking soda', '1/2 cup sugar', '2 eggs', '1/3 cup butter', '1 tsp vanilla', 'Pinch of salt'], instructions: ['Mash bananas.', 'Mix in eggs, butter and vanilla.', 'Fold in dry ingredients.', 'Bake at 175°C for 50 minutes.'], cookTime: '60 min', type: 'Baking', image: '' },
  { title: 'Korean Bibimbap', description: 'Colourful rice bowl with veggies and gochujang.', ingredients: ['2 cups cooked rice', '1 cup spinach', '1 carrot', '1 zucchini', '100g beef mince', '2 eggs', 'Gochujang', 'Sesame oil', 'Soy sauce', 'Sesame seeds'], instructions: ['Sauté each vegetable separately.', 'Brown beef with soy sauce.', 'Fry eggs sunny side up.', 'Arrange over rice, top with gochujang.'], cookTime: '30 min', type: 'Korean', image: '' },
  { title: 'Caprese Chicken', description: 'Baked chicken topped with tomato, basil and mozzarella.', ingredients: ['4 chicken breasts', '2 tomatoes', '150g fresh mozzarella', 'Fresh basil', 'Balsamic glaze', 'Olive oil', 'Salt', 'Pepper', 'Italian seasoning'], instructions: ['Season chicken and bake 25 minutes.', 'Top with tomato and mozzarella.', 'Bake 5 more minutes.', 'Drizzle with balsamic and basil.'], cookTime: '35 min', type: 'Italian', image: '' },
];

// Build 24 fallback starters with stable IDs
const FALLBACK_24: SavedRecipe[] = FALLBACK_STARTERS.slice(0, 24).map((r, i) => ({
  ...r,
  id: `starter-${i}`,
  dateSaved: new Date().toISOString(),
}));

interface OnboardingData {
  completed: boolean;
  selectedSetup?: string | null;
  permissions?: string[];
  leftoverPersona?: 'relaxed' | 'normal' | 'strict';
}

interface ModernOnboardingProps {
  user: unknown;
  onComplete: (data: OnboardingData) => void;
  onSkip: () => void;
  onScanPantry?: () => void;
  onQuickAddItems?: () => void;
  onOpenHousehold?: () => void;
  onPersonaSelected?: (persona: 'relaxed' | 'normal' | 'strict') => void;
  // New callbacks for recipe + meal plan bootstrapping
  onSaveRecipes?: (recipes: StructuredRecipe[]) => Promise<void>;
  onAddIngredientsToList?: (items: string[]) => Promise<void>;
  onScheduleRecipes?: (recipes: StructuredRecipe[], startFromTomorrow: boolean) => Promise<void>;
}

type OnboardingStep = 'welcome' | 'notifications' | 'recipe-pick' | 'ready';

export const ModernOnboarding: React.FC<ModernOnboardingProps> = ({
  user: _user,
  onComplete,
  onSkip: _onSkip,
  onOpenHousehold,
  onSaveRecipes,
  onAddIngredientsToList,
  onScheduleRecipes,
}) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedRecipes, setSelectedRecipes] = useState<SavedRecipe[]>([]);
  const [starterRecipes, setStarterRecipes] = useState<SavedRecipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [ingredientCount, setIngredientCount] = useState(0);
  const onCompleteCalledRef = useRef(false);

  const STEPS: OnboardingStep[] = ['welcome', 'notifications', 'recipe-pick', 'ready'];

  const stepIndex = (s: OnboardingStep) => STEPS.indexOf(s);

  const handleStepTransition = (nextStep: OnboardingStep) => {
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentStep(nextStep);
      setIsAnimating(false);
    }, 300);
  };

  // Fetch popular recipes when recipe-pick step becomes active
  useEffect(() => {
    if (currentStep !== 'recipe-pick') return;
    if (starterRecipes.length > 0) return;
    setLoadingRecipes(true);
    getCachedPopularRecipes()
      .then(dbRecipes => {
        const merged = dbRecipes.length >= 24
          ? dbRecipes.slice(0, 24)
          : [...dbRecipes, ...FALLBACK_24.filter(f => !dbRecipes.some(d => d.title === f.title))].slice(0, 24);
        setStarterRecipes(merged);
      })
      .catch(() => setStarterRecipes(FALLBACK_24))
      .finally(() => setLoadingRecipes(false));
  }, [currentStep]);

  const finishOnboarding = () => {
    if (!onCompleteCalledRef.current) {
      onCompleteCalledRef.current = true;
      onComplete({ completed: true, selectedSetup: null, permissions: [], leftoverPersona: 'normal' });
    }
  };

  const toggleRecipe = (recipe: SavedRecipe) => {
    setSelectedRecipes(prev =>
      prev.some(r => r.id === recipe.id)
        ? prev.filter(r => r.id !== recipe.id)
        : [...prev, recipe]
    );
  };

  const handleCommitSelections = async () => {
    setCommitting(true);
    try {
      const recipes = selectedRecipes;
      const uniqueIngredients = Array.from(
        new Set(recipes.flatMap(r => r.ingredients || []))
      );
      if (recipes.length > 0) {
        await onSaveRecipes?.(recipes);
        await onScheduleRecipes?.(recipes, true);
        await onAddIngredientsToList?.(uniqueIngredients);
      }
      setSavedCount(recipes.length);
      setIngredientCount(uniqueIngredients.length);
    } catch {
      // Non-fatal — continue to ready step anyway
    } finally {
      setCommitting(false);
      handleStepTransition('ready');
    }
  };

  const animClass = `transition-all duration-400 ${isAnimating ? 'opacity-0 translate-x-3' : 'opacity-100 translate-x-0'}`;

  // ── STEP 1: Welcome ──────────────────────────────────────────────────────────
  const renderWelcomeStep = () => (
    <div className={animClass}>
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[var(--accent-color)] to-[var(--accent-color)]/70 rounded-3xl mb-6 shadow-xl">
          <ChefHat className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-theme-primary mb-3 font-serif">Welcome to Stock & Spoon!</h1>
        <p className="text-base text-theme-secondary leading-relaxed">
          Your AI-powered kitchen assistant. We'll get you cooking in under 2 minutes.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { icon: <Zap className="w-5 h-5" />, label: 'AI-Powered', color: 'bg-blue-500/10 text-blue-500' },
          { icon: <Users className="w-5 h-5" />, label: 'Family Share', color: 'bg-green-500/10 text-green-500' },
          { icon: <Heart className="w-5 h-5" />, label: 'Smart Recipes', color: 'bg-purple-500/10 text-purple-500' },
        ].map(f => (
          <div key={f.label} className="text-center">
            <div className={`w-12 h-12 ${f.color} rounded-2xl flex items-center justify-center mx-auto mb-2`}>
              {f.icon}
            </div>
            <span className="text-xs font-semibold text-theme-primary">{f.label}</span>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <button
          onClick={() => handleStepTransition('notifications')}
          className="w-full bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white py-4 px-6 rounded-2xl font-semibold text-base transition-all shadow-lg flex items-center justify-center gap-2"
          data-testid="onboard-get-started"
        >
          <Sparkles className="w-5 h-5" />
          Get Started
          <ArrowRight className="w-5 h-5" />
        </button>
        <button
          onClick={finishOnboarding}
          className="w-full py-3 px-6 rounded-2xl font-medium text-theme-secondary transition-all text-sm"
          data-testid="onboard-skip"
        >
          Skip for now
        </button>
      </div>
    </div>
  );

  // ── STEP 2: Notifications ────────────────────────────────────────────────────
  const renderNotificationsStep = () => {
    const [isRequesting, setIsRequesting] = useState(false);
    const handleEnable = async () => {
      setIsRequesting(true);
      try { await pushNotificationService.initialize(); } catch { /* ignore */ }
      finally { setIsRequesting(false); handleStepTransition('recipe-pick'); }
    };

    return (
      <div className={animClass}>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-2xl mb-4 shadow-lg text-white">
            <Bell className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-theme-primary mb-2">Never Waste Food Again!</h2>
          <p className="text-sm text-theme-secondary leading-relaxed">Stay on top of expiry dates, meals and household updates.</p>
        </div>

        <div className="bg-theme-secondary/30 rounded-2xl p-4 mb-6 border border-theme space-y-3">
          {[
            { icon: '⏰', title: 'Expiry Alerts', desc: 'Know what to cook before it goes off.' },
            { icon: '🍽️', title: 'Meal Reminders', desc: 'Get nudged when meal prep time approaches.' },
            { icon: '🏠', title: 'Household Updates', desc: 'See shopping list changes in real time.' },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-3">
              <span className="text-xl leading-none mt-0.5">{item.icon}</span>
              <div>
                <div className="text-sm font-semibold text-theme-primary">{item.title}</div>
                <div className="text-xs text-theme-secondary">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <button
            onClick={handleEnable}
            disabled={isRequesting}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white py-4 px-6 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            {isRequesting ? <><Loader2 className="w-5 h-5 animate-spin" />Enabling…</> : <>Enable Alerts <ArrowRight className="w-5 h-5" /></>}
          </button>
          <button
            onClick={() => handleStepTransition('recipe-pick')}
            disabled={isRequesting}
            className="w-full py-3 px-6 rounded-2xl font-medium text-theme-secondary text-sm transition-all"
          >
            Not now, maybe later
          </button>
        </div>
      </div>
    );
  };

  // ── STEP 3: Recipe Picker ────────────────────────────────────────────────────
  const renderRecipePickStep = () => (
    <div className={animClass}>
      <div className="text-center mb-5">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-orange-500 to-rose-500 rounded-2xl mb-3 shadow-lg text-white">
          <UtensilsCrossed className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-theme-primary font-serif">Pick Your First Recipes</h2>
        <p className="text-sm text-theme-secondary mt-1">
          We'll save them, schedule them on your meal plan and build your shopping list automatically.
        </p>
      </div>

      {loadingRecipes ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-color)]" />
          <span className="text-sm text-theme-secondary">Loading recipes…</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-5 max-h-[42vh] overflow-y-auto pr-1">
          {starterRecipes.map(recipe => {
            const selected = selectedRecipes.some(r => r.id === recipe.id);
            return (
              <button
                key={recipe.id}
                onClick={() => toggleRecipe(recipe)}
                className={`relative text-left p-3 rounded-2xl border-2 transition-all ${
                  selected
                    ? 'border-[var(--accent-color)] bg-[var(--accent-color)]/8 shadow-md'
                    : 'border-theme bg-theme-secondary/20 hover:border-[var(--accent-color)]/40 hover:bg-theme-secondary/40'
                }`}
              >
                {selected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle className="w-4 h-4 text-[var(--accent-color)]" />
                  </div>
                )}
                <div className="text-xs font-bold text-[var(--accent-color)] mb-0.5">{recipe.type || 'Recipe'}</div>
                <div className="text-sm font-semibold text-theme-primary leading-tight pr-5">{recipe.title}</div>
                <div className="text-xs text-theme-secondary mt-1">{recipe.cookTime}</div>
              </button>
            );
          })}
        </div>
      )}

      {selectedRecipes.length > 0 && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[var(--accent-color)]/10 rounded-xl border border-[var(--accent-color)]/20">
          <CheckCircle className="w-4 h-4 text-[var(--accent-color)] flex-shrink-0" />
          <span className="text-xs font-semibold text-theme-primary">
            {selectedRecipes.length} recipe{selectedRecipes.length !== 1 ? 's' : ''} selected
            {' · '}
            {Array.from(new Set(selectedRecipes.flatMap(r => r.ingredients || []))).length} ingredients to add
          </span>
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={handleCommitSelections}
          disabled={committing}
          className="w-full bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 disabled:opacity-60 text-white py-4 px-6 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
          data-testid="onboard-commit-recipes"
        >
          {committing ? (
            <><Loader2 className="w-5 h-5 animate-spin" />Setting up your kitchen…</>
          ) : selectedRecipes.length > 0 ? (
            <><ShoppingCart className="w-5 h-5" />Save & Build Shopping List</>
          ) : (
            <>Continue <ArrowRight className="w-5 h-5" /></>
          )}
        </button>
        <button
          onClick={() => handleStepTransition('ready')}
          disabled={committing}
          className="w-full py-3 rounded-2xl text-sm font-medium text-theme-secondary"
          data-testid="onboard-skip-recipes"
        >
          Skip this step
        </button>
      </div>
    </div>
  );

  // ── STEP 4: Ready ────────────────────────────────────────────────────────────
  const renderReadyStep = () => (
    <div className={`${animClass} text-center`}>
      <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-3xl mb-6 shadow-xl">
        <CalendarCheck className="w-10 h-10 text-white" />
      </div>

      <h2 className="text-2xl font-bold text-theme-primary mb-2 font-serif">You're All Set! 🎉</h2>
      <p className="text-sm text-theme-secondary mb-8 leading-relaxed">
        Your kitchen is ready. Here's what we've set up for you:
      </p>

      <div className="space-y-3 mb-8 text-left">
        {savedCount > 0 && (
          <div className="flex items-center gap-4 p-4 bg-emerald-500/8 border border-emerald-500/20 rounded-2xl">
            <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center">
              <Heart className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-theme-primary">{savedCount} Recipe{savedCount !== 1 ? 's' : ''} Saved</div>
              <div className="text-xs text-theme-secondary">Find them in your Saved Recipes tab</div>
            </div>
          </div>
        )}
        {savedCount > 0 && (
          <div className="flex items-center gap-4 p-4 bg-blue-500/8 border border-blue-500/20 rounded-2xl">
            <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center">
              <CalendarCheck className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-theme-primary">{savedCount} Meal{savedCount !== 1 ? 's' : ''} Scheduled</div>
              <div className="text-xs text-theme-secondary">Auto-added to your upcoming days — adjust anytime</div>
            </div>
          </div>
        )}
        {ingredientCount > 0 && (
          <div className="flex items-center gap-4 p-4 bg-orange-500/8 border border-orange-500/20 rounded-2xl">
            <div className="w-10 h-10 bg-orange-500/15 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <div className="text-sm font-bold text-theme-primary">{ingredientCount} Shopping Items Added</div>
              <div className="text-xs text-theme-secondary">Your shopping list is ready to go</div>
            </div>
          </div>
        )}
        {savedCount === 0 && ingredientCount === 0 && (
          <div className="flex items-center gap-4 p-4 bg-theme-secondary/30 border border-theme rounded-2xl">
            <div className="w-10 h-10 bg-theme-secondary/50 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-theme-primary" />
            </div>
            <div>
              <div className="text-sm font-bold text-theme-primary">Ready to Explore</div>
              <div className="text-xs text-theme-secondary">Search recipes, build your meal plan, and scan your pantry</div>
            </div>
          </div>
        )}
        {onOpenHousehold && (
          <button
            onClick={() => { finishOnboarding(); onOpenHousehold(); }}
            className="w-full flex items-center gap-4 p-4 bg-theme-secondary/20 border border-theme rounded-2xl hover:bg-theme-secondary/40 transition-colors"
          >
            <div className="w-10 h-10 bg-theme-secondary/50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-theme-primary" />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-theme-primary">Invite Family Members</div>
              <div className="text-xs text-theme-secondary">Share recipes and shopping lists</div>
            </div>
          </button>
        )}
      </div>

      <button
        onClick={finishOnboarding}
        className="w-full bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white py-4 px-6 rounded-2xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
        data-testid="onboard-finish"
      >
        <Sparkles className="w-5 h-5" />
        Let's Cook!
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex flex-col justify-end sm:justify-center overflow-hidden">
      <div className="bg-theme-primary w-full sm:max-w-lg sm:mx-auto sm:rounded-3xl shadow-2xl relative flex flex-col max-h-[92vh] rounded-t-3xl mt-6 sm:mt-0">
        {/* Close */}
        <button
          onClick={finishOnboarding}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-theme-secondary/30 hover:bg-theme-secondary/50 text-theme-secondary transition-colors"
          data-testid="onboard-close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Step label */}
        <div className="px-6 pt-5 pb-2 flex-shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-theme-secondary opacity-60">
            Step {stepIndex(currentStep) + 1} of {STEPS.length}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-4 overflow-y-auto flex-1 min-h-0">
          {currentStep === 'welcome' && renderWelcomeStep()}
          {currentStep === 'notifications' && renderNotificationsStep()}
          {currentStep === 'recipe-pick' && renderRecipePickStep()}
          {currentStep === 'ready' && renderReadyStep()}
        </div>

        {/* Progress dots */}
        <div className="px-6 pb-6 flex-shrink-0 flex justify-center gap-2">
          {STEPS.map((step, i) => (
            <div
              key={step}
              className={`rounded-full transition-all duration-300 ${
                i === stepIndex(currentStep)
                  ? 'w-5 h-2 bg-[var(--accent-color)]'
                  : i < stepIndex(currentStep)
                  ? 'w-2 h-2 bg-[var(--accent-color)]/50'
                  : 'w-2 h-2 bg-theme-secondary/30'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};