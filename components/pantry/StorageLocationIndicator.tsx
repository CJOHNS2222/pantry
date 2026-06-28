import React from 'react';
import { Home, Snowflake, Refrigerator, ChefHat, Package, Utensils } from 'lucide-react';

interface StorageLocationIndicatorProps {
  location: 'pantry' | 'freezer' | 'fridge' | 'spices' | 'other' | 'leftovers';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export const StorageLocationIndicator: React.FC<StorageLocationIndicatorProps> = ({
  location,
  size = 'md',
  showLabel = false,
  className = ''
}) => {
  const getLocationConfig = (location: string) => {
    switch (location) {
      case 'leftovers':
        return {
          icon: Utensils,
          label: 'Leftovers',
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          bgColor: 'bg-purple-50'
        };
      case 'pantry':
        return {
          icon: Home,
          label: 'Pantry',
          color: 'bg-amber-100 text-amber-800 border-amber-200',
          bgColor: 'bg-amber-50'
        };
      case 'fridge':
        return {
          icon: Refrigerator,
          label: 'Refrigerator',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          bgColor: 'bg-blue-50'
        };
      case 'freezer':
        return {
          icon: Snowflake,
          label: 'Freezer',
          color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
          bgColor: 'bg-cyan-50'
        };
      case 'spices':
        return {
          icon: ChefHat,
          label: 'Spices',
          color: 'bg-orange-100 text-orange-800 border-orange-200',
          bgColor: 'bg-orange-50'
        };
      case 'other':
        return {
          icon: Package,
          label: 'Other',
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          bgColor: 'bg-gray-50'
        };
      default:
        return {
          icon: Package,
          label: 'Other',
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          bgColor: 'bg-gray-50'
        };
    }
  };

  const config = getLocationConfig(location);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'w-4 h-4 text-xs',
    md: 'w-5 h-5 text-sm',
    lg: 'w-6 h-6 text-base'
  };

  const iconSize = sizeClasses[size];

  if (showLabel) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border ${config.color} ${className}`}>
        <Icon className={iconSize} />
        <span className="font-medium">{config.label}</span>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full border ${config.color} ${className}`}>
      <Icon className={iconSize} />
    </div>
  );
};

export default StorageLocationIndicator;