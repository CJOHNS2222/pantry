// Backward-compat barrel — re-exports the focused modules this file was split into.
// New code should import directly from the domain module (dateUtils, categoryUtils, etc.)
// instead of from here, so bundlers can tree-shake unused pieces.
export * from './dateUtils';
export * from './householdUtils';
export * from './ingredientParsingUtils';
export * from './itemImageUtils';
export * from './categoryUtils';
export * from './expiryUtils';
export * from './suggestionUtils';
export * from './quantityMathUtils';
export * from './mealPlanUtils';
export * from './imagePlaceholderUtils';
export * from './adsUtils';
