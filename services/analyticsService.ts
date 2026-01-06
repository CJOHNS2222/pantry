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

  // Track household events
  static trackHouseholdJoin(householdId: string, role: string = 'member') {
    this.logEvent('join_group', {
      group_id: householdId,
      role: role
    });
  }

  static trackHouseholdCreate(householdId: string) {
    this.logEvent('create_group', {
      group_id: householdId
    });
  }

  // Generic event logging
  static logEvent(eventName: string, parameters?: Record<string, any>) {
    try {
      logEvent(analytics, eventName, parameters);
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