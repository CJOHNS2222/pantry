import { useState, useMemo, useEffect, useCallback } from 'react';
import { PantryItem, PantryFilter } from '../../types';
import { loadPantryFilter, searchPantryItems, filterPantryItems } from '../../utils/searchUtils';
import { debounce } from '../../utils/debounceUtils';

export type DisplayedPantryItem = PantryItem & {
  originalIndex: number;
  originalIndices?: number[];
  combinedItems?: PantryItem[];
  totalQuantity?: number;
};

export function usePantryFilterSort(inventory: PantryItem[]) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [pantryFilter, setPantryFilter] = useState<PantryFilter>(loadPantryFilter());
  const [viewMode, setViewMode] = useState<'category' | 'storage'>('storage');
  const [sortBy, setSortBy] = useState<'name' | 'lastAdded' | 'expiration' | 'category' | 'location'>('location');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [storageSectionOrder, setStorageSectionOrder] = useState<string[]>(['leftovers', 'pantry', 'fridge', 'freezer', 'spices', 'other']);

  const [displayLayout, setDisplayLayout] = useState<'list' | 'grid'>(() => {
    try {
      return (localStorage.getItem('pantry_display_layout') as 'list' | 'grid') || 'list';
    } catch {
      return 'list';
    }
  });

  const toggleDisplayLayout = useCallback(() => {
    setDisplayLayout(prev => {
      const next = prev === 'list' ? 'grid' : 'list';
      try {
        localStorage.setItem('pantry_display_layout', next);
      } catch (e) {
        console.debug('Failed to write display layout preference:', e);
      }
      return next;
    });
  }, []);

  // Debounced search setup
  const debouncedPantrySearch = useMemo(
    () => debounce(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300),
    [searchQuery]
  );

  useEffect(() => {
    if (searchQuery.trim()) {
      debouncedPantrySearch();
    } else {
      setDebouncedSearchQuery('');
    }
  }, [searchQuery, debouncedPantrySearch]);

  // Process inventory with search and filters
  const processedInventory = useMemo(() => {
    let filtered = [...inventory];
    if (debouncedSearchQuery.trim()) {
      filtered = searchPantryItems(filtered, debouncedSearchQuery);
    }
    filtered = filterPantryItems(filtered, pantryFilter);
    return filtered.map((item) => ({ ...item, originalIndex: inventory.indexOf(item) }));
  }, [inventory, debouncedSearchQuery, pantryFilter]);

  // Sort inventory based on selected criteria
  const sortedInventory = useMemo(() => [...processedInventory].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.item.localeCompare(b.item);
      case 'lastAdded': {
        const aDate = a.lastRestocked || a.dateAdded || '';
        const bDate = b.lastRestocked || b.dateAdded || '';
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      }
      case 'expiration': {
        const aExp = a.expirationDate || '9999-12-31';
        const bExp = b.expirationDate || '9999-12-31';
        return new Date(aExp).getTime() - new Date(bExp).getTime();
      }
      case 'category':
        return (a.category || '').localeCompare(b.category || '');
      case 'location': {
        const locationOrder: Record<string, number> = { pantry: 1, fridge: 2, freezer: 3, spices: 4, other: 5 };
        const aLoc = a.storageLocation || 'pantry';
        const bLoc = b.storageLocation || 'pantry';
        return (locationOrder[aLoc] || 99) - (locationOrder[bLoc] || 99);
      }
      default:
        return 0;
    }
  }), [processedInventory, sortBy]);

  const scrollSectionIntoView = useCallback((elementId: string) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

    setCategoryOrder(prev => {
      const filtered = prev.filter(c => c !== category);
      return [category, ...filtered];
    });
    scrollSectionIntoView(`category-section-${category}`);
  }, [scrollSectionIntoView]);

  const toggleStorageLocation = useCallback((location: string) => {
    setStorageSectionOrder(prev => {
      const filtered = prev.filter(l => l !== location);
      return [location, ...filtered];
    });
    scrollSectionIntoView(`storage-section-${location}`);
  }, [scrollSectionIntoView]);

  const collapseAllCategories = useCallback(() => {
    setExpandedCategories(new Set());
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    showFilters,
    setShowFilters,
    pantryFilter,
    setPantryFilter,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    displayLayout,
    setDisplayLayout,
    toggleDisplayLayout,
    expandedCategories,
    setExpandedCategories,
    categoryOrder,
    setCategoryOrder,
    storageSectionOrder,
    setStorageSectionOrder,
    processedInventory,
    sortedInventory,
    toggleCategory,
    toggleStorageLocation,
    collapseAllCategories,
  };
}
