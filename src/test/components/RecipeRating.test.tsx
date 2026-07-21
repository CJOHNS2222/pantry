import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RecipeRatingUI } from '../../../components/recipes-meals/RecipeRating';
import { ToastProvider } from '../../../components/ui/Toast';
import { StructuredRecipe } from '../types';

// RecipeRatingUI calls useToast() internally, so every render needs a ToastProvider ancestor.
const renderRating = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

// Mock RecipeRatingService to avoid real Firestore writes in unit tests
vi.mock('../../../services/recipeRatingService', () => ({
  RecipeRatingService: {
    submitRating: vi.fn().mockResolvedValue(undefined),
    getUserRating: vi.fn().mockResolvedValue(null),
    getCommunityStats: vi.fn().mockResolvedValue(null),
    addModification: vi.fn().mockResolvedValue(undefined),
  }
}));

// Mock recipeService upsert to avoid firebase serverTimestamp dependency
vi.mock('../../../services/recipeService', () => ({
  upsertCommunityRatedRecipeByTitle: vi.fn()
}));

// Mock cleanup to prevent DOM accumulation
afterEach(() => {
  document.body.innerHTML = '';
});

describe('RecipeRatingUI', () => {
  const mockRecipe: StructuredRecipe = {
    id: 'test-recipe',
    title: 'Test Recipe',
    ingredients: [],
    instructions: [],
    prepTime: 30,
    cookTime: 45,
    servings: 4,
    tags: [],
    nutrition: {
      calories: 500,
      protein: 25,
      carbs: 60,
      fat: 20
    }
  };

  const mockUser = {
    id: 'user1',
    name: 'Test User',
    email: 'test@example.com',
    avatar: 'avatar.jpg'
  };

  const defaultProps = {
    recipeTitle: 'Test Recipe',
    recipe: mockRecipe,
    onRatingSubmitted: vi.fn(),
    user: mockUser
  };

  it('renders rating form initially', () => {
    renderRating(<RecipeRatingUI {...defaultProps} />);

    expect(screen.getByText('Rate this recipe')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Share your thoughts or tips...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit rating/i })).toBeInTheDocument();
  });

  it('allows selecting star rating', () => {
    renderRating(<RecipeRatingUI {...defaultProps} />);

    // Select the 'I'd make again' verdict
    const makeAgainBtn = screen.getByRole('button', { name: /i'd make again/i });
    fireEvent.click(makeAgainBtn);

    // The component should still show the comment textarea
    expect(screen.getByPlaceholderText('Share your thoughts or tips...')).toBeInTheDocument();
  });

  it('allows entering comment', () => {
    renderRating(<RecipeRatingUI {...defaultProps} />);

    const commentTextarea = screen.getByPlaceholderText('Share your thoughts or tips...');
    fireEvent.change(commentTextarea, { target: { value: 'Great recipe!' } });

    expect(commentTextarea).toHaveValue('Great recipe!');
  });

  it('submits rating with comment', async () => {
    const mockOnRate = vi.fn();
    // Ensure TEST_USER is set so component picks up a logged-in user in tests
    (window as any).TEST_USER = mockUser;
    renderRating(<RecipeRatingUI {...defaultProps} onRatingSubmitted={mockOnRate} />);

    // Select verdict 'make-again' which maps to 5-star rating
    const makeAgainBtn = screen.getByRole('button', { name: /i'd make again/i });
    fireEvent.click(makeAgainBtn);

    // Enter comment
    const commentTextarea = screen.getByPlaceholderText('Share your thoughts or tips...');
    fireEvent.change(commentTextarea, { target: { value: 'Amazing recipe!' } });

    // Submit
    const submitButton = screen.getByRole('button', { name: /submit rating/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnRate).toHaveBeenCalledWith(expect.objectContaining({
        id: expect.any(String),
        recipeTitle: 'Test Recipe',
        userName: 'Test User',
        recipe: mockRecipe,
        rating: 5,
        comment: 'Amazing recipe!',
        date: expect.any(String),
        feedback: expect.any(Array),
        modifications: expect.any(Array),
        photos: expect.any(Array),
        userAvatar: expect.anything(),
        wouldMakeAgain: expect.any(Boolean),
      }));
    });
    delete (window as any).TEST_USER;
  });

  it('shows thank you message after submission', async () => {
    const mockOnRate = vi.fn();
    (window as any).TEST_USER = mockUser;
    renderRating(<RecipeRatingUI {...defaultProps} onRatingSubmitted={mockOnRate} />);

    // Select rating and submit (use 5 stars for 'make-again' verdict)
    const makeAgainBtn = screen.getByRole('button', { name: /i'd make again/i });
    fireEvent.click(makeAgainBtn); // 5-star verdict

    const submitButton = screen.getByRole('button', { name: /submit rating/i });
    fireEvent.click(submitButton);

    // Wait for thank-you message to appear
    await waitFor(() => {
      expect(screen.queryByText((content) => /thanks for your feedback/i.test(content))).toBeTruthy();
    });
    delete (window as any).TEST_USER;
  });

  it('handles anonymous user', () => {
    const mockOnRate = vi.fn();
    // Set TEST_USER to undefined to simulate anonymous
    (window as any).TEST_USER = undefined;
    renderRating(<RecipeRatingUI {...defaultProps} onRatingSubmitted={mockOnRate} user={undefined} />);

    // Select verdict 'skip' which maps to 1-star rating
    const skipBtn = screen.getByRole('button', { name: /skip/i });
    fireEvent.click(skipBtn);

    const submitButton = screen.getByRole('button', { name: /submit rating/i });
    fireEvent.click(submitButton);

    expect(mockOnRate).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.any(String),
      recipeTitle: 'Test Recipe',
      userName: 'Anonymous User',
      recipe: mockRecipe,
      // The rest are set by the component, so just check presence
      rating: expect.any(Number),
      comment: expect.any(String),
      date: expect.any(String),
      feedback: expect.any(Array),
      modifications: expect.any(Array),
      photos: expect.any(Array),
      userAvatar: undefined,
      wouldMakeAgain: expect.any(Boolean),
    }));
    // Clean up
    delete (window as any).TEST_USER;
  });

  it('prevents form submission without rating', () => {
    const mockOnRate = vi.fn();
    renderRating(<RecipeRatingUI {...defaultProps} onRatingSubmitted={mockOnRate} />);

    const submitButton = screen.getByRole('button', { name: /submit rating/i });
    expect(submitButton).toBeDisabled();

    // Should not call onRate if no rating selected
    expect(mockOnRate).not.toHaveBeenCalled();
  });
});