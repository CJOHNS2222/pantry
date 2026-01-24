import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchRecipesFromSpoonacular,
  uploadRecipeImage,
  saveRecipeToFirestore,
  bulkUploadRecipes,
  getSavedRecipes,
  getCachedPopularRecipes,
  cachePopularRecipes,
  searchRecipesInFirestore
} from '../../services/recipeService';
import { StructuredRecipe, SavedRecipe } from '../../types';

// Mock Firebase services
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  addDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
}));

vi.mock('firebase/performance', () => ({
  getPerformance: vi.fn(() => ({})),
  trace: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock('../firebaseConfig', () => ({
  db: {},
  storage: {},
}));

vi.mock('./databaseMonitoringService', () => ({
  default: {
    trackOperation: vi.fn(),
  },
}));

// Mock fetch for Spoonacular API
global.fetch = vi.fn();

describe('RecipeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchRecipesFromSpoonacular', () => {
    it('fetches recipes successfully', async () => {
      const mockResponse = {
        results: [
          {
            id: 1,
            title: 'Test Recipe',
            image: 'test.jpg',
            readyInMinutes: 30,
          },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchRecipesFromSpoonacular('chicken', 10);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.spoonacular.com/recipes/complexSearch')
      );
      expect(result).toEqual(mockResponse.results);
    });

    it('handles API errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(fetchRecipesFromSpoonacular('chicken', 10)).rejects.toThrow();
    });

    it('handles network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchRecipesFromSpoonacular('chicken', 10)).rejects.toThrow('Network error');
    });
  });

  describe('saveRecipeToFirestore', () => {
    it('saves recipe successfully', async () => {
      const mockRecipe: StructuredRecipe = {
        title: 'Test Recipe',
        ingredients: ['ingredient1', 'ingredient2'],
        instructions: ['step1', 'step2'],
        servings: 4,
        prepTime: 15,
        cookTime: 30,
        totalTime: 45,
        difficulty: 'easy',
        cuisine: 'Italian',
        dietaryRestrictions: [],
        nutritionalInfo: {
          calories: 500,
          protein: 25,
          carbs: 60,
          fat: 20,
        },
        imageUrl: 'test.jpg',
        source: 'user',
        tags: ['test'],
      };

      const mockDocRef = { id: 'recipe123' };
      const { addDoc } = await import('firebase/firestore');
      (addDoc as any).mockResolvedValueOnce(mockDocRef);

      const result = await saveRecipeToFirestore(mockRecipe);

      expect(addDoc).toHaveBeenCalled();
      expect(result).toBe('recipe123');
    });

    it('handles save errors', async () => {
      const mockRecipe: StructuredRecipe = {
        title: 'Test Recipe',
        ingredients: ['ingredient1'],
        instructions: ['step1'],
        servings: 2,
        prepTime: 10,
        cookTime: 20,
        totalTime: 30,
        difficulty: 'easy',
        cuisine: 'Test',
        dietaryRestrictions: [],
        nutritionalInfo: {
          calories: 300,
          protein: 15,
          carbs: 40,
          fat: 10,
        },
        source: 'user',
        tags: [],
      };

      const { addDoc } = await import('firebase/firestore');
      (addDoc as any).mockRejectedValueOnce(new Error('Save failed'));

      await expect(saveRecipeToFirestore(mockRecipe)).rejects.toThrow('Save failed');
    });
  });

  describe('getSavedRecipes', () => {
    it('retrieves saved recipes successfully', async () => {
      const mockRecipes: SavedRecipe[] = [
        {
          id: 'recipe1',
          title: 'Recipe 1',
          ingredients: ['ing1'],
          instructions: ['step1'],
          createdAt: new Date(),
          userId: 'user123',
        },
      ];

      const { getDocs } = await import('firebase/firestore');
      (getDocs as any).mockResolvedValueOnce({
        docs: mockRecipes.map(recipe => ({
          id: recipe.id,
          data: () => recipe,
        })),
      });

      const result = await getSavedRecipes(10);

      expect(getDocs).toHaveBeenCalled();
      expect(result).toEqual(mockRecipes);
    });

    it('returns empty array when no recipes found', async () => {
      const { getDocs } = await import('firebase/firestore');
      (getDocs as any).mockResolvedValueOnce({
        docs: [],
      });

      const result = await getSavedRecipes();

      expect(result).toEqual([]);
    });
  });

  describe('searchRecipesInFirestore', () => {
    it('searches recipes by title', async () => {
      const mockRecipes: SavedRecipe[] = [
        {
          id: 'recipe1',
          title: 'Chicken Recipe',
          ingredients: ['chicken'],
          instructions: ['cook chicken'],
          createdAt: new Date(),
          userId: 'user123',
        },
      ];

      const { getDocs } = await import('firebase/firestore');
      (getDocs as any).mockResolvedValueOnce({
        docs: mockRecipes.map(recipe => ({
          id: recipe.id,
          data: () => recipe,
        })),
      });

      const result = await searchRecipesInFirestore('chicken');

      expect(getDocs).toHaveBeenCalled();
      expect(result).toEqual(mockRecipes);
    });

    it('handles search errors', async () => {
      const { getDocs } = await import('firebase/firestore');
      (getDocs as any).mockRejectedValueOnce(new Error('Search failed'));

      await expect(searchRecipesInFirestore('test')).rejects.toThrow('Search failed');
    });
  });

  describe('uploadRecipeImage', () => {
    it('uploads image successfully', async () => {
      const { uploadBytes, getDownloadURL } = await import('firebase/storage');
      (uploadBytes as any).mockResolvedValueOnce({});
      (getDownloadURL as any).mockResolvedValueOnce('https://firebase.com/image.jpg');

      const result = await uploadRecipeImage('data:image/jpeg;base64,test', 'recipe123');

      expect(uploadBytes).toHaveBeenCalled();
      expect(getDownloadURL).toHaveBeenCalled();
      expect(result).toBe('https://firebase.com/image.jpg');
    });

    it('handles upload errors', async () => {
      const { uploadBytes } = await import('firebase/storage');
      (uploadBytes as any).mockRejectedValueOnce(new Error('Upload failed'));

      await expect(uploadRecipeImage('invalid', 'recipe123')).rejects.toThrow('Upload failed');
    });
  });

  describe('bulkUploadRecipes', () => {
    it('uploads multiple recipes successfully', async () => {
      const mockRecipes: StructuredRecipe[] = [
        {
          title: 'Recipe 1',
          ingredients: ['ing1'],
          instructions: ['step1'],
          servings: 2,
          prepTime: 10,
          cookTime: 20,
          totalTime: 30,
          difficulty: 'easy',
          cuisine: 'Test',
          dietaryRestrictions: [],
          nutritionalInfo: {
            calories: 300,
            protein: 15,
            carbs: 40,
            fat: 10,
          },
          source: 'bulk',
          tags: [],
        },
      ];

      const { addDoc } = await import('firebase/firestore');
      (addDoc as any).mockResolvedValue({ id: 'recipe1' });

      const result = await bulkUploadRecipes(mockRecipes);

      expect(addDoc).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });
  });

  describe('cachePopularRecipes', () => {
    it('caches recipes successfully', async () => {
      const mockRecipes: SavedRecipe[] = [
        {
          id: 'recipe1',
          title: 'Popular Recipe',
          ingredients: ['ing1'],
          instructions: ['step1'],
          createdAt: new Date(),
          userId: 'user123',
        },
      ];

      const { setDoc } = await import('firebase/firestore');
      (setDoc as any).mockResolvedValueOnce({});

      await expect(cachePopularRecipes(mockRecipes)).resolves.toBeUndefined();
      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('getCachedPopularRecipes', () => {
    it('retrieves cached recipes', async () => {
      const mockRecipes: SavedRecipe[] = [
        {
          id: 'recipe1',
          title: 'Cached Recipe',
          ingredients: ['ing1'],
          instructions: ['step1'],
          createdAt: new Date(),
          userId: 'user123',
        },
      ];

      const { getDoc } = await import('firebase/firestore');
      (getDoc as any).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ recipes: mockRecipes }),
      });

      const result = await getCachedPopularRecipes();

      expect(result).toEqual(mockRecipes);
    });

    it('returns empty array when no cache exists', async () => {
      const { getDoc } = await import('firebase/firestore');
      (getDoc as any).mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await getCachedPopularRecipes();

      expect(result).toEqual([]);
    });
  });
});