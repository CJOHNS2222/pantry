// components/SmartCategorySelector.tsx
import React, { useState, useEffect } from 'react';
import { Check, X, ChevronDown, Tag } from 'lucide-react';
import { getCategorySuggestions, CategorySuggestion, getAllCategories } from '../utils/appUtils';

interface SmartCategorySelectorProps {
  itemName: string;
  currentCategory: string;
  onCategoryChange: (category: string) => void;
  className?: string;
}

const SmartCategorySelector: React.FC<SmartCategorySelectorProps> = ({
  itemName,
  currentCategory,
  onCategoryChange,
  className = ''
}) => {
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [allCategories] = useState(getAllCategories());

  useEffect(() => {
    const categorySuggestions = getCategorySuggestions(itemName);
    setSuggestions(categorySuggestions);
  }, [itemName]);

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-50 border-green-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high': return '🎯';
      case 'medium': return '⚡';
      case 'low': return '❓';
      default: return '❓';
    }
  };

  const topSuggestion = suggestions[0];

  return (
    <div className={`relative ${className}`}>
      <div className="space-y-2">
        {/* Current Category Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-theme-secondary" />
            <span className="text-sm font-medium text-theme-primary">Category</span>
          </div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1 text-sm text-[var(--accent-color)] hover:text-[var(--accent-color)]/80"
          >
            Change
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Current Category Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-theme-secondary rounded-full">
          <span className="text-sm font-medium text-theme-primary">{currentCategory}</span>
        </div>

        {/* Smart Suggestion */}
        {topSuggestion && topSuggestion.category !== currentCategory && (
          <div className={`p-3 rounded-lg border ${getConfidenceColor(topSuggestion.confidence)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{getConfidenceIcon(topSuggestion.confidence)}</span>
                <div>
                  <span className="text-sm font-medium">Suggested: {topSuggestion.category}</span>
                  <p className="text-xs opacity-75">{topSuggestion.reasoning}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => onCategoryChange(topSuggestion.category)}
                  className="p-1 rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
                  title="Accept suggestion"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSuggestions(suggestions.slice(1))}
                  className="p-1 rounded bg-gray-500 text-white hover:bg-gray-600 transition-colors"
                  title="Try another suggestion"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dropdown for manual selection */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-theme-primary border border-theme rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {allCategories.map((category) => (
              <button
                key={category}
                onClick={() => {
                  onCategoryChange(category);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-theme-secondary transition-colors ${
                  category === currentCategory ? 'bg-[var(--accent-color)] text-white' : 'text-theme-primary'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartCategorySelector;