import React, { useState } from 'react';
import { X, FilePlus, Link } from 'lucide-react';
import { parseCsvToPantryItems, fetchRecipeFromUrl, persistImportedPantryItems } from '../services/importService';
import { useApp } from '../contexts/AppContext';
import { useAppActions } from '../contexts/AppActionsContext';
import { InventoryCacheService } from '../services/inventoryCacheService';
import { saveRecipeToUserCache } from '../services/recipeService';
import { PantryItem } from '../types';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { log } from '../services/logService';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  defaultTab?: 'pantry' | 'recipes';
  onImported?: (items: PantryItem[]) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ open, onClose, defaultTab = 'pantry', onImported }) => {
  const { user, household } = useApp();
  const { addToast } = useAppActions();
  const [tab, setTab] = useState<'pantry' | 'recipes'>(defaultTab);
  const [csvText, setCsvText] = useState('');
  const [url, setUrl] = useState('');
  const [previewCount, setPreviewCount] = useState(0);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text();

    // If the file is plain text (or .txt), convert newline-separated list
    // into a simple CSV with a single 'name' header so the CSV parser can handle it.
    const isPlainText = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');
    let csvPayload = text;
    if (isPlainText) {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      csvPayload = ['name', ...lines].join('\n');
    }

    setCsvText(csvPayload);
    const items = parseCsvToPantryItems(csvPayload);
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
        log.warn('onImported callback failed', { error: String(cbErr) }, 'ImportModal');
      }
      addToast(`Imported ${items.length} pantry items`, 'success');
      onClose();
    } catch (err) {
      log.error('Failed to import pantry items', { error: String(err) }, 'ImportModal');
      addToast('Failed to import pantry items', 'error');
    } finally {
      setLoading(false);
    }
  };

  /** Export the current CSV text as a native file on mobile, or trigger a web download on web. */
  const handleExportFile = async (content: string, filename: string) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Filesystem.writeFile({
          path: filename,
          data: content,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        addToast(`Saved to Documents/${filename}`, 'success');
      } catch (err) {
        log.error('Native file export failed', { error: String(err) }, 'ImportModal');
        addToast('Could not save file to device', 'error');
      }
    } else {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleImportRecipe = async () => {
    if (!url) {
      addToast('Please enter a recipe URL', 'info');
      return;
    }
    setLoading(true);
    try {
      const recipe = await fetchRecipeFromUrl(url);
      if (!recipe) {
        addToast('Could not parse recipe from URL', 'error');
        return;
      }
      if (user?.id) {
        await saveRecipeToUserCache(user.id, recipe);
        addToast(`Imported recipe: ${recipe.title}`, 'success');
        onClose();
      } else {
        addToast('You must be signed in to save recipes', 'error');
      }
    } catch (err) {
      log.error('Failed to import recipe', { error: String(err) }, 'ImportModal');
      addToast('Failed to import recipe', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-2xl bg-theme-primary rounded shadow-lg border border-theme">
        <div className="flex items-center justify-between p-3 border-b border-theme">
          <h3 className="text-lg font-semibold">Import</h3>
            <button onClick={onClose} className="text-theme-secondary" data-testid="import-close"><X className="w-5 h-5"/></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
              <button onClick={() => setTab('pantry')} className={`px-3 py-1 rounded ${tab==='pantry'?'bg-[var(--accent-color)] text-white':'bg-theme-secondary'}`} data-testid="import-tab-pantry">Pantry CSV</button>
              <button onClick={() => setTab('recipes')} className={`px-3 py-1 rounded ${tab==='recipes'?'bg-[var(--accent-color)] text-white':'bg-theme-secondary'}`} data-testid="import-tab-recipes">Recipe URL</button>
          </div>

          {tab === 'pantry' ? (
            <div className="space-y-2">
              <div className="text-sm text-theme-primary">Upload a CSV or plain-text list. CSV columns like <code>item,name,amount,quantity,storageLocation,expirationDate,category</code>. Preview shows parsed rows count.</div>
                <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={(e) => handleFile(e.target.files?.[0])} data-testid="import-file-input" />
                <textarea value={csvText} onChange={(e) => { setCsvText(e.target.value); const items = parseCsvToPantryItems(e.target.value); setPreviewCount(items.length); }} rows={8} className="w-full p-2 rounded border text-black" data-testid="import-csv-textarea" />
              <div className="flex items-center justify-between">
                <div className="text-sm opacity-70">Parsed rows: {previewCount}</div>
                <div className="flex gap-2">
                  {csvText && (
                    <button onClick={() => handleExportFile(csvText, 'pantry-export.csv')} className="px-3 py-1 bg-theme-secondary rounded text-sm" data-testid="import-export">
                      Save to Device
                    </button>
                  )}
                    <button onClick={handleImportPantry} disabled={loading || previewCount===0} className="px-3 py-1 bg-[var(--accent-color)] text-white rounded" data-testid="import-pantry">Import Pantry</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm text-theme-primary">Paste a recipe URL to import its title, ingredients and instructions where possible. This uses a lightweight scraper; results vary by site.</div>
              <div className="flex gap-2">
                  <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/recipe" className="flex-1 p-2 rounded border text-black" data-testid="import-recipe-url" />
                  <button onClick={async () => { setLoading(true); const r = await fetchRecipeFromUrl(url); setLoading(false); if (r) addToast(`Preview: ${r.title} (${r.ingredients.length} ingredients)`, 'info'); else addToast('No preview available', 'info'); }} className="px-3 py-1 bg-theme-secondary rounded" data-testid="import-preview">Preview</button>
              </div>
              <div className="flex justify-end">
                  <button onClick={handleImportRecipe} disabled={loading || !url} className="px-3 py-1 bg-[var(--accent-color)] text-white rounded" data-testid="import-recipe">Import Recipe</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
