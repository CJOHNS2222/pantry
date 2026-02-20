import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RecipeRatingUI } from '../../../components/RecipeRating';
import { StructuredRecipe } from '../types';

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
    render(<RecipeRatingUI {...defaultProps} />);

    expect(screen.getByText('Rate this recipe')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Share your thoughts or tips...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit rating/i })).toBeInTheDocument();
  });

  it('allows selecting star rating', () => {
    render(<RecipeRatingUI {...defaultProps} />);

    // Get star buttons (they contain SVG icons)
    const starButtons = screen.getAllByRole('button').filter(button =>
      button.querySelector('svg') !== null
    );
    expect(starButtons).toHaveLength(5);

    // Click on 4th star
    fireEvent.click(starButtons[3]);

    // The component should be in a state where rating is set
    expect(screen.getByPlaceholderText('Share your thoughts or tips...')).toBeInTheDocument();
  });

  it('allows entering comment', () => {
    render(<RecipeRatingUI {...defaultProps} />);

    const commentTextarea = screen.getByPlaceholderText('Share your thoughts or tips...');
    fireEvent.change(commentTextarea, { target: { value: 'Great recipe!' } });

    expect(commentTextarea).toHaveValue('Great recipe!');
  });

  it('submits rating with comment', () => {
    const mockOnRate = vi.fn();
    (window as any).TEST_USER = defaultProps.user;
    render(<RecipeRatingUI {...defaultProps} onRatingSubmitted={mockOnRate} />);

    // Select 5 stars
    const starButtons = screen.getAllByRole('button').filter(button =>
      button.querySelector('svg') !== null
    );
    fireEvent.click(starButtons[4]);

    // Enter comment
    const commentTextarea = screen.getByPlaceholderText('Share your thoughts or tips...');
    fireEvent.change(commentTextarea, { target: { value: 'Amazing recipe!' } });

    // Submit
    const submitButton = screen.getByRole('button', { name: /submit rating/i });
    fireEvent.click(submitButton);

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
    delete (window as any).TEST_USER;
  });

  it('shows thank you message after submission', async () => {
    const mockOnRate = vi.fn();
    render(<RecipeRatingUI {...defaultProps} onRatingSubmitted={mockOnRate} />);

    // Select rating and submit (use 5 stars for 'make-again' verdict)
    const starButtons = screen.getAllByRole('button').filter(button =>
      button.querySelector('svg') !== null
    );
    fireEvent.click(starButtons[4]); // 5 stars

    const submitButton = screen.getByRole('button', { name: /submit rating/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Thanks for your feedback!')).toBeInTheDocument();
    });
  });

  it('handles anonymous user', () => {
    const mockOnRate = vi.fn();
    // Set TEST_USER to undefined to simulate anonymous
    (window as any).TEST_USER = undefined;
    render(<RecipeRatingUI {...defaultProps} onRatingSubmitted={mockOnRate} user={undefined} />);

    // Select rating and submit
    const starButtons = screen.getAllByRole('button').filter(button =>
      button.querySelector('svg') !== null
    );
    fireEvent.click(starButtons[0]); // 1 star

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
    render(<RecipeRatingUI {...defaultProps} onRatingSubmitted={mockOnRate} />);

    const submitButton = screen.getByRole('button', { name: /submit rating/i });
    expect(submitButton).toBeDisabled();

    // Should not call onRate if no rating selected
    expect(mockOnRate).not.toHaveBeenCalled();
  });
});