import React, { useState } from 'react';
import { X, FilePlus, Link } from 'lucide-react';
import { parseCsvToPantryItems, fetchRecipeFromUrl, persistImportedPantryItems } from '../services/importService';
import { useApp } from '../contexts/AppContext';
import { InventoryCacheService } from '../services/inventoryCacheService';
import { saveRecipeToUserCache } from '../services/recipeService';
import { PantryItem } from '../types';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: 'pantry' | 'recipes';
  onImported?: (items: PantryItem[]) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ open, onClose, defaultTab = 'pantry', onImported }) => {
  const { user, household } = useApp();
  const [tab, setTab] = useState<'pantry' | 'recipes'>(defaultTab);
  const [csvText, setCsvText] = useState('');
  const [url, setUrl] = useState('');
  const [previewCount, setPreviewCount] = useState(0);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    const items = parseCsvToPantryItems(text);
    setPreviewCount(items.length);
  };

  const handleImportPantry = async () => {
    setLoading(true);
    try {
      const items = parseCsvToPantryItems(csvText);
      await persistImportedPantryItems(items, household?.id, user?.id);
      // Inform caller (e.g., current session) so UI can reflect newly imported items immediately
      try {
        if (onImported && items.length > 0) {
          onImported(items);
        }
      } catch (cbErr) {
        console.warn('onImported callback failed', cbErr);
      }
      alert(`Imported ${items.length} pantry items`);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to import pantry items');
    } finally {
      setLoading(false);
    }
  };

  const handleImportRecipe = async () => {
    if (!url) return alert('Please enter a recipe URL');
    setLoading(true);
    try {
      const recipe = await fetchRecipeFromUrl(url);
      if (!recipe) return alert('Could not parse recipe from URL');
      // Persist into user cache
      if (user?.id) {
        await saveRecipeToUserCache(user.id, recipe);
        alert(`Imported recipe: ${recipe.title}`);
        onClose();
      } else {
        alert('You must be signed in to save recipes');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to import recipe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-2xl bg-theme-primary rounded shadow-lg border border-theme">
        <div className="flex items-center justify-between p-3 border-b border-theme">
          <h3 className="text-lg font-semibold">Import</h3>
          <button onClick={onClose} className="text-theme-secondary"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setTab('pantry')} className={`px-3 py-1 rounded ${tab==='pantry'?'bg-[var(--accent-color)] text-white':'bg-theme-secondary'}`}>Pantry CSV</button>
            <button onClick={() => setTab('recipes')} className={`px-3 py-1 rounded ${tab==='recipes'?'bg-[var(--accent-color)] text-white':'bg-theme-secondary'}`}>Recipe URL</button>
          </div>

          {tab === 'pantry' ? (
            <div className="space-y-2">
              <div className="text-sm text-theme-primary">Upload a CSV file with columns like <code>item,name,amount,quantity,storageLocation,expirationDate,category</code>. Preview shows parsed rows count.</div>
              <input type="file" accept=".csv,text/csv" onChange={(e) => handleFile(e.target.files?.[0])} />
              <textarea value={csvText} onChange={(e) => { setCsvText(e.target.value); const items = parseCsvToPantryItems(e.target.value); setPreviewCount(items.length); }} rows={8} className="w-full p-2 rounded border text-black" />
              <div className="flex items-center justify-between">
                <div className="text-sm opacity-70">Parsed rows: {previewCount}</div>
                <div>
                  <button onClick={handleImportPantry} disabled={loading || previewCount===0} className="px-3 py-1 bg-[var(--accent-color)] text-white rounded">Import Pantry</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-theme-primary">Paste a recipe URL to import its title, ingredients and instructions where possible. This uses a lightweight scraper; results vary by site.</div>
              <div className="flex gap-2">
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/recipe" className="flex-1 p-2 rounded border text-black" />
                <button onClick={async () => { setLoading(true); const r = await fetchRecipeFromUrl(url); setLoading(false); if (r) alert(`Preview: ${r.title}\nIngredients: ${r.ingredients.length}`); else alert('No preview available'); }} className="px-3 py-1 bg-theme-secondary rounded">Preview</button>
              </div>
              <div className="flex justify-end">
                <button onClick={handleImportRecipe} disabled={loading || !url} className="px-3 py-1 bg-[var(--accent-color)] text-white rounded">Import Recipe</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
