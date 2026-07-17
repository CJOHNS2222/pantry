import React, { useState, useEffect, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { useConfirm } from '../ui/ConfirmDialog';
import { 
  Bookmark, 
  Plus, 
  Folder, 
  FolderPlus, 
  ArrowLeft, 
  Trash2, 
  Check, 
  FolderOpen, 
  PlusCircle 
} from 'lucide-react';
import { SavedRecipe, StructuredRecipe } from '../../types';
import { Tab } from '../../types/app';
import RecipeImportModal from './RecipeImportModal';
import { RecipeCardSkeleton } from '../ui/SkeletonLoader';
import { RecipeExportModal } from './RecipeExportModal';

interface RecipeFinderSavedViewProps {
  showImportModal: boolean;
  setShowImportModal: React.Dispatch<React.SetStateAction<boolean>>;
  recipeSaveLimitExceeded: boolean;
  savedRecipes: SavedRecipe[];
  setActiveTab: (tab: Tab) => void;
  isLoadingSavedRecipes: boolean;
  savedSort: 'recent' | 'top-rated';
  setSavedSort: React.Dispatch<React.SetStateAction<'recent' | 'top-rated'>>;
  sortedSavedRecipes: SavedRecipe[];
  renderRecipeCard: (recipe: StructuredRecipe, isSavedView?: boolean, isCompact?: boolean) => React.ReactNode;
  onExportRecipes?: () => void;
  onAddManualRecipe: () => void;
}

export const RecipeFinderSavedView: React.FC<RecipeFinderSavedViewProps> = ({
  showImportModal,
  setShowImportModal,
  recipeSaveLimitExceeded,
  savedRecipes,
  setActiveTab,
  isLoadingSavedRecipes,
  savedSort,
  setSavedSort,
  sortedSavedRecipes,
  renderRecipeCard,
  onExportRecipes: _onExportRecipes,
  onAddManualRecipe,
}) => {
  const intl = useIntl();
  const confirm = useConfirm();
  const [showExportModal, setShowExportModal] = useState(false);

  // Collections State
  const [viewMode, setViewMode] = useState<'all' | 'collections'>('all');
  const [collections, setCollections] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem('recipeCollections');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch {
      return {};
    }
  });
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [recipeToOrganize, setRecipeToOrganize] = useState<StructuredRecipe | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showCreateCollectionModal, setShowCreateCollectionModal] = useState(false);

  // Persist collections when changed
  useEffect(() => {
    localStorage.setItem('recipeCollections', JSON.stringify(collections));
  }, [collections]);

  // Create a new collection
  const handleCreateCollection = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (collections[trimmed]) {
      alert('A collection with this name already exists.');
      return;
    }
    setCollections(prev => ({
      ...prev,
      [trimmed]: []
    }));
    setNewCollectionName('');
    setShowCreateCollectionModal(false);
  };

  // Delete a collection
  const handleDeleteCollection = async (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    const ok = await confirm({
      title: `Delete "${name}"?`,
      description: 'The recipes themselves will not be deleted — only the collection grouping.',
      variant: 'danger',
      confirmLabel: 'Delete Collection',
    });
    if (ok) {
      setCollections(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      if (selectedCollection === name) {
        setSelectedCollection(null);
      }
    }
  };

  // Add/Remove recipe to/from a collection
  const toggleRecipeInCollection = (collectionName: string, recipeTitle: string) => {
    setCollections(prev => {
      const currentList = prev[collectionName] || [];
      const isInList = currentList.includes(recipeTitle);
      const nextList = isInList 
        ? currentList.filter(t => t !== recipeTitle) 
        : [...currentList, recipeTitle];
      
      return {
        ...prev,
        [collectionName]: nextList
      };
    });
  };

  // Remove recipe directly from the active collection view
  const handleRemoveFromCollection = async (collectionName: string, recipeTitle: string) => {
    const ok = await confirm({
      title: `Remove from "${collectionName}"?`,
      description: `"${recipeTitle}" will be removed from this collection but not deleted from your saved recipes.`,
      variant: 'danger',
      confirmLabel: 'Remove',
    });
    if (ok) {
      setCollections(prev => ({
        ...prev,
        [collectionName]: (prev[collectionName] || []).filter(t => t !== recipeTitle)
      }));
    }
  };

  // Filter saved recipes for the active collection
  const collectionRecipes = useMemo(() => {
    return selectedCollection 
      ? sortedSavedRecipes.filter(r => (collections[selectedCollection] || []).includes(r.title))
      : [];
  }, [selectedCollection, sortedSavedRecipes, collections]);

  return (
    <div className="space-y-4">
      {showImportModal && <RecipeImportModal open={showImportModal} onClose={() => setShowImportModal(false)} />}

      {recipeSaveLimitExceeded && (
        <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-2">
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
            Save limit reached ({savedRecipes.length} saved) - upgrade to save more
          </p>
          <button
            onClick={() => setActiveTab(Tab.SETTINGS)}
            className="text-xs font-bold text-[var(--accent-color)] shrink-0 hover:opacity-80 transition-opacity"
          >
            Upgrade
          </button>
        </div>
      )}

      {/* Sub-view sliding segments */}
      <div className="flex bg-theme-secondary rounded-lg p-0.5 border border-theme w-fit shadow-sm">
        <button
          onClick={() => setViewMode('all')}
          className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
            viewMode === 'all'
              ? 'bg-theme-primary text-[var(--accent-color)] shadow-sm border border-theme'
              : 'text-theme-secondary opacity-60 hover:opacity-100'
          }`}
        >
          All Saved
        </button>
        <button
          onClick={() => setViewMode('collections')}
          className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
            viewMode === 'collections'
              ? 'bg-theme-primary text-[var(--accent-color)] shadow-sm border border-theme'
              : 'text-theme-secondary opacity-60 hover:opacity-100'
          }`}
        >
          Collections ({Object.keys(collections).length})
        </button>
      </div>

      {isLoadingSavedRecipes ? (
        <div className="grid grid-cols-3 gap-4">
          {['sk_1', 'sk_2', 'sk_3', 'sk_4', 'sk_5', 'sk_6', 'sk_7', 'sk_8'].map((id) => (
            <RecipeCardSkeleton key={id} />
          ))}
        </div>
      ) : savedRecipes.length === 0 ? (
        <div className="text-center py-12 opacity-35 bg-theme-secondary rounded-2xl border border-theme">
          <Bookmark className="w-12 h-12 mx-auto mb-2 text-theme-secondary" />
          <p className="text-sm font-medium">{intl.formatMessage({ id: 'recipes.noSaved' })}</p>
        </div>
      ) : (
        <>
          {/* ────────────────── VIEW MODE: ALL SAVED RECIPES ────────────────── */}
          {viewMode === 'all' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <button
                    onClick={() => setSavedSort('recent')}
                    aria-label="Sort by most recent"
                    aria-pressed={savedSort === 'recent'}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      savedSort === 'recent'
                        ? 'bg-[var(--accent-color)] text-white'
                        : 'bg-theme-secondary text-theme-secondary opacity-60 hover:opacity-90'
                    }`}
                  >
                    Recent
                  </button>
                  <button
                    onClick={() => setSavedSort('top-rated')}
                    aria-label="Sort by top rated"
                    aria-pressed={savedSort === 'top-rated'}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                      savedSort === 'top-rated'
                        ? 'bg-[var(--accent-color)] text-white'
                        : 'bg-theme-secondary text-theme-secondary opacity-60 hover:opacity-90'
                    }`}
                  >
                    Top Rated
                  </button>
                </div>
              </div>

              {/* Grid with hover '+' overlay to organize into collections */}
              <div className="grid grid-cols-3 gap-4">
                {sortedSavedRecipes.map(r => (
                  <div key={r.title} className="relative group rounded-xl overflow-hidden border border-theme bg-theme-secondary">
                    {renderRecipeCard(r, true, true)}
                    <button
                      onClick={() => setRecipeToOrganize(r)}
                      className="absolute top-2 right-2 p-1.5 bg-white/95 dark:bg-black/90 rounded-full shadow border border-theme text-theme-secondary hover:text-[var(--accent-color)] transition-all opacity-100 z-10"
                      title="Organize into collections"
                    >
                      <PlusCircle className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ────────────────── VIEW MODE: COLLECTIONS / COOKBOOKS ────────────────── */}
          {viewMode === 'collections' && (
            <div className="space-y-4">
              {!selectedCollection ? (
                /* Collections List Grid */
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-theme-primary">Your Custom Cookbooks</h3>
                    <button
                      onClick={() => setShowCreateCollectionModal(true)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--accent-color)] text-white text-xs font-bold shadow hover:opacity-90 transition-opacity"
                    >
                      <FolderPlus className="w-3.5 h-3.5" /> Create Cookbook
                    </button>
                  </div>

                  {Object.keys(collections).length === 0 ? (
                    <div className="text-center py-12 bg-theme-secondary rounded-2xl border border-theme opacity-50 space-y-2">
                      <FolderOpen className="w-10 h-10 mx-auto text-theme-secondary" />
                      <h4 className="font-bold text-theme-primary text-sm">No Cookbooks Yet</h4>
                      <p className="text-xs max-w-xs mx-auto">
                        Create a cookbook and group your saved recipes (e.g., "Quick Dinners" or "Holiday Treats") to plan efficiently.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(collections).map(([name, recipeTitles]) => (
                        <div
                          key={name}
                          onClick={() => setSelectedCollection(name)}
                          className="bg-theme-secondary border border-theme rounded-2xl p-4 flex items-center justify-between hover:border-[var(--accent-color)]/35 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-orange-500/10 dark:bg-orange-500/5 border border-orange-500/20 flex items-center justify-center text-orange-500 flex-shrink-0">
                              <Folder className="w-5 h-5 fill-current" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-sm text-theme-primary truncate">{name}</h4>
                              <span className="text-xs text-theme-secondary opacity-60">
                                {recipeTitles.length} {recipeTitles.length === 1 ? 'recipe' : 'recipes'}
                              </span>
                            </div>
                          </div>
                          
                          <button
                            onClick={(e) => handleDeleteCollection(e, name)}
                            className="p-2 text-theme-secondary opacity-0 group-hover:opacity-60 hover:opacity-100 hover:text-red-500 transition-all rounded-lg"
                            title="Delete cookbook"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Inside a Specific Collection */
                <div className="space-y-4">
                  {/* Cookbook Header */}
                  <div className="flex items-center justify-between border-b border-theme pb-3">
                    <button
                      onClick={() => setSelectedCollection(null)}
                      className="flex items-center gap-1 text-xs font-bold text-theme-secondary hover:text-theme-primary transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back to Cookbooks
                    </button>

                    <div className="text-right">
                      <h3 className="font-serif font-black text-lg text-theme-primary">{selectedCollection}</h3>
                      <span className="text-xs text-theme-secondary opacity-60">
                        {collectionRecipes.length} {collectionRecipes.length === 1 ? 'recipe' : 'recipes'}
                      </span>
                    </div>
                  </div>

                  {/* Cookbook Recipes Grid */}
                  {collectionRecipes.length === 0 ? (
                    <div className="text-center py-12 bg-theme-secondary rounded-2xl border border-theme opacity-50 space-y-2">
                      <Bookmark className="w-10 h-10 mx-auto text-theme-secondary" />
                      <h4 className="font-bold text-theme-primary text-sm">Empty Cookbook</h4>
                      <p className="text-xs max-w-xs mx-auto">
                        Go to the **All Saved** tab and click the "+" icon in the top-right corner of any recipe to add it here.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-4">
                      {collectionRecipes.map(r => (
                        <div key={r.title} className="relative group rounded-xl overflow-hidden border border-theme bg-theme-secondary">
                          {renderRecipeCard(r, true, true)}
                          <button
                            onClick={() => handleRemoveFromCollection(selectedCollection, r.title)}
                            className="absolute top-2 right-2 p-1 px-2 bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold rounded-lg shadow-md transition-all opacity-100 z-10"
                            title="Remove from cookbook"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Export / Add Controls (Matches original UI exactly) */}
          <div className="flex justify-end mt-6">
            <div className="flex gap-2">
              <button
                data-testid="recipefinder-import-button"
                aria-label="Import recipes from file"
                className="px-4 py-2 bg-theme-secondary text-theme-primary rounded-lg font-bold shadow hover:bg-theme-secondary/90 transition-colors text-xs"
                onClick={() => setShowImportModal(true)}
              >
                Import
              </button>
              <button
                className="px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg font-bold shadow hover:bg-[var(--accent-color)]/90 transition-colors text-xs"
                onClick={() => setShowExportModal(true)}
                data-tutorial="export-recipes"
              >
                Export Recipes
              </button>
              <button
                aria-label="Add a new recipe manually"
                className="px-4 py-2 bg-theme-secondary text-theme-primary rounded-lg font-bold shadow hover:bg-theme-secondary/80 transition-colors flex items-center gap-1 text-xs"
                onClick={onAddManualRecipe}
              >
                <Plus className="w-3.5 h-3.5" /> Add Recipe
              </button>
            </div>
          </div>
        </>
      )}

      {/* ────────────────── POPUP MODAL: ADD TO COLLECTION / ORGANIZE ────────────────── */}
      {recipeToOrganize && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" role="dialog" aria-modal="true">
          <div className="bg-theme-secondary border border-theme rounded-3xl w-full max-w-sm p-6 shadow-2xl relative animate-slide-up">
            <button
              onClick={() => setRecipeToOrganize(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-theme-primary border border-theme flex items-center justify-center text-theme-secondary hover:opacity-80 transition-opacity font-extrabold"
              aria-label="Close organization modal"
            >
              ×
            </button>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] uppercase font-black text-theme-secondary tracking-wider">Organize Recipe</span>
                <h3 className="text-xl font-serif font-black text-theme-primary truncate mt-0.5">{recipeToOrganize.title}</h3>
                <p className="text-xs text-theme-secondary opacity-65">Add this recipe to one or more cookbooks below.</p>
              </div>

              {/* List of Cookbooks */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {Object.keys(collections).length === 0 ? (
                  <p className="text-xs text-theme-secondary italic py-3 text-center opacity-60">
                    No cookbooks created yet. Create one below to get started!
                  </p>
                ) : (
                  Object.entries(collections).map(([name, titles]) => {
                    const isAdded = titles.includes(recipeToOrganize.title);
                    return (
                      <div
                        key={name}
                        onClick={() => toggleRecipeInCollection(name, recipeToOrganize.title)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isAdded
                            ? 'bg-[var(--accent-color)]/5 border-[var(--accent-color)] text-[var(--accent-color)]'
                            : 'bg-theme-primary border-theme text-theme-secondary hover:border-theme-secondary'
                        }`}
                      >
                        <span className="text-xs font-bold truncate">{name}</span>
                        {isAdded ? (
                          <Check className="w-4 h-4 text-[var(--accent-color)] shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded border border-theme shrink-0"></div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Inline Cookbook creation */}
              <div className="border-t border-theme pt-4 space-y-2">
                <span className="text-[10px] uppercase font-bold text-theme-secondary">Or Create a New Cookbook</span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="e.g. Quick Weeknight Dinners"
                    className="flex-1 px-3 py-2 rounded-lg border border-theme bg-theme-primary text-xs text-theme-primary focus:outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
                  />
                  <button
                    onClick={() => {
                      if (newCollectionName.trim()) {
                        const name = newCollectionName.trim();
                        // Create collection
                        setCollections(prev => ({
                          ...prev,
                          [name]: []
                        }));
                        // Immediately toggle recipe in it
                        toggleRecipeInCollection(name, recipeToOrganize.title);
                        setNewCollectionName('');
                      }
                    }}
                    disabled={!newCollectionName.trim()}
                    className="px-3 py-2 rounded-lg bg-theme-primary border border-theme text-[var(--accent-color)] font-bold text-xs hover:bg-theme-secondary disabled:opacity-50 transition-all shrink-0"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Save / Close */}
              <button
                onClick={() => setRecipeToOrganize(null)}
                className="w-full py-2.5 bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white font-bold rounded-xl text-xs shadow-md transition-all"
              >
                Done Organizing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── POPUP MODAL: CREATE COOKBOOK ────────────────── */}
      {showCreateCollectionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" role="dialog" aria-modal="true">
          <div className="bg-theme-secondary border border-theme rounded-3xl w-full max-w-sm p-6 shadow-2xl relative animate-slide-up">
            <button
              onClick={() => {
                setShowCreateCollectionModal(false);
                setNewCollectionName('');
              }}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-theme-primary border border-theme flex items-center justify-center text-theme-secondary hover:opacity-80 transition-opacity font-extrabold"
              aria-label="Close modal"
            >
              ×
            </button>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] uppercase font-black text-theme-secondary tracking-wider">New Cookbook</span>
                <h3 className="text-xl font-serif font-black text-theme-primary mt-0.5">Create Cookbook</h3>
                <p className="text-xs text-theme-secondary opacity-65">Organize your saved recipes into custom categories.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-theme-secondary tracking-wider">Cookbook Name</label>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="e.g. Sunday Brunch, Under 30 Mins"
                  className="w-full px-4 py-2.5 rounded-xl border border-theme bg-theme-primary text-sm text-theme-primary placeholder-theme-secondary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowCreateCollectionModal(false);
                    setNewCollectionName('');
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-theme bg-theme-primary text-theme-primary font-bold text-xs hover:bg-theme-secondary transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCreateCollection(newCollectionName)}
                  disabled={!newCollectionName.trim()}
                  className="flex-1 py-2.5 bg-[var(--accent-color)] hover:bg-[var(--accent-color)]/90 text-white font-bold rounded-xl text-xs shadow-md disabled:opacity-50 transition-all"
                >
                  Create Cookbook
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <RecipeExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          recipes={savedRecipes}
        />
      )}
    </div>
  );
};
