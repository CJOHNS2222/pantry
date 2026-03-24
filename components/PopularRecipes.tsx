import React, { useEffect, useState } from 'react';
import { SavedRecipe, User, Household } from '../types';
import { getCachedPopularRecipes } from '../services/recipeService';
import { ProgressiveImage } from './ProgressiveImage';

interface Props {
  openRecipeModal: (recipe: SavedRecipe, isSavedView: boolean) => void;
  onAddToPlan?: (r: any) => void;
  user?: User | null;
  household?: Household | null;
  recipes?: SavedRecipe[]; // Optional prop to avoid duplicate loading
}

export const PopularRecipes: React.FC<Props> = ({ openRecipeModal, onAddToPlan, user, recipes: propRecipes }) => {
  const [recipes, setRecipes] = useState<SavedRecipe[]>(propRecipes || []);
  const [loading, setLoading] = useState(!propRecipes); // Only load if recipes not provided
  const [visible, setVisible] = useState(25);

  useEffect(() => {
    // If recipes are provided as props, use them
    if (propRecipes) {
      setRecipes(propRecipes);
      setLoading(false);
      setVisible(25);
      return;
    }

    // Otherwise, load them
    const load = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const r = await getCachedPopularRecipes();
        setRecipes(r);
        setVisible(25);
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, propRecipes]);

  if (loading) return (
    <div className="text-center py-12 opacity-50">
      <p>Loading recipes...</p>
    </div>
  );

  if (!recipes || recipes.length === 0) return (
    <div className="text-center py-12 opacity-60">
      <p>No popular recipes yet</p>
    </div>
  );

  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        {recipes.slice(0, visible).map((recipe, i) => (
          <div key={recipe.id || i} className="bg-theme-secondary rounded-lg overflow-hidden cursor-pointer hover:shadow-xl transition-all duration-200" onClick={() => openRecipeModal(recipe, false)}>
            <div className="aspect-square bg-theme-primary/20 relative overflow-hidden">
              {recipe.image ? (
                <ProgressiveImage src={recipe.image} alt={recipe.title} className="w-full h-full" lazy />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-theme-primary/10" />
              )}
            </div>
            <div className="p-2">
              <h5 className="font-semibold text-xs line-clamp-2">{recipe.title}</h5>
              <div className="text-xs text-theme-secondary opacity-70 mt-1">{recipe.cookTime}</div>
            </div>
          </div>
        ))}
      </div>

      {recipes.length > visible && (
        <div className="flex justify-center mt-4">
          <button onClick={() => setVisible(v => v + 25)} className="px-4 py-2 bg-theme-primary text-white rounded-lg">Load more</button>
        </div>
      )}
    </div>
  );
};

export default PopularRecipes;
