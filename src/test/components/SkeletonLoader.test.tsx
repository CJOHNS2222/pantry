import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Skeleton, RecipeCardSkeleton, CompactRecipeCardSkeleton } from '../../../components/SkeletonLoader';

describe('SkeletonLoader Components', () => {
  afterEach(() => {
    cleanup();
  });
  describe('Skeleton', () => {
    it('renders with default classes', () => {
      const { container } = render(<Skeleton />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton).toHaveClass('animate-pulse', 'bg-theme-secondary', 'rounded');
    });

    it('renders with custom className', () => {
      const { container } = render(<Skeleton className="custom-class" />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton).toHaveClass('animate-pulse', 'bg-theme-secondary', 'rounded', 'custom-class');
    });

    it('renders as a div element', () => {
      const { container } = render(<Skeleton />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton.tagName).toBe('DIV');
    });
  });

  describe('RecipeCardSkeleton', () => {
    it('renders all skeleton elements', () => {
      const { container } = render(<RecipeCardSkeleton />);

      // Check for main container
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('bg-theme-secondary', 'rounded-2xl', 'shadow-xl', 'border', 'border-theme', 'overflow-hidden', 'mb-6');

      // Check for image skeleton
      const imageSkeleton = card.querySelector('.animate-pulse.h-20');
      expect(imageSkeleton).toHaveClass('animate-pulse', 'bg-theme-secondary', 'rounded', 'h-20', 'w-full');

      // Check for title skeleton
      const titleSkeleton = card.querySelector('.animate-pulse.h-6');
      expect(titleSkeleton).toHaveClass('animate-pulse', 'bg-theme-secondary', 'rounded', 'h-6', 'w-3/4');

      // Check for description skeletons (h-4)
      const descSkeletons = card.querySelectorAll('.animate-pulse.h-4');
      expect(descSkeletons).toHaveLength(3); // 2 description + 1 in ingredients section
      expect(descSkeletons[0]).toHaveClass('animate-pulse', 'bg-theme-secondary', 'rounded', 'h-4', 'w-full');
      expect(descSkeletons[1]).toHaveClass('animate-pulse', 'bg-theme-secondary', 'rounded', 'h-4', 'w-2/3');
      expect(descSkeletons[2]).toHaveClass('animate-pulse', 'bg-theme-secondary', 'rounded', 'h-4', 'w-1/3');

      // Check for ingredients section
      const ingredientsSection = card.querySelector('.bg-theme-primary\\/50');
      expect(ingredientsSection).toHaveClass('bg-theme-primary/50', 'p-3', 'rounded-lg', 'mb-4');

      // Check for button skeleton
      const buttonSkeleton = card.querySelector('.animate-pulse.h-10');
      expect(buttonSkeleton).toHaveClass('animate-pulse', 'bg-theme-secondary', 'rounded', 'h-10', 'w-full', 'rounded-xl');
    });

    it('has proper structure', () => {
      const { container } = render(<RecipeCardSkeleton />);

      // Should have one main card container
      const cardContainer = container.firstChild as HTMLElement;
      expect(cardContainer).toBeInTheDocument();

      // Should have image skeleton as first child
      const imageSkeleton = cardContainer.firstChild as HTMLElement;
      expect(imageSkeleton).toHaveClass('h-20', 'w-full');

      // Should have content div as second child
      const contentDiv = cardContainer.childNodes[1] as HTMLElement;
      expect(contentDiv).toHaveClass('p-4');
    });
  });

  describe('CompactRecipeCardSkeleton', () => {
    it('renders compact card structure', () => {
      const { container } = render(<CompactRecipeCardSkeleton />);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('bg-theme-secondary', 'rounded-lg', 'shadow-md', 'border', 'border-theme', 'overflow-hidden', 'group');

      // Check for image skeleton
      const imageSkeleton = card.querySelector('.animate-pulse.h-24');
      expect(imageSkeleton).toHaveClass('animate-pulse', 'bg-theme-secondary', 'rounded', 'h-24', 'w-full');

      // Check for absolute positioned text skeleton
      const textOverlay = card.querySelector('.absolute');
      expect(textOverlay).toHaveClass('absolute', 'bottom-2', 'left-2', 'right-2');
      expect(textOverlay?.firstChild).toHaveClass('animate-pulse', 'bg-theme-secondary', 'rounded', 'h-4', 'w-3/4');
    });

    it('has absolute positioning for text overlay', () => {
      const { container } = render(<CompactRecipeCardSkeleton />);

      const cardContainer = container.firstChild as HTMLElement;
      const imageSkeleton = cardContainer.firstChild as HTMLElement;
      const textOverlay = cardContainer.childNodes[1] as HTMLElement;

      expect(imageSkeleton).toHaveClass('h-24', 'w-full');
      expect(textOverlay).toHaveClass('absolute', 'bottom-2', 'left-2', 'right-2');
    });
  });
});