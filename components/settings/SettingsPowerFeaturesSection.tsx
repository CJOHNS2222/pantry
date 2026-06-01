import React from 'react';

interface SettingsPowerFeaturesSectionProps {
  onOpenCategories: () => void;
  onOpenStoreLayout: () => void;
  onOpenFoodSafety: () => void;
  onOpenAppPreferences: () => void;
}

export const SettingsPowerFeaturesSection: React.FC<SettingsPowerFeaturesSectionProps> = ({
  onOpenCategories,
  onOpenStoreLayout,
  onOpenFoodSafety,
  onOpenAppPreferences,
}) => {
  const items = [
    {
      label: 'Custom Categories',
      icon: '🏷️',
      description: 'Organise your pantry your way',
      action: onOpenCategories,
    },
    {
      label: 'Store Layout',
      icon: '🛒',
      description: 'Sort shopping by aisle',
      action: onOpenStoreLayout,
    },
    {
      label: 'Food Safety Mode',
      icon: '🧊',
      description: 'Leftover guidance level',
      action: onOpenFoodSafety,
    },
    {
      label: 'Nutrition Data',
      icon: '📊',
      description: 'Toggle nutrition display',
      action: onOpenAppPreferences,
    },
  ];

  return (
    <div className="bg-theme-secondary rounded-xl border border-theme p-4">
      <p className="text-xs font-semibold text-theme-secondary uppercase tracking-wide mb-3">Power Features</p>
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ label, icon, description, action }) => (
          <button
            key={label}
            onClick={action}
            className="flex items-start gap-2 p-3 rounded-lg bg-theme-primary border border-theme hover:border-[var(--accent-color)] hover:bg-[var(--accent-color)]/5 transition-all text-left focus:outline-none focus:ring-2 focus:ring-[var(--accent-color)]"
          >
            <span className="text-lg flex-shrink-0" aria-hidden="true">{icon}</span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-theme-primary truncate">{label}</div>
              <div className="text-[10px] text-theme-secondary leading-tight mt-0.5">{description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
