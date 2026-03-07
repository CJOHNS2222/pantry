import React, { useState, useEffect } from 'react';
import { ChefHat, Clock, Users, Star, ArrowRight, Sparkles, Heart, Zap } from 'lucide-react';

interface RecipeSuggestion {
  id: string;
  title: string;
  description: string;
  prepTime: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  rating: number;
  image?: string;
  tags: string[];
  ingredients: string[];
  instructions: string[];
}

interface ValueDemoProps {
  userItems: string[]; // Items the user just added
  onRecipeSelect: (recipe: RecipeSuggestion) => void;
  onSkip: () => void;
  onExploreMore: () => void;
}

export const ValueDemo: React.FC<ValueDemoProps> = ({
  userItems,
  onRecipeSelect,
  onSkip,
  onExploreMore
}) => {
  const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeSuggestion | null>(null);
  const [currentStep, setCurrentStep] = useState<'suggestions' | 'details'>('suggestions');

  // Mock recipe suggestions based on user items
  useEffect(() => {
    const generateSuggestions = async () => {
      setIsLoading(true);

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      const mockSuggestions: RecipeSuggestion[] = [
        {
          id: '1',
          title: 'Quick Pasta Primavera',
          description: 'Fresh vegetables tossed with pasta in a light garlic sauce',
          prepTime: 20,
          servings: 4,
          difficulty: 'easy',
          rating: 4.5,
          image: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=400&h=300&fit=crop',
          tags: ['vegetarian', 'quick', 'healthy'],
          ingredients: ['pasta', 'broccoli', 'bell peppers', 'garlic', 'olive oil', 'parmesan'],
          instructions: [
            'Boil pasta according to package directions',
            'Sauté vegetables in olive oil',
            'Add garlic and cook for 1 minute',
            'Toss with cooked pasta and cheese'
          ]
        },
        {
          id: '2',
          title: 'Chicken Stir-Fry Bowl',
          description: 'Tender chicken with crisp vegetables over rice',
          prepTime: 25,
          servings: 2,
          difficulty: 'medium',
          rating: 4.8,
          image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=400&h=300&fit=crop',
          tags: ['protein', 'asian', 'quick'],
          ingredients: ['chicken breast', 'rice', 'soy sauce', 'vegetables', 'ginger'],
          instructions: [
            'Cook rice according to package',
            'Slice chicken and vegetables',
            'Stir-fry chicken until cooked',
            'Add vegetables and sauce, serve over rice'
          ]
        },
        {
          id: '3',
          title: 'Avocado Toast Deluxe',
          description: 'Creamy avocado on artisanal bread with perfect toppings',
          prepTime: 10,
          servings: 1,
          difficulty: 'easy',
          rating: 4.2,
          image: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?w=400&h=300&fit=crop',
          tags: ['breakfast', 'healthy', 'vegetarian'],
          ingredients: ['bread', 'avocado', 'eggs', 'tomatoes', 'salt', 'pepper'],
          instructions: [
            'Toast bread to desired crispness',
            'Mash avocado with salt and pepper',
            'Spread on toast',
            'Top with sliced tomatoes and poached egg'
          ]
        }
      ];

      setSuggestions(mockSuggestions);
      setIsLoading(false);
    };

    generateSuggestions();
  }, [userItems]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'hard': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const handleRecipeClick = (recipe: RecipeSuggestion) => {
    setSelectedRecipe(recipe);
    setCurrentStep('details');
  };

  const handleBackToSuggestions = () => {
    setSelectedRecipe(null);
    setCurrentStep('suggestions');
  };

  if (currentStep === 'details' && selectedRecipe) {
    return (
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-theme-secondary rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white relative">
            <button
              onClick={handleBackToSuggestions}
              className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
            <h2 className="text-2xl font-bold text-center pr-12">{selectedRecipe.title}</h2>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">

            {/* Meta info */}
            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-theme-secondary" />
                <span className="text-sm text-theme-secondary">{selectedRecipe.prepTime} min</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4 text-theme-secondary" />
                <span className="text-sm text-theme-secondary">{selectedRecipe.servings} servings</span>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(selectedRecipe.difficulty)}`}>
                {selectedRecipe.difficulty}
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-500 fill-current" />
                <span className="text-sm text-theme-secondary">{selectedRecipe.rating}</span>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-6">
              {selectedRecipe.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-theme/10 text-theme-secondary rounded-full text-sm">
                  {tag}
                </span>
              ))}
            </div>

            {/* Description */}
            <p className="text-theme-primary mb-6 leading-relaxed">
              {selectedRecipe.description}
            </p>

            {/* Ingredients */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-theme-primary mb-3 flex items-center gap-2">
                <ChefHat className="w-5 h-5" />
                Ingredients
              </h3>
              <ul className="space-y-2">
                {selectedRecipe.ingredients.map((ingredient, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-[var(--accent-color)] rounded-full"></div>
                    <span className="text-theme-primary">{ingredient}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-theme-primary mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Instructions
              </h3>
              <ol className="space-y-3">
                {selectedRecipe.instructions.map((instruction, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-[var(--accent-color)] text-white rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="text-theme-primary leading-relaxed">{instruction}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => onRecipeSelect(selectedRecipe)}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:opacity-90 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                Cook This Recipe
                <ChefHat className="w-5 h-5" />
              </button>
              <button
                onClick={handleBackToSuggestions}
                className="px-6 py-3 bg-theme/10 hover:bg-theme/20 text-theme-secondary rounded-xl font-medium transition-colors"
              >
                Back to Suggestions
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-theme-secondary rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-6 text-white relative">
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="w-6 h-6" />
            <h2 className="text-2xl font-bold">See Your Pantry in Action!</h2>
            <Sparkles className="w-6 h-6" />
          </div>
          <p className="text-center text-white/90 mt-2">
            Based on what you added, here are some recipes you can make right now
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--accent-color)] border-t-transparent mb-4"></div>
              <p className="text-theme-secondary">Finding perfect recipes for you...</p>
            </div>
          ) : (
            <>
              {/* Recipe grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                {suggestions.map((recipe) => (
                  <div
                    key={recipe.id}
                    onClick={() => handleRecipeClick(recipe)}
                    className="bg-theme/5 hover:bg-theme/10 rounded-xl p-4 cursor-pointer transition-all duration-200 transform hover:scale-[1.02] border border-transparent hover:border-[var(--accent-color)]/20"
                  >

                    {/* Recipe image */}
                    <div className="w-full h-32 bg-gradient-to-br from-orange-100 to-red-100 rounded-lg mb-3 overflow-hidden">
                      {recipe.image ? (
                        <img
                          src={recipe.image}
                          alt={recipe.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // Fallback to icon if image fails to load
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center"><svg class="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"></path></svg></div>';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ChefHat className="w-8 h-8 text-orange-500" />
                        </div>
                      )}
                    </div>

                    {/* Recipe info */}
                    <h3 className="font-semibold text-theme-primary mb-2 line-clamp-2">
                      {recipe.title}
                    </h3>

                    <p className="text-sm text-theme-secondary mb-3 line-clamp-2">
                      {recipe.description}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center justify-between text-xs text-theme-secondary">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {recipe.prepTime}m
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {recipe.servings}
                        </span>
                      </div>
                      <div className={`px-2 py-1 rounded-full ${getDifficultyColor(recipe.difficulty)}`}>
                        {recipe.difficulty}
                      </div>
                    </div>

                    {/* Rating */}
                    <div className="flex items-center gap-1 mt-2">
                      <Star className="w-3 h-3 text-yellow-500 fill-current" />
                      <span className="text-xs text-theme-secondary">{recipe.rating}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={onExploreMore}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:opacity-90 text-white py-3 px-8 rounded-xl font-semibold transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl flex items-center gap-2"
                >
                  Explore More Recipes
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={onSkip}
                  className="px-8 py-3 bg-theme/10 hover:bg-theme/20 text-theme-secondary rounded-xl font-medium transition-colors"
                >
                  Skip for now
                </button>
              </div>

              {/* Value proposition */}
              <div className="mt-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 text-center">
                <Heart className="w-6 h-6 text-red-500 mx-auto mb-2" />
                <p className="text-sm text-gray-700">
                  <strong>Stock & Spoon</strong> automatically suggests recipes based on what you have,
                  reducing food waste and inspiring your cooking!
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Hook for managing value demonstrations
export const useValueDemo = () => {
  const [showDemo, setShowDemo] = useState(false);
  const [userItems, setUserItems] = useState<string[]>([]);

  const triggerDemo = (items: string[]) => {
    setUserItems(items);
    setShowDemo(true);
  };

  const hideDemo = () => {
    setShowDemo(false);
    setUserItems([]);
  };

  const hasSeenDemo = () => {
    return localStorage.getItem('value-demo-seen') === 'true';
  };

  const markDemoAsSeen = () => {
    localStorage.setItem('value-demo-seen', 'true');
  };

  return {
    showDemo,
    userItems,
    triggerDemo,
    hideDemo,
    hasSeenDemo,
    markDemoAsSeen
  };
};