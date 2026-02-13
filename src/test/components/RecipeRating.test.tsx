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

    expect(mockOnRate).toHaveBeenCalledWith({
      id: expect.any(String),
      recipeTitle: 'Test Recipe',
      rating: 5,
      comment: 'Amazing recipe!',
      userName: 'Test User',
      recipe: mockRecipe
    });
  });

  it('shows thank you message after submission', async () => {
    const mockOnRate = vi.fn();
    render(<RecipeRatingUI {...defaultProps} onRatingSubmitted={mockOnRate} />);

    // Select rating and submit
    const starButtons = screen.getAllByRole('button').filter(button =>
      button.querySelector('svg') !== null
    );
    fireEvent.click(starButtons[2]); // 3 stars

    const submitButton = screen.getByRole('button', { name: /submit rating/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Rating submitted successfully!')).toBeInTheDocument();
      expect(screen.getByText('Thanks for your feedback!')).toBeInTheDocument();
    });
  });

  it('handles anonymous user', () => {
    const mockOnRate = vi.fn();
    render(<RecipeRatingUI {...defaultProps} onRatingSubmitted={mockOnRate} user={undefined} />);

    // Select rating and submit
    const starButtons = screen.getAllByRole('button').filter(button =>
      button.querySelector('svg') !== null
    );
    fireEvent.click(starButtons[0]); // 1 star

    const submitButton = screen.getByRole('button', { name: /submit rating/i });
    fireEvent.click(submitButton);

    expect(mockOnRate).toHaveBeenCalledWith({
      id: expect.any(String),
      recipeTitle: 'Test Recipe',
      rating: 1,
      comment: '',
      userName: 'Anonymous User',
      recipe: mockRecipe
    });
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