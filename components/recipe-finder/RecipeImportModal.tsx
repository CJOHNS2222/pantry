import React, { useState } from 'react';
import { X, Link2, Globe } from 'lucide-react';
import { fetchRecipeFromUrl } from '../../services/importService';
import { useApp } from '../../contexts/AppContext';
import { useAppActions } from '../../contexts/AppActionsContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { saveRecipeToUserCache, submitRecipeForReview } from '../../services/recipeService';
import { log } from '../../services/logService';
import AnalyticsService from '../../services/analyticsService';
import { useAndroidBack } from '../../hooks/useAndroidBack';

interface RecipeImportModalProps {
  open: boolean;
  onClose: () => void;
}

const RecipeImportModal: React.FC<RecipeImportModalProps> = ({ open, onClose }) => {
  const { user, household } = useApp();
  const { addToast } = useAppActions();
  const modalRef = useFocusTrap({ isActive: open });
  useAndroidBack(open, onClose);
  
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewedRecipe, setPreviewedRecipe] = useState<import('../../types').StructuredRecipe | null>(null);
  const [shareWithCommunity, setShareWithCommunity] = useState(true);

  if (!open) return null;

  const handleImportRecipe = async () => {
    if (!url) {
      addToast('Please enter a recipe URL', 'info');
      return;
    }
    if (!user?.id) {
      addToast('You must be signed in to save recipes', 'error');
      return;
    }
    setLoading(true);
    try {
      let recipe = previewedRecipe;
      if (!recipe) {
        recipe = await fetchRecipeFromUrl(url);
      }
      if (!recipe) {
        addToast('Could not parse a recipe from that URL. Try a different recipe site.', 'error');
        return;
      }
      await saveRecipeToUserCache(user.id, recipe, household?.id);
      
      if (shareWithCommunity) {
        try {
          await submitRecipeForReview(recipe, user.id);
        } catch (subErr) {
          log.warn('Failed to submit imported recipe to community', { error: subErr }, 'RecipeImportModal');
        }
      }

      addToast(`Recipe saved: "${recipe.title}"`, 'success');
      setPreviewedRecipe(null);
      onClose();

      AnalyticsService.trackEvent('recipe_imported', {
        recipeTitle: recipe.title,
        sourceUrl: url,
        userId: user.id,
        sharedWithCommunity: shareWithCommunity
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error('Failed to import recipe', { error: msg }, 'RecipeImportModal');
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('unauthorized')) {
        addToast('Permission denied — make sure you are signed in and try again.', 'error');
      } else {
        addToast(`Failed to save recipe: ${msg.slice(0, 80)}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        ref={modalRef} 
        role="dialog" 
        aria-modal="true" 
        aria-label="Import Recipe" 
        className="bg-theme-primary border border-theme rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl relative animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-theme flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold font-serif text-theme-primary">Import Recipe by URL</h2>
            <p className="text-xs text-theme-secondary opacity-65">Import titles, ingredients, and instructions</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 bg-theme-secondary hover:bg-theme-secondary/80 rounded-full transition-colors"
            data-testid="import-close"
          >
            <X className="w-5 h-5 text-theme-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">
          <div className="text-xs text-theme-primary opacity-80 leading-relaxed bg-theme-secondary/25 p-3.5 rounded-2xl border border-theme flex gap-2">
            <Globe className="w-5 h-5 text-[var(--accent-color)] flex-shrink-0" />
            <span>
              Paste a recipe link from your favorite blog or website. We will try to scan it and extract the cooking details.
            </span>
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-theme-secondary uppercase tracking-wider">Recipe Link</span>
            <div className="relative">
              <Link2 className="absolute left-3.5 top-3 w-4 h-4 text-theme-secondary opacity-60" />
              <input 
                type="text" 
                value={url} 
                onChange={(e) => { setUrl(e.target.value); setPreviewedRecipe(null); }} 
                placeholder="https://example.com/some-delicious-recipe" 
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-theme bg-theme-primary text-theme-primary text-xs focus:border-[var(--accent-color)] focus:outline-none placeholder:text-theme-secondary" 
                data-testid="import-recipe-url" 
              />
            </div>
            
            <div className="flex items-center gap-2.5 pt-1 px-1">
              <input
                type="checkbox"
                id="shareWithCommunity"
                checked={shareWithCommunity}
                onChange={(e) => setShareWithCommunity(e.target.checked)}
                className="w-4 h-4 rounded border-theme bg-theme-primary text-[var(--accent-color)] focus:ring-[var(--accent-color)] focus:outline-none cursor-pointer"
              />
              <label htmlFor="shareWithCommunity" className="text-xs text-theme-secondary font-medium cursor-pointer select-none">
                Share this recipe with the community
              </label>
            </div>
          </div>

          {previewedRecipe && (
            <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl animate-fade-in space-y-2">
              <h3 className="text-xs font-bold text-emerald-500">Successfully Scanned!</h3>
              <div className="text-xs text-theme-primary font-bold truncate">{previewedRecipe.title}</div>
              <div className="flex gap-4 text-[10px] text-theme-secondary font-semibold">
                <span>{previewedRecipe.ingredients.length} Ingredients</span>
                <span>{previewedRecipe.instructions.length} Steps</span>
                {previewedRecipe.cookTime && <span>{previewedRecipe.cookTime}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-theme flex gap-3 flex-shrink-0">
          <button 
            onClick={async () => {
              if (!url) { addToast('Enter a URL first', 'info'); return; }
              setLoading(true);
              setPreviewedRecipe(null);
              try {
                const r = await fetchRecipeFromUrl(url);
                if (r) {
                  setPreviewedRecipe(r);
                  addToast(`Preview: "${r.title}" — ready to save!`, 'success');
                } else {
                  addToast('Could not parse a recipe from that URL', 'error');
                }
              } catch {
                addToast('Preview failed — check the URL and try again', 'error');
              } finally {
                setLoading(false);
              }
            }} 
            disabled={loading || !url} 
            className="flex-1 py-3 border border-theme rounded-xl text-xs font-bold hover:bg-theme-secondary transition-colors text-theme-secondary disabled:opacity-50" 
            data-testid="import-preview"
          >
            Preview Scan
          </button>

          <button 
            onClick={handleImportRecipe} 
            disabled={loading || !url} 
            className="flex-1 py-3 bg-[var(--accent-color)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--accent-color)]/90 text-white rounded-xl text-xs font-bold transition-all shadow-md" 
            data-testid="import-recipe"
          >
            {previewedRecipe ? 'Save Recipe' : 'Import Recipe'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipeImportModal;
