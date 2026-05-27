import React, { useState } from 'react';
import { GripVertical, X, Plus, Store, ChevronDown } from 'lucide-react';

interface StoreLayoutEditorProps {
  storeLayout: string[];
  onStoreLayoutChange: (newLayout: string[]) => void;
  storeProfiles?: Record<string, string[]>;
  activeStoreProfile?: string;
  onStoreProfilesChange?: (profiles: Record<string, string[]>, active?: string) => void;
}

export const StoreLayoutEditor: React.FC<StoreLayoutEditorProps> = ({
  storeLayout,
  onStoreLayoutChange,
  storeProfiles = {},
  activeStoreProfile,
  onStoreProfilesChange,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>(activeStoreProfile ?? '__default__');
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);

  // Resolve current layout based on selected store
  const currentLayout = selectedStore === '__default__'
    ? storeLayout
    : (storeProfiles[selectedStore] ?? storeLayout);

  const updateCurrentLayout = (newLayout: string[]) => {
    if (selectedStore === '__default__') {
      onStoreLayoutChange(newLayout);
    } else if (onStoreProfilesChange) {
      const updated = { ...storeProfiles, [selectedStore]: newLayout };
      onStoreProfilesChange(updated, selectedStore);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newLayout = [...currentLayout];
    const [draggedItem] = newLayout.splice(draggedIndex, 1);
    newLayout.splice(dropIndex, 0, draggedItem);

    updateCurrentLayout(newLayout);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const removeAisle = (index: number) => {
    updateCurrentLayout(currentLayout.filter((_, i) => i !== index));
  };

  const addAisle = () => {
    const newAisle = prompt('Enter new aisle name:');
    if (newAisle && newAisle.trim() && !currentLayout.includes(newAisle.trim())) {
      updateCurrentLayout([...currentLayout, newAisle.trim()]);
    }
  };

  const addStoreProfile = () => {
    const name = prompt('Enter store name (e.g. Whole Foods, Costco):');
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (trimmed === '__default__' || storeProfiles[trimmed]) return;
    if (onStoreProfilesChange) {
      const updated = { ...storeProfiles, [trimmed]: [...storeLayout] };
      onStoreProfilesChange(updated, trimmed);
      setSelectedStore(trimmed);
    }
  };

  const deleteStoreProfile = (storeName: string) => {
    if (!onStoreProfilesChange) return;
    const updated = { ...storeProfiles };
    delete updated[storeName];
    const newActive = Object.keys(updated)[0] ?? '__default__';
    onStoreProfilesChange(updated, newActive === '__default__' ? undefined : newActive);
    setSelectedStore(newActive);
  };

  const selectStore = (storeName: string) => {
    setSelectedStore(storeName);
    setShowStoreDropdown(false);
    if (onStoreProfilesChange) {
      onStoreProfilesChange(storeProfiles, storeName === '__default__' ? undefined : storeName);
    }
  };

  const storeNames = Object.keys(storeProfiles);
  const displayName = selectedStore === '__default__' ? 'Default' : selectedStore;

  return (
    <div className="space-y-4">
      {/* Store Selector */}
      <div className="flex items-center gap-2">
        <Store className="w-4 h-4 text-theme-secondary flex-shrink-0" />
        <div className="relative flex-1">
          <button
            onClick={() => setShowStoreDropdown(!showStoreDropdown)}
            className="w-full flex items-center justify-between px-3 py-2 bg-theme border border-theme rounded-lg text-sm text-theme-primary hover:border-[var(--accent-color)] transition-colors"
          >
            <span className="font-medium">{displayName}</span>
            <ChevronDown className="w-4 h-4 text-theme-secondary" />
          </button>
          {showStoreDropdown && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-theme-secondary border border-theme rounded-lg shadow-lg overflow-hidden">
              <button
                onClick={() => selectStore('__default__')}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-theme-primary transition-colors ${selectedStore === '__default__' ? 'text-[var(--accent-color)] font-medium' : 'text-theme-primary'}`}
              >
                Default
              </button>
              {storeNames.map(name => (
                <div key={name} className="flex items-center group">
                  <button
                    onClick={() => selectStore(name)}
                    className={`flex-1 text-left px-3 py-2 text-sm hover:bg-theme-primary transition-colors ${selectedStore === name ? 'text-[var(--accent-color)] font-medium' : 'text-theme-primary'}`}
                  >
                    {name}
                  </button>
                  <button
                    onClick={() => deleteStoreProfile(name)}
                    className="pr-3 text-theme-secondary opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                    title={`Delete ${name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => { setShowStoreDropdown(false); addStoreProfile(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--accent-color)] hover:bg-theme-primary transition-colors border-t border-theme"
              >
                <Plus className="w-3.5 h-3.5" /> Add store…
              </button>
            </div>
          )}
        </div>
        <button
          onClick={addAisle}
          className="bg-[var(--accent-color)] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-opacity-90 transition-colors flex items-center gap-1 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" /> Aisle
        </button>
      </div>

      <p className="text-xs text-theme-secondary">
        Drag and drop to reorder aisles for <strong>{displayName}</strong>. The shopping list will follow this order when organized view is active.
      </p>

      <div className="space-y-2">
        {currentLayout.map((aisle, index) => (
          <div
            key={aisle}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 p-3 bg-theme-secondary rounded-lg border border-theme cursor-move hover:bg-theme-primary transition-colors ${
              draggedIndex === index ? 'opacity-50' : ''
            }`}
          >
            <GripVertical className="w-4 h-4 text-theme-secondary flex-shrink-0" />
            <span className="text-sm text-theme-primary flex-1">{aisle}</span>
            <button
              onClick={() => removeAisle(index)}
              className="text-theme-secondary hover:text-red-500 transition-colors p-1"
              title="Remove aisle"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {currentLayout.length === 0 && (
        <div className="text-center py-8 text-theme-secondary">
          <p className="text-sm">No aisles configured. Add some aisles to organize your shopping list.</p>
        </div>
      )}
    </div>
  );
};