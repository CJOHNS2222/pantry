import React, { Suspense } from 'react';
import { Tab } from '../../types/app';

// Lazy load all major components for better performance
const PantryScanner = React.lazy(() => import('../pantry/PantryScanner').then(module => ({ default: module.PantryScanner })));
const MealPlanner = React.lazy(() => import('../recipes-meals/MealPlanner').then(module => ({ default: module.MealPlanner })));
const ShoppingList = React.lazy(() => import('../shopping-list/ShoppingList').then(module => ({ default: module.ShoppingList })));
const RecipeFinder = React.lazy(() => import('../recipes-meals/RecipeFinder').then(module => ({ default: module.RecipeFinder })));
const Community = React.lazy(() => import('../household/Community').then(module => ({ default: module.Community })));
const Settings = React.lazy(() => import('../settings/Settings').then(module => ({ default: module.Settings })));

import { UsageIndicator } from '../admin-analytics/UsageIndicator';
import ComponentErrorBoundary from '../ui/ComponentErrorBoundary';
import { PullToRefresh } from '../ui/PullToRefresh';
import { useNavigation } from '../../contexts/NavigationContext';
import { useUserContext } from '../../contexts/UserContext';
import { useRecipeContext } from '../../contexts/RecipeContext';
import { useAppActions } from '../../contexts/AppActionsContext';

// Loading component for lazy-loaded components
const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-color)]"></div>
    <span className="ml-3 text-theme-secondary">Loading...</span>
  </div>
);

export const MainContent: React.FC = () => {
  // Only navigation (to pick the active tab) and user (for the usage indicator)
  // are read here — every other domain is read directly by the tab component
  // that actually needs it, so MainContent no longer subscribes to inventory,
  // shopping, meal plan, recipe, or settings state.
  const { activeTab } = useNavigation();
  const { user } = useUserContext();
  const { savedRecipes } = useRecipeContext();
  const appActions = useAppActions();

  const {
    setActiveTab,
    setActiveSettingsCategory,
    refreshAllData,
  } = appActions;

  return (
    <main className="overflow-y-auto overflow-x-hidden pb-safe px-2 sm:px-4 scrollbar-hide bg-theme-primary" style={{ paddingTop: 'var(--app-header-h)', height: 'calc(100dvh - 5rem - max(0.5rem, var(--safe-area-inset-bottom, 0px)))', WebkitOverflowScrolling: 'touch', touchAction: 'auto' }}>
      {/* Usage Indicator - Show for free users */}
      <UsageIndicator
        user={user || undefined}
        savedRecipesCount={savedRecipes.length}
        showUpgradeCTA={true}
        onUpgrade={() => { setActiveSettingsCategory('subscription'); setActiveTab(Tab.SETTINGS); }}
      />


      {/* Main pantry tab */}
      {activeTab === Tab.PANTRY && (
        <ComponentErrorBoundary componentName="PantryScanner">
          <Suspense fallback={<LoadingSpinner />}>
            <PullToRefresh onRefresh={refreshAllData}>
              <PantryScanner />
            </PullToRefresh>
          </Suspense>
        </ComponentErrorBoundary>
      )}

      {activeTab === Tab.MEALS && (
        <ComponentErrorBoundary componentName="MealPlanner">
          <Suspense fallback={<LoadingSpinner />}>
            <PullToRefresh onRefresh={refreshAllData}>
              <MealPlanner
                onOpenRecipeSearch={() => {
                  // This will be called by the tutorial to open recipe search modal
                  // The MealPlanner component handles this internally
                }}
              />
            </PullToRefresh>
          </Suspense>
        </ComponentErrorBoundary>
      )}
      {activeTab === Tab.SHOPPING && (
        <ComponentErrorBoundary componentName="ShoppingList">
          <Suspense fallback={<LoadingSpinner />}>
            <PullToRefresh onRefresh={refreshAllData}>
              <ShoppingList />
            </PullToRefresh>
          </Suspense>
        </ComponentErrorBoundary>
      )}
      {activeTab === Tab.RECIPES && (
        <ComponentErrorBoundary componentName="RecipeFinder">
          <Suspense fallback={<LoadingSpinner />}>
            <RecipeFinder />
          </Suspense>
        </ComponentErrorBoundary>
      )}
      {activeTab === Tab.COMMUNITY && (
        <ComponentErrorBoundary componentName="Community">
          <Suspense fallback={<LoadingSpinner />}>
            <Community />
          </Suspense>
        </ComponentErrorBoundary>
      )}
      {activeTab === Tab.SETTINGS && (
        <ComponentErrorBoundary componentName="Settings">
          <Suspense fallback={<LoadingSpinner />}>
            <Settings />
          </Suspense>
        </ComponentErrorBoundary>
      )}
    </main>
  );
};