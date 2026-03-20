import React, { useState } from 'react';
import { Plus, Edit2, Trash2, X, Check, Palette } from 'lucide-react';
import { CustomCategory } from '../types';
import { getCategoryIcon, getCategoryColor } from '../utils/appUtils';

interface CategoryManagerProps {
  customCategories: CustomCategory[];
  onAddCategory: (name: string, icon: string, color?: string) => void;
  onUpdateCategory: (categoryId: string, updates: Partial<Pick<CustomCategory, 'name' | 'icon' | 'color'>>) => void;
  onDeleteCategory: (categoryId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  maxCategories?: number;
}

const commonEmojis = [
  '🥕', '🥛', '🥩', '🐟', '🍝', '🍞', '🧂', '🌿',
  '🍿', '🥤', '🧊', '🧁', '🥞', '🥫', '🍎', '🍌',
  '🍊', '🍇', '🍓', '🥬', '🥔', '🧅', '🥦', '🥕',
  '🥛', '🧀', '🍳', '🥩', '🍗', '🥓', '🐟', '🦐',
  '🍝', '🍜', '🍲', '🍞', '🥖', '🥨', '🍪', '🍰',
  '🧁', '🍧', '🍦', '🍮', '🥧', '🍪', '🍫', '🍬'
];

const colorOptions = [
  '#4CAF50', '#2196F3', '#F44336', '#00BCD4', '#FF9800', '#9C27B0',
  '#795548', '#8BC34A', '#FFC107', '#3F51B5', '#00ACC1', '#E91E63'
];

export const CategoryManager: React.FC<CategoryManagerProps> = ({
  customCategories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  isOpen,
  onClose,
  maxCategories
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    icon: '📦',
    color: '#4CAF50'
  });

  const resetForm = () => {
    setFormData({ name: '', icon: '📦', color: '#4CAF50' });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) return;

    if (editingId) {
      onUpdateCategory(editingId, {
        name: formData.name.trim(),
        icon: formData.icon,
        color: formData.color
      });
    } else {
      onAddCategory(formData.name.trim(), formData.icon, formData.color);
    }
    resetForm();
  };

  const startEditing = (category: CustomCategory) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      icon: category.icon,
      color: category.color || '#4CAF50'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4 pt-[var(--app-header-h)] pb-[var(--app-nav-h)]">
      <div className="bg-theme-primary rounded-lg shadow-xl max-w-2xl w-full max-h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-theme">
          <h2 className="text-xl font-bold text-theme-primary">Manage Categories</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-theme-secondary rounded-lg transition-colors"
            aria-label="Close category manager"
          >
            <X className="w-5 h-5 text-theme-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Upgrade banner when at limit */}
          {maxCategories !== undefined && customCategories.length >= maxCategories && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-3">
              <span className="text-amber-500 text-lg flex-shrink-0">🔒</span>
              <div>
                <p className="text-sm font-semibold text-amber-800">Free plan limit reached</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  You've used your 1 free custom category. Upgrade to <strong>Premium</strong> or <strong>Family</strong> for unlimited categories — starting at $4.99/mo.
                </p>
                <p className="text-xs text-amber-600 mt-1">Go to Settings → More → Subscription to upgrade.</p>
              </div>
            </div>
          )}
          {(isAdding || editingId) && (
            <div className="mb-6 p-4 bg-theme-secondary rounded-lg">
              <h3 className="text-lg font-semibold text-theme-primary mb-4">
                {editingId ? 'Edit Category' : 'Add New Category'}
              </h3>

              <div className="space-y-4">
                {/* Name Input */}
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-2">
                    Category Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter category name"
                    className="w-full px-3 py-2 bg-theme-primary border border-theme rounded-lg text-theme-primary placeholder-theme-secondary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                  />
                </div>

                {/* Icon Selection */}
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-2">
                    Icon
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{formData.icon}</span>
                    <input
                      type="text"
                      value={formData.icon}
                      onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                      placeholder="Or type emoji"
                      className="flex-1 px-3 py-2 bg-theme-primary border border-theme rounded-lg text-theme-primary placeholder-theme-secondary focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
                    />
                  </div>
                  <div className="grid grid-cols-12 gap-1">
                    {commonEmojis.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => setFormData(prev => ({ ...prev, icon: emoji }))}
                        className={`p-2 rounded hover:bg-theme-primary transition-colors ${
                          formData.icon === emoji ? 'bg-[var(--accent-color)] text-white' : ''
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color Selection */}
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-2">
                    Color
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-6 h-6 rounded border-2 border-theme"
                      style={{ backgroundColor: formData.color }}
                    />
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      className="w-8 h-8 rounded border border-theme cursor-pointer"
                    />
                  </div>
                  <div className="flex gap-2">
                    {colorOptions.map(color => (
                      <button
                        key={color}
                        onClick={() => setFormData(prev => ({ ...prev, color }))}
                        className={`w-8 h-8 rounded border-2 ${
                          formData.color === color ? 'border-theme-primary' : 'border-theme'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSubmit}
                    disabled={!formData.name.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    {editingId ? 'Update' : 'Add'} Category
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 border border-theme rounded-lg text-theme-secondary hover:bg-theme-secondary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Categories List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-theme-primary">Your Categories</h3>
              {!isAdding && !editingId && (
                maxCategories !== undefined && customCategories.length >= maxCategories ? (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-amber-600 font-medium">Free plan: 1 category limit</span>
                    <span className="text-xs text-theme-secondary opacity-60">Upgrade for unlimited</span>
                  </div>
                ) : (
                <button
                  onClick={() => setIsAdding(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-color)] text-white rounded-lg hover:bg-opacity-90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Category
                </button>
                )
              )}
            </div>

            {customCategories.length === 0 ? (
              <div className="text-center py-8 text-theme-secondary">
                <p>No custom categories yet.</p>
                <p className="text-sm mt-1">Create your first category to get started!</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {customCategories.map(category => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-4 bg-theme-secondary rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                        style={{ backgroundColor: `${getCategoryColor(category.name, customCategories)}20` }}
                      >
                        {getCategoryIcon(category.name, customCategories)}
                      </div>
                      <div>
                        <h4 className="font-medium text-theme-primary">{category.name}</h4>
                        <p className="text-sm text-theme-secondary">
                          Created {(() => {
                            try {
                              const date = new Date(category.createdAt);
                              return isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
                            } catch {
                              return 'Unknown date';
                            }
                          })()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEditing(category)}
                        className="p-2 text-theme-secondary hover:text-theme-primary hover:bg-theme-primary rounded-lg transition-colors"
                        title="Edit category"
                        aria-label={`Edit category: ${category.name}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteCategory(category.id)}
                        className="p-2 text-theme-secondary hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete category"
                        aria-label={`Delete category: ${category.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};