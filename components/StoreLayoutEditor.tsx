import React, { useState } from 'react';
import { GripVertical, X } from 'lucide-react';

interface StoreLayoutEditorProps {
  storeLayout: string[];
  onStoreLayoutChange: (newLayout: string[]) => void;
}

export const StoreLayoutEditor: React.FC<StoreLayoutEditorProps> = ({
  storeLayout,
  onStoreLayoutChange
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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

    const newLayout = [...storeLayout];
    const [draggedItem] = newLayout.splice(draggedIndex, 1);
    newLayout.splice(dropIndex, 0, draggedItem);

    onStoreLayoutChange(newLayout);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const removeAisle = (index: number) => {
    const newLayout = storeLayout.filter((_, i) => i !== index);
    onStoreLayoutChange(newLayout);
  };

  const addAisle = () => {
    const newAisle = prompt('Enter new aisle name:');
    if (newAisle && newAisle.trim() && !storeLayout.includes(newAisle.trim())) {
      onStoreLayoutChange([...storeLayout, newAisle.trim()]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-theme-secondary">
          Drag and drop to reorder aisles in your store. This affects how items appear in your shopping list.
        </p>
        <button
          onClick={addAisle}
          className="bg-[var(--accent-color)] text-white px-3 py-1 rounded text-sm font-medium hover:bg-opacity-90 transition-colors"
        >
          Add Aisle
        </button>
      </div>

      <div className="space-y-2">
        {storeLayout.map((aisle, index) => (
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

      {storeLayout.length === 0 && (
        <div className="text-center py-8 text-theme-secondary">
          <p className="text-sm">No aisles configured. Add some aisles to organize your shopping list.</p>
        </div>
      )}
    </div>
  );
};