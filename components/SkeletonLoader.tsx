import React from 'react';
import PropTypes from 'prop-types';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = React.memo(({ className = '' }) => (
  <div className={`animate-pulse bg-theme-secondary rounded ${className}`} />
));
Skeleton.displayName = 'Skeleton';
Skeleton.propTypes = {
  className: PropTypes.string,
};

export const RecipeCardSkeleton: React.FC = React.memo(() => (
  <div className="bg-theme-secondary rounded-2xl shadow-xl border border-theme overflow-hidden mb-6">
    {/* Image skeleton */}
    <Skeleton className="h-20 w-full" />

    <div className="p-4">
      {/* Title skeleton */}
      <Skeleton className="h-6 w-3/4 mb-3" />

      {/* Description skeleton */}
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-2/3 mb-4" />

      {/* Ingredients section skeleton */}
      <div className="bg-theme-primary/50 p-3 rounded-lg mb-4">
        <Skeleton className="h-4 w-1/3 mb-2" />
        <Skeleton className="h-3 w-full mb-1" />
        <Skeleton className="h-3 w-4/5 mb-1" />
        <Skeleton className="h-3 w-3/4" />
      </div>

      {/* Button skeleton */}
      <Skeleton className="h-10 w-full rounded-xl" />
    </div>
  </div>
));
RecipeCardSkeleton.displayName = 'RecipeCardSkeleton';

export const CompactRecipeCardSkeleton: React.FC = React.memo(() => (
  <div className="bg-theme-secondary rounded-lg shadow-md border border-theme overflow-hidden group">
    <Skeleton className="h-24 w-full" />
    <div className="absolute bottom-2 left-2 right-2">
      <Skeleton className="h-4 w-3/4 mb-1" />
    </div>
  </div>
));
CompactRecipeCardSkeleton.displayName = 'CompactRecipeCardSkeleton';

export const PantryItemSkeleton: React.FC = React.memo(() => (
  <div className="bg-theme-secondary rounded-lg p-3 border border-theme">
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="w-16 h-6 rounded" />
    </div>
  </div>
));
PantryItemSkeleton.displayName = 'PantryItemSkeleton';

export const ShoppingListItemSkeleton: React.FC = React.memo(() => (
  <div className="bg-theme-secondary rounded-lg p-3 border border-theme">
    <div className="flex items-center gap-3">
      <Skeleton className="w-5 h-5 rounded" />
      <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <Skeleton className="h-4 w-3/4 mb-1" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="w-8 h-8 rounded" />
        <Skeleton className="w-8 h-8 rounded" />
      </div>
    </div>
  </div>
));
ShoppingListItemSkeleton.displayName = 'ShoppingListItemSkeleton';

export const MealPlanSkeleton: React.FC = React.memo(() => (
  <div className="bg-theme-secondary rounded-lg p-4 border border-theme">
    <Skeleton className="h-5 w-1/3 mb-3" />
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Skeleton className="w-4 h-4 rounded" />
        <Skeleton className="h-4 flex-1" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="w-4 h-4 rounded" />
        <Skeleton className="h-4 flex-1" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="w-4 h-4 rounded" />
        <Skeleton className="h-4 flex-1" />
      </div>
    </div>
  </div>
));
MealPlanSkeleton.displayName = 'MealPlanSkeleton';