import { analytics } from '../firebaseConfig';
import { logEvent, setUserProperties, setUserId } from 'firebase/analytics';

// Analytics service for tracking user interactions and app performance
class AnalyticsService {
  // Track user authentication events
  static trackLogin(method: string = 'email') {
    this.logEvent('login', { method });
  }

  static trackSignup(method: string = 'email') {
    this.logEvent('sign_up', { method });
  }

  static trackLogout() {
    this.logEvent('logout');
  }

  // Track user identification
  static setUser(userId: string, properties?: Record<string, any>) {
    setUserId(analytics, userId);
    if (properties) {
      setUserProperties(analytics, properties);
    }
  }

  // Track recipe-related events
  static trackRecipeSearch(query: string, resultsCount: number) {
    this.logEvent('search', {
      search_term: query,
      content_type: 'recipe',
      results_count: resultsCount
    });
  }

  static trackRecipeView(recipeId: string, recipeName: string, source: string = 'search') {
    this.logEvent('view_item', {
      content_type: 'recipe',
      item_id: recipeId,
      item_name: recipeName,
      source: source
    });
  }

  static trackRecipeSave(recipeId: string, recipeName: string) {
    this.logEvent('add_to_wishlist', {
      content_type: 'recipe',
      item_id: recipeId,
      item_name: recipeName
    });
  }

  // Track pantry management events
  static trackPantryItemAdd(itemName: string, category: string, quantity: number, method: 'manual' | 'scan' = 'manual') {
    this.logEvent('add_to_cart', {
      content_type: 'pantry_item',
      item_name: itemName,
      item_category: category,
      quantity: quantity,
      method: method
    });
  }

  static trackPantryItemRemove(itemName: string, category: string) {
    this.logEvent('remove_from_cart', {
      content_type: 'pantry_item',
      item_name: itemName,
      item_category: category
    });
  }

  static trackPantryScan(itemsCount: number, successCount: number) {
    this.logEvent('scan_items', {
      items_scanned: itemsCount,
      items_added: successCount,
      success_rate: successCount / itemsCount
    });
  }

  // Track shopping list events
  static trackShoppingListAdd(itemName: string, category: string) {
    this.logEvent('add_to_wishlist', {
      content_type: 'shopping_item',
      item_name: itemName,
      item_category: category
    });
  }

  static trackShoppingListComplete(itemsCompleted: number, totalItems: number) {
    this.logEvent('purchase', {
      content_type: 'shopping_list',
      items_completed: itemsCompleted,
      total_items: totalItems,
      completion_rate: itemsCompleted / totalItems
    });
  }

  // Track subscription events
  static trackSubscriptionStart(plan: string, price: number) {
    this.logEvent('begin_checkout', {
      content_type: 'subscription',
      plan_name: plan,
      value: price,
      currency: 'USD'
    });
  }

  static trackSubscriptionComplete(plan: string, price: number) {
    this.logEvent('purchase', {
      content_type: 'subscription',
      plan_name: plan,
      value: price,
      currency: 'USD'
    });
  }

  // Track household events
  static trackHouseholdJoin(householdId: string, role: 'owner' | 'member') {
    this.logEvent('join_group', {
      content_type: 'household',
      group_id: householdId,
      role: role
    });
  }

  // Track navigation and engagement
  static trackTabSwitch(fromTab: string, toTab: string) {
    this.logEvent('screen_view', {
      screen_name: toTab,
      previous_screen: fromTab
    });
  }

  static trackFeatureUsage(featureName: string, details?: Record<string, any>) {
    this.logEvent('feature_usage', {
      feature_name: featureName,
      ...details
    });
  }

  // Track errors and issues
  static trackError(errorType: string, errorMessage: string, component?: string) {
    this.logEvent('exception', {
      description: errorMessage,
      error_type: errorType,
      component: component || 'unknown',
      fatal: false
    });
  }

  // Track performance metrics
  static trackPerformance(metricName: string, value: number, unit: string = 'ms') {
    this.logEvent('performance_metric', {
      metric_name: metricName,
      value: value,
      unit: unit
    });
  }

  // Track meal planning events
  static trackMealPlanAdd(recipeId: string, recipeName: string, mealType: string, dayIndex: number) {
    this.logEvent('add_to_meal_plan', {
      content_type: 'recipe',
      item_id: recipeId,
      item_name: recipeName,
      meal_type: mealType,
      day_index: dayIndex
    });
  }

  static trackMealPlanRemove(recipeId: string, recipeName: string, mealType: string) {
    this.logEvent('remove_from_meal_plan', {
      content_type: 'recipe',
      item_id: recipeId,
      item_name: recipeName,
      meal_type: mealType
    });
  }

  static trackMealPlanView(dayIndex: number, totalMeals: number) {
    this.logEvent('view_meal_plan', {
      content_type: 'meal_plan',
      day_index: dayIndex,
      total_meals: totalMeals
    });
  }

  // Track cooking reminder events
  static trackCookingReminderSet(recipeId: string, recipeName: string, reminderTime: number) {
    this.logEvent('set_cooking_reminder', {
      content_type: 'cooking_reminder',
      item_id: recipeId,
      item_name: recipeName,
      reminder_minutes: reminderTime
    });
  }

  static trackCookingReminderCancel(recipeId: string, recipeName: string) {
    this.logEvent('cancel_cooking_reminder', {
      content_type: 'cooking_reminder',
      item_id: recipeId,
      item_name: recipeName
    });
  }

  static trackCookingReminderTriggered(recipeId: string, recipeName: string) {
    this.logEvent('cooking_reminder_triggered', {
      content_type: 'cooking_reminder',
      item_id: recipeId,
      item_name: recipeName
    });
  }

  // Track notification settings events
  static trackNotificationSettingsUpdate(settings: Record<string, any>) {
    this.logEvent('update_notification_settings', {
      content_type: 'settings',
      ...settings
    });
  }

  // Track grocery cost estimation
  static trackGroceryCostEstimate(totalCost: number, itemCount: number) {
    this.logEvent('estimate_grocery_cost', {
      content_type: 'grocery_cost',
      value: totalCost,
      currency: 'USD',
      item_count: itemCount
    });
  }

  // Track recipe rating events
  static trackRecipeRating(recipeId: string, recipeName: string, rating: number, previousRating?: number) {
    this.logEvent('rate_recipe', {
      content_type: 'recipe_rating',
      item_id: recipeId,
      item_name: recipeName,
      rating: rating,
      previous_rating: previousRating
    });
  }

  // Track recipe completion/mark as made
  static trackRecipeCompleted(recipeId: string, recipeName: string, cookTime: number) {
    this.logEvent('complete_recipe', {
      content_type: 'recipe',
      item_id: recipeId,
      item_name: recipeName,
      cook_time: cookTime
    });
  }

  // Track premium feature usage
  static trackPremiumFeatureUsed(featureName: string, planType?: string) {
    this.logEvent('use_premium_feature', {
      content_type: 'premium_feature',
      feature_name: featureName,
      plan_type: planType || 'unknown'
    });
  }

  // Track tutorial and onboarding events
  static trackTutorialStart(step?: string) {
    this.logEvent('tutorial_begin', {
      content_type: 'tutorial',
      step: step || 'start'
    });
  }

  static trackTutorialComplete() {
    this.logEvent('tutorial_complete', {
      content_type: 'tutorial'
    });
  }

  static trackTutorialStep(stepNumber: number, stepName: string) {
    this.logEvent('tutorial_step', {
      content_type: 'tutorial',
      step_number: stepNumber,
      step_name: stepName
    });
  }

  // Track theme and customization events
  static trackThemeChange(theme: string, accentColor?: string) {
    this.logEvent('change_theme', {
      content_type: 'theme',
      theme_name: theme,
      accent_color: accentColor
    });
  }

  // Track household management events
  static trackHouseholdInviteSent(inviteeEmail: string) {
    this.logEvent('send_household_invite', {
      content_type: 'household',
      invitee_email: inviteeEmail
    });
  }

  static trackHouseholdInviteAccepted(householdId: string) {
    this.logEvent('accept_household_invite', {
      content_type: 'household',
      group_id: householdId
    });
  }

  // Track analytics dashboard usage
  static trackAnalyticsView(section: string) {
    this.logEvent('view_analytics', {
      content_type: 'analytics',
      section: section
    });
  }

  // Track voice search events
  static trackVoiceSearch(success: boolean, errorMessage?: string) {
    this.logEvent('voice_search', {
      content_type: 'search',
      method: 'voice',
      success: success,
      error_message: errorMessage
    });
  }

  // Track surprise me feature usage
  static trackSurpriseMeUsed(category?: string) {
    this.logEvent('use_surprise_me', {
      content_type: 'recipe_discovery',
      feature: 'surprise_me',
      category: category || 'all'
    });
  }

  // Generic event logging
  static logEvent(eventName: string, parameters?: Record<string, any>) {
    try {
      if (analytics) {
        logEvent(analytics, eventName, parameters);
      }
    } catch (error) {
      console.warn('Analytics event failed:', error);
    }
  }

  // Track app lifecycle events
  static trackAppOpen() {
    this.logEvent('app_open');
  }

  static trackAppBackground() {
    this.logEvent('app_background');
  }

  static trackAppForeground() {
    this.logEvent('app_foreground');
  }
}

export default AnalyticsService;