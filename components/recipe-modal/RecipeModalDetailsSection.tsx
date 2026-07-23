import React, { useMemo } from 'react';
import { Minus, Plus, Check, AlertTriangle, AlertCircle } from 'lucide-react';
import { Household, RecipeRating, SavedRecipe, StructuredRecipe, PantryItem } from '../../types';

interface RecipeModalDetailsSectionProps {
  editable: boolean;
  servings: number;
  setServings: React.Dispatch<React.SetStateAction<number>>;
  editIngredientsText: string;
  setEditIngredientsText: React.Dispatch<React.SetStateAction<string>>;
  editInstructionsText: string;
  setEditInstructionsText: React.Dispatch<React.SetStateAction<string>>;
  scaledIngredients: string[];
  recipe: StructuredRecipe | SavedRecipe;
  onRate?: (rating: RecipeRating) => void;
  showReviewPrompt: boolean;
  setShowReviewPrompt: React.Dispatch<React.SetStateAction<boolean>>;
  onRatingSubmitted: (rating: RecipeRating) => void;
  household?: Household | null;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  ratingRef: React.RefObject<HTMLDivElement | null>;
  inventory?: PantryItem[];
  activeTab?: 'ingredients' | 'instructions';
  findSubstitutions: () => void;
  showSubstitutions: boolean;
  setShowSubstitutions: React.Dispatch<React.SetStateAction<boolean>>;
  ingredientSubstitutions: {
    ingredient: string;
    inPantry: boolean;
    substitutes: { name: string; ratio: string; notes: string; inPantry: boolean }[];
  }[];
}

export const RecipeModalDetailsSection: React.FC<RecipeModalDetailsSectionProps> = ({
  editable,
  servings,
  setServings,
  editIngredientsText,
  setEditIngredientsText,
  editInstructionsText,
  setEditInstructionsText,
  scaledIngredients,
  recipe,
  onRate: _onRate,
  showReviewPrompt: _showReviewPrompt,
  setShowReviewPrompt: _setShowReviewPrompt,
  onRatingSubmitted: _onRatingSubmitted,
  household: _household,
  user: _user,
  ratingRef: _ratingRef,
  inventory = [],
  activeTab = 'ingredients',
  findSubstitutions,
  showSubstitutions,
  setShowSubstitutions,
  ingredientSubstitutions,
}) => {
  const matchedList = useMemo(() => {
    if (!inventory || inventory.length === 0 || !recipe.ingredients) return [];

    const ingredients = recipe.ingredients || [];
    return ingredients.map((ing) => {
      const name = ing
        .replace(/^[\d\/\s\.\-]+(cups?|tbsps?|tsps?|g|oz|lbs?|ml|pack(et)?s?|cans?|pieces?|cloves?|slices?|jars?|bottles?)?\s+/i, '')
        .toLowerCase()
        .trim();

      const match = inventory.find(pi => {
        const piName = pi.item.toLowerCase();
        return piName.includes(name) || name.includes(piName);
      });

      if (match) {
        const daysRemaining = match.expirationDate
          ? Math.ceil((new Date(match.expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : undefined;
        const expiringSoon = daysRemaining !== undefined && daysRemaining <= 3 && !match.is_immortal;
        return {
          status: expiringSoon ? 'expiring' as const : 'available' as const,
          pantryItem: match
        };
      }

      return { status: 'missing' as const };
    });
  }, [recipe.ingredients, inventory]);

  return (
    <>
      {editable ? (
        <>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-[var(--accent-color)] uppercase">Ingredients</h4>
            </div>
            <div className="space-y-2">
              {editIngredientsText
                .split('\n')
                .concat(['', '', '', ''])
                .slice(0, Math.max(4, editIngredientsText.split('\n').length))
                .map((ingredient, index) => (
                  <input
                    key={index}
                    value={ingredient}
                    onChange={(e) => {
                      const lines = editIngredientsText.split('\n');
                      if (index < lines.length) {
                        lines[index] = e.target.value;
                      } else {
                        lines.push(e.target.value);
                      }
                      setEditIngredientsText(lines.join('\n'));
                    }}
                    placeholder={`Ingredient ${index + 1}`}
                    className="w-full px-3 py-2 border border-theme rounded-lg bg-theme-primary text-theme-primary focus:border-[var(--accent-color)] focus:outline-none text-sm"
                  />
                ))}
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-[var(--accent-color)] uppercase">Instructions</h4>
            </div>
            <div className="space-y-2">
              {editInstructionsText
                .split('\n')
                .concat(['', '', '', ''])
                .slice(0, Math.max(4, editInstructionsText.split('\n').length))
                .map((instruction, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-sm font-medium text-theme-secondary mt-2 min-w-[20px]">{index + 1}.</span>
                    <input
                      value={instruction}
                      onChange={(e) => {
                        const lines = editInstructionsText.split('\n');
                        if (index < lines.length) {
                          lines[index] = e.target.value;
                        } else {
                          lines.push(e.target.value);
                        }
                        setEditInstructionsText(lines.join('\n'));
                      }}
                      placeholder={`Step ${index + 1}`}
                      className="flex-1 px-3 py-2 border border-theme rounded-lg bg-theme-primary text-theme-primary focus:border-[var(--accent-color)] focus:outline-none text-sm"
                    />
                  </div>
                ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Ingredients Tab */}
          {activeTab === 'ingredients' && (
            <div className="animate-fade-in space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-[var(--accent-color)] uppercase tracking-wider">Servings</h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setServings(Math.max(1, servings - 1))}
                      className="w-8 h-8 rounded-full bg-theme-secondary/20 hover:bg-theme-secondary/30 flex items-center justify-center text-theme-primary font-bold transition-all active:scale-90"
                      aria-label="Decrease servings"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-base font-bold text-theme-primary min-w-[2rem] text-center">{servings}</span>
                    <button
                      onClick={() => setServings(servings + 1)}
                      className="w-8 h-8 rounded-full bg-theme-secondary/20 hover:bg-theme-secondary/30 flex items-center justify-center text-theme-primary font-bold transition-all active:scale-90"
                      aria-label="Increase servings"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-theme-secondary opacity-75">Adjust servings to scale ingredients proportionally (assumes base of 4 servings)</p>
              </div>

              <div className="pt-2">
                <h4 className="text-xs font-bold text-[var(--accent-color)] uppercase tracking-wider mb-3">Ingredients List</h4>
                <ul className="space-y-2.5 text-theme-secondary opacity-95">
                  {Array.isArray(scaledIngredients) && scaledIngredients.length > 0 ? (
                    scaledIngredients.map((ingredient, index) => {
                      const match = matchedList[index];
                      let icon = <Plus className="w-4 h-4 text-theme-secondary opacity-50 flex-shrink-0" />;
                      let textClass = "text-theme-secondary opacity-80";
                      let badge = null;

                      if (match) {
                        if (match.status === 'available') {
                          icon = <Check className="w-4 h-4 text-green-500 flex-shrink-0" />;
                          textClass = "text-theme-primary font-medium";
                          badge = <span className="text-[9px] bg-green-500/10 text-green-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">in pantry</span>;
                        } else if (match.status === 'expiring') {
                          icon = <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />;
                          textClass = "text-theme-primary font-medium";
                          badge = <span className="text-[9px] bg-yellow-500/10 text-yellow-500 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">expiring soon</span>;
                        }
                      }

                      return (
                        <li key={index} className="flex items-center gap-2.5 py-0.5 border-b border-theme/5 pb-2 last:border-b-0">
                          {icon}
                          <span className={`text-sm ${textClass} flex-1 min-w-0 truncate`}>{ingredient}</span>
                          {badge}
                        </li>
                      );
                    })
                  ) : (
                    <li className="text-sm text-theme-secondary opacity-60 italic">No ingredients listed.</li>
                  )}
                </ul>
              </div>

              {/* Ingredient Substitutions Button */}
              <div className="pt-4 border-t border-theme/5">
                <button
                  onClick={findSubstitutions}
                  className="w-full py-2.5 px-4 bg-theme-secondary/20 hover:bg-theme-secondary/30 border border-[var(--accent-color)]/20 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold text-theme-primary transition-colors active:scale-[0.98]"
                >
                  <AlertCircle className="w-4 h-4 text-[var(--accent-color)]" />
                  <span>Ingredient Substitutions</span>
                </button>
              </div>

              {showSubstitutions && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowSubstitutions(false)}>
                  <div className="bg-theme-primary rounded-xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-[var(--accent-color)]">Ingredient Substitutions</h3>
                      <button onClick={() => setShowSubstitutions(false)} className="text-theme-secondary opacity-50 hover:opacity-100 text-xl font-bold">
                        &times;
                      </button>
                    </div>

                    {ingredientSubstitutions.length === 0 ? (
                      <p className="text-sm text-theme-secondary opacity-70 text-center py-6">No substitutions found for these ingredients.</p>
                    ) : (
                      <div className="space-y-4">
                        {ingredientSubstitutions.map((item, index) => (
                          <div key={index} className="border-l-4 border-[var(--accent-color)]/50 pl-3">
                            <p className="text-sm font-semibold text-theme-primary mb-2">{item.ingredient}</p>
                            <div className="space-y-2">
                              {item.substitutes.map((substitute, subIndex) => (
                                <div key={subIndex} className="bg-theme-secondary/10 rounded-lg px-3 py-2">
                                  <p className="text-sm font-medium text-[var(--accent-color)]">{substitute.name}</p>
                                  <p className="text-xs text-theme-secondary opacity-85">{substitute.ratio}</p>
                                  {substitute.notes && <p className="text-xs text-theme-secondary opacity-60 mt-0.5 italic">{substitute.notes}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => setShowSubstitutions(false)}
                      className="w-full mt-6 py-2.5 bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white rounded-xl font-bold text-sm"
                    >
                      Got it
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Instructions Tab */}
          {activeTab === 'instructions' && (
            <div className="animate-fade-in space-y-4">
              <h4 className="text-xs font-bold text-[var(--accent-color)] uppercase tracking-wider mb-1">Preparation Steps</h4>
              <div className="space-y-3">
                {(() => {
                  const processedSteps: string[] = [];

                  if (Array.isArray(recipe.instructions) && recipe.instructions.length > 0) {
                    recipe.instructions.forEach((instruction) => {
                      const steps = instruction.split(/(?=step \d+|STEP \d+|\d+\.)/i).filter((step) => step.trim());
                      processedSteps.push(...steps);
                    });
                  }

                  return processedSteps.length > 0 ? (
                    processedSteps.map((step, index) => {
                      const cleanStep = step
                        .replace(/^step\s+\d+\s*[-.]?\s*/i, '')
                        .replace(/^STEP\s+\d+\s*[-.]?\s*/i, '')
                        .replace(/^\d+\.\s*/, '')
                        .trim();
                      return (
                        <div key={index} className="flex gap-3 py-1 items-start border-b border-theme/5 pb-3 last:border-b-0">
                          <span className="text-xs font-bold text-[var(--accent-color)] bg-[var(--accent-color)]/10 w-5.5 h-5.5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            {index + 1}
                          </span>
                          <p className="text-sm text-theme-secondary leading-relaxed flex-1">{cleanStep}</p>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-theme-secondary opacity-60 italic">No instructions provided.</p>
                  );
                })()}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};
