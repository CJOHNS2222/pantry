import remoteConfig from '../services/remoteConfigService';
import { ConsumptionSuggestion, ExpirationAlert, RecipeSuggestion, PantryItem } from '../types';

/**
 * Generates consumption pattern suggestions based on inventory history
 * @param inventory Current inventory items
 * @returns Array of consumption suggestions
 */
export function generateConsumptionSuggestions(inventory: PantryItem[]): ConsumptionSuggestion[] {
  const suggestions: ConsumptionSuggestion[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter out undefined or invalid items
  const validInventory = inventory.filter(item => item && typeof item === 'object' && item.id);

  validInventory.forEach(item => {
    if (!item.consumptionHistory || item.consumptionHistory.length < 2) {
      return; // Need at least 2 data points for patterns
    }

    const history = item.consumptionHistory
      .map(date => new Date(date))
      .sort((a, b) => a.getTime() - b.getTime());

    // Calculate average interval between purchases
    const intervals: number[] = [];
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];
      if (!curr || !prev) continue;
      const days = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (days > 0 && days < 90) { // Ignore intervals longer than 3 months
        intervals.push(days);
      }
    }

    if (intervals.length === 0) return;

    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const lastPurchase = history[history.length - 1];
    if (!lastPurchase) return; // defensive
    const daysSinceLastPurchase = Math.floor((today.getTime() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24));

    // Suggest restocking if it's been longer than average interval
    if (daysSinceLastPurchase > averageInterval * 1.2) {
      const confidence = Math.min(0.9, intervals.length / 5); // Higher confidence with more data points
      suggestions.push({
        item: item.item,
        category: item.category,
        suggestedAction: 'restock',
        reason: `You usually buy this every ${Math.round(averageInterval)} days. It's been ${daysSinceLastPurchase} days.`,
        confidence,
        daysSinceLastPurchase,
        averageInterval: Math.round(averageInterval)
      });
    }
    // Suggest considering buying if approaching the interval
    else if (daysSinceLastPurchase > averageInterval * 0.8) {
      const confidence = Math.min(0.7, intervals.length / 7);
      suggestions.push({
        item: item.item,
        category: item.category,
        suggestedAction: 'consider_buying',
        reason: `You usually buy this every ${Math.round(averageInterval)} days. It's been ${daysSinceLastPurchase} days.`,
        confidence,
        daysSinceLastPurchase,
        averageInterval: Math.round(averageInterval)
      });
    }
  });

  // Sort by confidence and return top suggestions
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);
}

/**
 * Generates expiration alerts with different levels
 * @param inventory Current inventory items
 * @returns Array of expiration alerts
 */
export function generateExpirationAlerts(inventory: PantryItem[]): ExpirationAlert[] {
  const alerts: ExpirationAlert[] = [];
  const today = new Date().toISOString().slice(0, 10);

  inventory.forEach(item => {
    // Skip immortal items entirely
    if (item.is_immortal) return;

    const isFrozen = item.is_frozen || item.storageLocation === 'freezer';
    // Frozen: prefer freezerExpiry; non-frozen: use expirationDate
    const activeDateStr = isFrozen ? (item.freezerExpiry || item.expirationDate) : item.expirationDate;
    if (!activeDateStr) return;

    const activeDate = new Date(activeDateStr);
    const todayDate = new Date(today);
    const daysRemaining = Math.ceil((activeDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    const expirationType = item.expirationType || 'best-by';
    let alertLevel: 'expired' | 'critical' | 'warning' | 'info';
    let message: string;

    if (isFrozen) {
      // Frozen items: only surface alerts within RC-configured window; use gentler language
      if (daysRemaining < 0) {
        alertLevel = 'expired';
        message = `${item.item} is past its freezer date`;
      } else if (daysRemaining <= remoteConfig.getNumber('expiry_critical_days')) {
        alertLevel = 'critical';
        message = `${item.item} should be used within ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} (frozen)`;
      } else if (daysRemaining <= remoteConfig.getNumber('expiry_frozen_alert_days')) {
        alertLevel = 'warning';
        message = `${item.item} is best used within ${daysRemaining} days (frozen)`;
      } else {
        return; // Plenty of freezer time left
      }
    } else {
      // Special handling for milk - only warn when 3 days or less remain
      const isMilk = item.item.toLowerCase().includes('milk') || item.category.toLowerCase() === 'dairy';
      const warningThreshold = isMilk ? remoteConfig.getNumber('expiry_warning_days') : remoteConfig.getNumber('expiry_info_days');

      if (daysRemaining < 0) {
        alertLevel = 'expired';
        message = `${item.item} has expired!`;
      } else if (daysRemaining === 0) {
        alertLevel = 'critical';
        message = `${item.item} expires today!`;
      } else if (daysRemaining <= remoteConfig.getNumber('expiry_critical_days')) {
        alertLevel = 'critical';
        message = `${item.item} expires in ${daysRemaining} day!`;
      } else if (daysRemaining <= remoteConfig.getNumber('expiry_warning_days')) {
        alertLevel = 'warning';
        message = `${item.item} expires in ${daysRemaining} days`;
      } else if (daysRemaining <= warningThreshold) {
        alertLevel = 'info';
        message = `${item.item} expires in ${daysRemaining} days`;
      } else {
        return; // No alert needed
      }
    }

    alerts.push({
      itemId: item.id,
      itemName: item.item,
      daysRemaining,
      alertLevel,
      expirationType,
      message
    });
  });

  // Sort by urgency (expired first, then by days remaining)
  return alerts.sort((a, b) => {
    if (a.alertLevel === 'expired' && b.alertLevel !== 'expired') return -1;
    if (b.alertLevel === 'expired' && a.alertLevel !== 'expired') return 1;
    return a.daysRemaining - b.daysRemaining;
  });
}

/**
 * Generates recipe suggestions for items expiring soon
 * @param inventory Array of pantry items
 * @returns Array of recipe suggestions
 */
export function generateRecipeSuggestions(inventory: PantryItem[]): RecipeSuggestion[] {
  const suggestions: RecipeSuggestion[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // Recipe suggestions based on common ingredients and expiration timeframes
  const recipeMap: Record<string, string[]> = {
    // Vegetables
    'lettuce': ['Caesar Salad', 'Garden Salad', 'BLT Sandwich', 'Taco Salad'],
    'spinach': ['Spinach Salad', 'Smoothie', 'Quiche', 'Pasta with Spinach'],
    'tomato': ['Caprese Salad', 'BLT Sandwich', 'Tomato Soup', 'Pasta Sauce'],
    'cucumber': ['Cucumber Salad', 'Greek Salad', 'Sandwiches', 'Tzatziki'],
    'carrot': ['Carrot Soup', 'Carrot Salad', 'Stir Fry', 'Roasted Vegetables'],
    'broccoli': ['Steamed Broccoli', 'Stir Fry', 'Broccoli Soup', 'Broccoli Casserole'],
    'bell pepper': ['Stir Fry', 'Stuffed Peppers', 'Fajitas', 'Pepper Salad'],
    'onion': ['Caramelized Onions', 'Soup', 'Stir Fry', 'French Onion Soup'],
    'garlic': ['Garlic Bread', 'Pasta Sauce', 'Roasted Garlic', 'Stir Fry'],
    'potato': ['Mashed Potatoes', 'Baked Potato', 'Potato Soup', 'Roasted Potatoes'],
    'avocado': ['Guacamole', 'Avocado Toast', 'Salad', 'Smoothie'],

    // Fruits
    'banana': ['Banana Bread', 'Smoothie', 'Banana Split', 'Fruit Salad'],
    'apple': ['Apple Pie', 'Apple Sauce', 'Fruit Salad', 'Apple Crisp'],
    'orange': ['Orange Juice', 'Fruit Salad', 'Orange Chicken', 'Smoothie'],
    'lemon': ['Lemonade', 'Lemon Chicken', 'Salad Dressing', 'Lemon Bars'],
    'berries': ['Berry Smoothie', 'Fruit Salad', 'Berry Pie', 'Yogurt Parfait'],

    // Dairy
    'milk': ['Cereal', 'Pancakes', 'Hot Chocolate', 'Mac and Cheese'],
    'cheese': ['Grilled Cheese', 'Mac and Cheese', 'Cheese Quesadilla', 'Pizza'],
    'yogurt': ['Parfait', 'Smoothie', 'Marinade', 'Frozen Yogurt'],
    'eggs': ['Scrambled Eggs', 'Omelette', 'Quiche', 'Egg Salad'],

    // Proteins
    'chicken': ['Grilled Chicken', 'Chicken Soup', 'Chicken Stir Fry', 'Chicken Salad'],
    'beef': ['Beef Stew', 'Hamburger', 'Beef Tacos', 'Roast Beef'],
    'fish': ['Grilled Fish', 'Fish Tacos', 'Fish Soup', 'Baked Fish'],
    'tofu': ['Stir Fry', 'Tofu Curry', 'Tofu Scramble', 'Tofu Stir Fry'],

    // Other
    'bread': ['Sandwich', 'French Toast', 'Bread Pudding', 'Garlic Bread'],
    'pasta': ['Pasta Salad', 'Mac and Cheese', 'Pasta Primavera', 'Spaghetti'],
    'rice': ['Fried Rice', 'Rice Pilaf', 'Rice Pudding', 'Risotto']
  };

  inventory.forEach(item => {
    if (!item.expirationDate) return;

    const expirationDate = new Date(item.expirationDate);
    const todayDate = new Date(today);
    const daysRemaining = Math.ceil((expirationDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    // Only suggest recipes for items expiring within RC-configured window
    if (daysRemaining < 0 || daysRemaining > remoteConfig.getNumber('expiry_recipe_suggestion_days')) return;

    // Find recipes based on item name (case insensitive partial match)
    const itemNameLower = item.item.toLowerCase();
    let suggestedRecipes: string[] = [];

    // Check for exact matches first
    if (recipeMap[itemNameLower]) {
      suggestedRecipes = recipeMap[itemNameLower];
    } else {
      // Check for partial matches
      for (const [key, recipes] of Object.entries(recipeMap)) {
        if (itemNameLower.includes(key) || key.includes(itemNameLower)) {
          suggestedRecipes = recipes;
          break;
        }
      }
    }

    // If no specific recipes found, provide generic suggestions based on category
    if (suggestedRecipes.length === 0) {
      const category = item.category.toLowerCase();
      if (category.includes('vegetable') || category.includes('fruit')) {
        suggestedRecipes = ['Salad', 'Smoothie', 'Stir Fry', 'Soup'];
      } else if (category.includes('dairy')) {
        suggestedRecipes = ['Casserole', 'Sauce', 'Baked Dish', 'Smoothie'];
      } else if (category.includes('protein') || category.includes('meat')) {
        suggestedRecipes = ['Stir Fry', 'Grilled', 'Baked', 'Stew'];
      } else {
        suggestedRecipes = ['Quick Meal', 'Simple Recipe', 'Easy Dish'];
      }
    }

    if (suggestedRecipes.length > 0) {
      let reason: string;
      if (daysRemaining <= 1) {
        reason = `expires ${daysRemaining === 0 ? 'today' : 'tomorrow'} - use it now!`;
      } else if (daysRemaining <= 3) {
        reason = `expires in ${daysRemaining} days - perfect time to cook`;
      } else {
        reason = `expires in ${daysRemaining} days - great for meal planning`;
      }

      suggestions.push({
        itemId: item.id,
        itemName: item.item,
        daysRemaining,
        suggestedRecipes: suggestedRecipes.slice(0, 3), // Limit to 3 suggestions
        reason
      });
    }
  });

  // Sort by urgency (soonest expiring first)
  return suggestions.sort((a, b) => a.daysRemaining - b.daysRemaining);
}
