import React from 'react';
import { Clock, TrendingUp, Tag, Search, X } from 'lucide-react';
import { PantryItem } from '../../types';
import { AutocompleteSuggestion, saveSearchToHistory, getRecentSearchSuggestions, getEnhancedAutocompleteSuggestions } from '../../utils/searchUtils';
import { Modal } from '../ui/Modal';
import { useIntl } from 'react-intl';

export interface PantrySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  inventory: PantryItem[];
}

export const PantrySearchModal: React.FC<PantrySearchModalProps> = ({
  isOpen,
  onClose,
  searchQuery,
  setSearchQuery,
  inventory,
}) => {
  const intl = useIntl();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [showAutocomplete, setShowAutocomplete] = React.useState(false);
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = React.useState<AutocompleteSuggestion[]>([]);

  const handleBlur = (e: React.FocusEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setShowAutocomplete(false);
    }
  };

  // Load recent searches on open
  React.useEffect(() => {
    if (isOpen) {
      const recents = getRecentSearchSuggestions('pantry');
      setRecentSearches(recents);
    }
  }, [isOpen]);

  // Update suggestions when searchQuery or inventory changes
  React.useEffect(() => {
    const suggestions = getEnhancedAutocompleteSuggestions(inventory, searchQuery);
    setAutocompleteSuggestions(suggestions);
  }, [inventory, searchQuery]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={intl.formatMessage({ id: 'pantry.searchTitle', defaultMessage: 'Search Pantry Items' })}
      size="md"
      panelClassName="relative"
    >
      <Modal.Body className="bg-theme-primary space-y-4 overflow-visible" noScroll={true} padding="sm">
        
        <div ref={containerRef} onBlur={handleBlur} className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-theme-muted" />
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchQuery.length >= 1 && autocompleteSuggestions.length > 0) {
                setShowAutocomplete(true);
              } else if (searchQuery.length === 0 && recentSearches.length > 0) {
                setShowAutocomplete(true);
              }
            }}
            placeholder="Search pantry items..."
            className="w-full pl-10 pr-12 py-2.5 bg-theme-primary border border-theme rounded-lg text-theme-primary placeholder-theme-primary/50 focus:border-[var(--accent-color)] focus:outline-none"
            role="combobox"
            aria-expanded={showAutocomplete}
            aria-autocomplete="list"
            aria-controls="search-suggestions-listbox"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 p-3 min-w-[44px] min-h-[44px] flex items-center justify-center text-theme-secondary opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] rounded-full"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Autocomplete Suggestions inside modal */}
          {showAutocomplete && (
            <div id="search-suggestions-listbox" role="listbox" aria-label="Search suggestions" className="absolute left-0 right-0 mt-2 bg-theme-primary border border-theme rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
              {/* Recent Searches */}
              {searchQuery.length === 0 && recentSearches.length > 0 && (
                <>
                  <div className="px-4 py-2 text-xs font-semibold text-theme-muted border-b border-theme">
                    Recent Searches
                  </div>
                  {recentSearches.map((recentQuery, index) => (
                    <button
                      key={`recent-${index}`}
                      role="option"
                      aria-selected="false"
                      onClick={() => {
                        setSearchQuery(recentQuery);
                        setShowAutocomplete(false);
                        onClose();
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-theme-secondary text-theme-primary flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] focus-visible:ring-inset"
                    >
                      <Clock className="w-3 h-3 text-theme-muted" />
                      <span>{recentQuery}</span>
                    </button>
                  ))}
                  {autocompleteSuggestions.length > 0 && (
                    <div className="px-4 py-2 text-xs font-semibold text-theme-muted border-b border-theme">
                      Suggestions
                    </div>
                  )}
                </>
              )}

              {/* Enhanced Suggestions */}
              {autocompleteSuggestions.map((suggestion, index) => (
                <button
                  key={`suggestion-${index}`}
                  role="option"
                  aria-selected="false"
                  onClick={() => {
                    setSearchQuery(suggestion.text);
                    saveSearchToHistory(suggestion.text, 'pantry');
                    setShowAutocomplete(false);
                    onClose();
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-theme-secondary text-theme-primary flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] focus-visible:ring-inset"
                >
                  <div className="flex items-center gap-1 min-w-0 flex-1">
                    {suggestion.type === 'recent' && (
                      <Clock className="w-3 h-3 text-blue-500 flex-shrink-0" />
                    )}
                    {suggestion.type === 'popular' && (
                      <TrendingUp className="w-3 h-3 text-green-500 flex-shrink-0" />
                    )}
                    {suggestion.type === 'category' && (
                      <Tag className="w-3 h-3 text-purple-500 flex-shrink-0" />
                    )}
                    {suggestion.type === 'match' && (
                      <Search className="w-3 h-3 text-theme-muted flex-shrink-0" />
                    )}
                    <span className="truncate">{suggestion.text}</span>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-theme-muted">
                    {suggestion.category && suggestion.type !== 'category' && (
                      <span className="bg-theme-secondary px-1.5 py-0.5 rounded text-[10px]">
                        {suggestion.category}
                      </span>
                    )}
                    {suggestion.count && suggestion.count > 1 && (
                      <span className="text-[10px]">
                        ×{suggestion.count}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal.Body>
      
      <Modal.Footer className="bg-theme-primary">
        <button
          onClick={onClose}
          className="px-5 py-2.5 bg-[var(--accent-color)] text-[var(--accent-text,white)] font-bold rounded-xl hover:opacity-90 transition-opacity text-sm shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
        >
          {intl.formatMessage({ id: 'common.done', defaultMessage: 'Done' })}
        </button>
      </Modal.Footer>
    </Modal>
  );
};
