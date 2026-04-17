/**
 * Food Risk Level Classification System
 * Maps food categories to risk levels (1-5) for notification tone and urgency
 */

export interface FoodRiskClassification {
  riskLevel: number;
  category: string;
  examples: string[];
  tone: 'inventory_focus' | 'casual_inquiry' | 'waste_conscious' | 'helpful_suggestive' | 'urgent_directive';
  description: string;
}

// Comprehensive food category to risk level mapping
const FOOD_RISK_CATEGORIES: FoodRiskClassification[] = [
  // Level 5: High-Risk (Ground Meat, Fish) - Urgent/Directive
  {
    riskLevel: 5,
    category: 'high_risk_meat',
    examples: ['ground beef', 'ground turkey', 'ground pork', 'hamburger', 'meatloaf', 'fish', 'salmon', 'tuna', 'seafood', 'shellfish', 'shrimp', 'crab', 'lobster'],
    tone: 'urgent_directive',
    description: 'Items that can cause serious foodborne illness if not handled properly'
  },
  // Level 4: Perishables (Milk, Cooked Meals) - Helpful/Suggestive
  {
    riskLevel: 4,
    category: 'perishables',
    examples: ['milk', 'cooked meals', 'leftovers', 'cooked rice', 'cooked pasta', 'cooked chicken', 'cooked beef', 'soups', 'stews', 'casseroles', 'deli meat', 'lunch meat', 'ham', 'turkey slices'],
    tone: 'helpful_suggestive',
    description: 'Items that spoil quickly and need attention soon'
  },
  // Level 3: Produce (Spinach, Berries) - Waste-Conscious
  {
    riskLevel: 3,
    category: 'produce',
    examples: ['spinach', 'lettuce', 'berries', 'strawberries', 'blueberries', 'raspberries', 'salad greens', 'herbs', 'cilantro', 'parsley', 'basil', 'leafy greens', 'fresh vegetables'],
    tone: 'waste_conscious',
    description: 'Fresh produce that wilts and loses nutritional value quickly'
  },
  // Level 2: Hardy Fridge (Hard Cheese, Yogurt) - Casual/Inquiry
  {
    riskLevel: 2,
    category: 'hardy_fridge',
    examples: ['hard cheese', 'cheddar', 'parmesan', 'swiss', 'yogurt', 'greek yogurt', 'sour cream', 'cream cheese', 'cottage cheese', 'buttermilk', 'heavy cream'],
    tone: 'casual_inquiry',
    description: 'Refrigerated items that last longer but still need monitoring'
  },
  // Level 1: Staples (Bread, Eggs) - Inventory Focus
  {
    riskLevel: 1,
    category: 'staples',
    examples: ['bread', 'eggs', 'flour', 'sugar', 'rice', 'pasta', 'cereal', 'oats', 'coffee', 'tea', 'spices', 'condiments', 'oils', 'vinegar'],
    tone: 'inventory_focus',
    description: 'Shelf-stable or long-lasting items that are part of regular inventory'
  }
];

// Special case items that need specific handling
const SPECIAL_CASE_ITEMS = {
  cooked_rice: { riskLevel: 4, maxDays: 4, specialMessage: true },
  deli_meat: { riskLevel: 4, maxOpenDays: 5, specialMessage: true },
  opened_deli_meat: { riskLevel: 4, specialMessage: true }
};

/**
 * Determine risk level for a food item based on its name and category
 */
export function getFoodRiskLevel(itemName: string, category?: string): number {
  const itemNameLower = itemName.toLowerCase();
  const categoryLower = category?.toLowerCase();

  // Check for special cases first
  if (itemNameLower.includes('cooked rice') || itemNameLower.includes('rice') && itemNameLower.includes('leftover')) {
    return SPECIAL_CASE_ITEMS.cooked_rice.riskLevel;
  }

  if (itemNameLower.includes('deli') && (itemNameLower.includes('meat') || itemNameLower.includes('ham') || itemNameLower.includes('turkey'))) {
    return SPECIAL_CASE_ITEMS.deli_meat.riskLevel;
  }

  // Check each risk category
  for (const riskCategory of FOOD_RISK_CATEGORIES) {
    // Check if item name matches any examples
    if (riskCategory.examples.some(example =>
      itemNameLower.includes(example.toLowerCase())
    )) {
      return riskCategory.riskLevel;
    }

    // Check if category matches
    if (categoryLower && riskCategory.examples.some(example =>
      categoryLower.includes(example.toLowerCase())
    )) {
      return riskCategory.riskLevel;
    }
  }

  // Default to level 2 for unknown items (safer than assuming low risk)
  return 2;
}

/**
 * Get the tone and messaging style for a given risk level
 */
export function getNotificationTone(riskLevel: number): {
  tone: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  emoji: string;
} {
  switch (riskLevel) {
    case 5:
      return { tone: 'urgent_directive', priority: 'urgent', emoji: '🚨' };
    case 4:
      return { tone: 'helpful_suggestive', priority: 'high', emoji: '🍗' };
    case 3:
      return { tone: 'waste_conscious', priority: 'medium', emoji: '🥗' };
    case 2:
      return { tone: 'casual_inquiry', priority: 'low', emoji: '🧀' };
    case 1:
    default:
      return { tone: 'inventory_focus', priority: 'low', emoji: '🛒' };
  }
}

/**
 * Generate contextual notification message based on risk level and days until expiry
 */
export function generateExpirationMessage(
  itemName: string,
  daysUntilExpiry: number,
  riskLevel: number
): { title: string; message: string } {
  const { emoji } = getNotificationTone(riskLevel);

  // Special cases
  if (itemName.toLowerCase().includes('cooked rice') && daysUntilExpiry <= 0) {
    return {
      title: 'Cooked Rice Alert!',
      message: `🍚 It's been 4 days. Even if it looks fine, Bacillus cereus isn't worth the risk. Time to toss.`
    };
  }

  if (itemName.toLowerCase().includes('deli') && itemName.toLowerCase().includes('meat') && daysUntilExpiry <= 0) {
    return {
      title: 'Deli Meat Alert',
      message: `Your ${itemName} has reached its safety limit. Toss it and we'll add a fresh pack to your list.`
    };
  }

  // Standard messages by risk level
  switch (riskLevel) {
    case 5: // High-Risk
      if (daysUntilExpiry <= 0) {
        return {
          title: 'Action Required!',
          message: `${emoji} Use your ${itemName} by tonight or move it to the freezer. Safety first!`
        };
      } else if (daysUntilExpiry === 1) {
        return {
          title: 'Cook or Freeze',
          message: `That ${itemName} expires today. Cook it now or freeze it for later. Don't let a good meal go to waste (or get you sick)!`
        };
      }
      break;

    case 4: // Perishables
      if (daysUntilExpiry <= 0) {
        return {
          title: 'Time to Use!',
          message: `${emoji} Your ${itemName} needs attention today.`
        };
      } else if (daysUntilExpiry === 1) {
        return {
          title: 'Clock\'s Ticking',
          message: `${emoji} Clock's ticking on that ${itemName}! Lunch today or freezer bound?`
        };
      }
      break;

    case 3: // Produce
      if (daysUntilExpiry <= 0) {
        return {
          title: 'Time to Cook',
          message: `${emoji} Your ${itemName} is ready to be used today.`
        };
      } else if (daysUntilExpiry === 1) {
        return {
          title: 'Getting Sad',
          message: `${emoji} Your ${itemName} is starting to look sad. Sauté it tonight before it wilts!`
        };
      }
      break;

    case 2: // Hardy Fridge
      return {
        title: 'Checking In',
        message: `${emoji} Checking in on your ${itemName}. Still looking fresh? Tap to update.`
      };

    case 1: // Staples
    default:
      return {
        title: 'Inventory Check',
        message: `${emoji} Running low on ${itemName}? Tap to add it to your shopping list.`
      };
  }

  // Fallback for any unhandled cases
  if (daysUntilExpiry <= 0) {
    return {
      title: 'Item Expired',
      message: `${itemName} has expired and should be used or discarded.`
    };
  } else if (daysUntilExpiry === 1) {
    return {
      title: 'Expires Tomorrow',
      message: `${itemName} expires tomorrow.`
    };
  } else {
    return {
      title: 'Expires Soon',
      message: `${itemName} expires in ${daysUntilExpiry} days.`
    };
  }
}

/**
 * Generate waste notification message when user tosses an item
 */
export function generateWasteNotificationMessage(itemName: string): {
  title: string;
  message: string;
  actionLabel: string;
  actionType: 'add_to_shopping' | 'dismiss';
} {
  return {
    title: 'Item Tossed',
    message: `🗑️ No worries! It happens. Want me to add ${itemName} to your shopping list, or should we skip it this week since it went unused?`,
    actionLabel: 'Add to Shopping List',
    actionType: 'add_to_shopping'
  };
}

/**
 * Generate notification stack message for multiple expiring items
 */
export function generateNotificationStackMessage(items: Array<{
  itemName: string;
  daysUntilExpiry: number;
  riskLevel: number;
}>): { title: string; message: string; actionLabel: string } {
  if (items.length === 0) return { title: '', message: '', actionLabel: '' };

  const urgentItems = items.filter(item => item.daysUntilExpiry <= 0 || item.riskLevel >= 5);
  const highRiskItems = items.filter(item => item.riskLevel >= 4);

  if (urgentItems.length > 0) {
    const itemNames = urgentItems.slice(0, 3).map(item => item.itemName);
    const preview = itemNames.join(', ');
    const remaining = urgentItems.length - 3;

    return {
      title: 'Danger Zone Items',
      message: `You've got ${urgentItems.length} items in the 'Danger Zone' today${urgentItems.length > 1 ? `, including ${preview}${remaining > 0 ? ', …' : ''}` : `: ${preview}`}. Tap to see your 'Use-It-Now' Meal Plan.`,
      actionLabel: 'View Items'
    };
  }

  if (highRiskItems.length > 0) {
    const itemNames = highRiskItems.slice(0, 3).map(item => item.itemName);
    const preview = itemNames.join(', ');
    const remaining = highRiskItems.length - 3;

    return {
      title: 'High-Risk Items',
      message: `${highRiskItems.length} high-risk items need attention${highRiskItems.length > 1 ? `, including ${preview}${remaining > 0 ? ', …' : ''}` : `: ${preview}`}.`,
      actionLabel: 'View Items'
    };
  }

  // General case
  const itemNames = items.slice(0, 3).map(item => item.itemName);
  const preview = itemNames.join(', ');
  const remaining = items.length - 3;

  return {
    title: 'Items Nearing Expiry',
    message: `${items.length} items nearing expiry${items.length > 1 ? `, including ${preview}${remaining > 0 ? ', …' : ''}` : `: ${preview}`}.`,
    actionLabel: 'View Items'
  };
}

export { FOOD_RISK_CATEGORIES, SPECIAL_CASE_ITEMS };