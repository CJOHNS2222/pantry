import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`animate-pulse bg-theme-secondary rounded ${className}`} />
);

export const RecipeCardSkeleton: React.FC = () => (
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
);

export const CompactRecipeCardSkeleton: React.FC = () => (
  <div className="bg-theme-secondary rounded-lg shadow-md border border-theme overflow-hidden group">
    <Skeleton className="h-24 w-full" />
    <div className="absolute bottom-2 left-2 right-2">
      <Skeleton className="h-4 w-3/4 mb-1" />
    </div>
  </div>
);