import React, { useState } from 'react';
import { RecipeRatingUI } from './RecipeRating';
import { RecipeCommunityInsights } from './RecipeCommunityInsights';
import { RecipeRecommendations } from './RecipeRecommendations';
import { StructuredRecipe } from '../types';
import { useAuth } from '../hooks/useAuth';

// Example recipe for demonstration
const exampleRecipe: StructuredRecipe = {
  id: 'spaghetti-carbonara',
  title: 'Spaghetti Carbonara',
  ingredients: [
    { name: 'spaghetti', amount: '400', unit: 'g' },
    { name: 'eggs', amount: '4', unit: 'large' },
    { name: 'pecorino romano', amount: '100', unit: 'g' },
    { name: 'pancetta', amount: '150', unit: 'g' },
    { name: 'black pepper', amount: '1', unit: 'tsp' }
  ],
  instructions: [
    'Bring a large pot of salted water to boil',
    'Cook spaghetti according to package directions',
    'Meanwhile, cook pancetta until crispy',
    'Whisk eggs and cheese together',
    'Combine hot pasta with egg mixture',
    'Season with black pepper and serve immediately'
  ],
  prepTime: 10,
  cookTime: 15,
  servings: 4,
  tags: ['italian', 'pasta', 'quick'],
  nutrition: {
    calories: 450,
    protein: 18,
    carbs: 45,
    fat: 22
  }
};

export const RecipeRatingPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedRecipe, setSelectedRecipe] = useState<StructuredRecipe | null>(null);

  const handleRecipeSelect = (recipe: StructuredRecipe) => {
    setSelectedRecipe(recipe);
    // In a real app, you might navigate to the recipe detail page
  };

  const handleRatingSubmitted = (rating: any) => {
    console.log('Rating submitted:', rating);
    // Handle rating submission (analytics, etc.)
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Recipe Rating Section */}
      <div className="bg-theme-secondary rounded-xl p-6 border border-theme">
        <h2 className="text-xl font-serif text-theme-primary mb-4">
          How was your {exampleRecipe.title}?
        </h2>

        <RecipeRatingUI
          recipeTitle={exampleRecipe.title}
          recipe={exampleRecipe}
          onRatingSubmitted={handleRatingSubmitted}
          householdId={user?.householdId}
        />
      </div>

      {/* Community Insights */}
      <RecipeCommunityInsights
        recipeTitle={exampleRecipe.title}
        householdId={user?.householdId}
      />

      {/* Personalized Recommendations */}
      <RecipeRecommendations
        pantryItems={['pasta', 'eggs', 'cheese']} // Example pantry items
        dietaryRestrictions={[]} // Could be loaded from user preferences
        onRecipeSelect={handleRecipeSelect}
      />

      {/* Selected Recipe Display */}
      {selectedRecipe && (
        <div className="bg-theme-secondary rounded-xl p-6 border border-theme">
          <h3 className="text-lg font-semibold text-theme-primary mb-2">
            Selected Recipe: {selectedRecipe.title}
          </h3>
          <p className="text-theme-secondary">
            Prep: {selectedRecipe.prepTime}min | Cook: {selectedRecipe.cookTime}min | Serves: {selectedRecipe.servings}
          </p>
        </div>
      )}
    </div>
  );
};

export default RecipeRatingPage;