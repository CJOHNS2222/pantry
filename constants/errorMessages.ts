// Error message constants for consistent user messaging
// Centralizes all error messages to ensure consistency and enable future localization

export const ERROR_MESSAGES = {
  // Network and connectivity errors
  NETWORK_ERROR: 'Please check your internet connection and try again',
  FIREBASE_UNAVAILABLE: 'Service temporarily unavailable. Please try again later',
  OFFLINE_ERROR: 'You appear to be offline. Changes will sync when connection is restored',

  // Authentication errors
  AUTH_REQUIRED: 'Please sign in to continue',
  AUTH_EXPIRED: 'Your session has expired. Please sign in again',
  PERMISSION_DENIED: 'You don\'t have permission to perform this action',

  // Data validation errors
  INVALID_INPUT: 'Please check your input and try again',
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Please enter a valid email address',
  INVALID_QUANTITY: 'Please enter a valid quantity',
  INVALID_NAME: 'Please enter a valid name',

  // Operation errors
  SAVE_FAILED: 'Failed to save changes. Please try again',
  DELETE_FAILED: 'Failed to delete. Please try again',
  LOAD_FAILED: 'Failed to load data. Please try again',
  UPDATE_FAILED: 'Failed to update. Please try again',

  // Feature-specific errors
  RECIPE_SAVE_FAILED: 'Failed to save recipe. Please try again',
  RATING_SUBMIT_FAILED: 'Failed to submit rating. Please try again',
  HOUSEHOLD_JOIN_FAILED: 'Failed to join household. Please try again',
  IMAGE_UPLOAD_FAILED: 'Failed to upload image. Please try again',

  // Limit errors
  PLANNING_LIMIT_REACHED: 'You\'ve reached your weekly meal planning limit. Upgrade to Premium for unlimited meal planning!',
  RECIPE_LIMIT_REACHED: 'You have reached the maximum number of saved recipes for your plan. Please upgrade to save more recipes',
  HOUSEHOLD_MEMBER_LIMIT: 'You\'ve reached the maximum number of household members for your plan',

  // Validation errors
  CATEGORY_IN_USE: 'Cannot delete category - it\'s being used by items. Please reassign items first',
  INVALID_DAY: 'Invalid day selected',
  DUPLICATE_ITEM: 'This item already exists',

  // Generic fallbacks
  GENERIC_ERROR: 'Something went wrong. Please try again',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again',
} as const;

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;