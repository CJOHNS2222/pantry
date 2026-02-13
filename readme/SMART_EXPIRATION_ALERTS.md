# Smart Expiration Alerts with Recipe Suggestions

## Overview

Smart Pantry Chef now includes intelligent **"Use Soon" recipe suggestions** that proactively help users avoid food waste by suggesting recipes for items expiring within 7 days.

## How It Works

### Automatic Recipe Generation
When items in your pantry are approaching their expiration date (within 7 days), the app automatically suggests relevant recipes using those ingredients.

### Smart Recipe Matching
The system uses intelligent matching based on:
- **Exact ingredient matches** (e.g., "lettuce" → Caesar Salad)
- **Partial matches** (e.g., "organic kale" → general vegetable recipes)
- **Category-based suggestions** (e.g., dairy items → casserole recipes)

## Features

### Visual Alerts
- **Green-themed "Use Soon" section** in the Pantry tab
- **Color-coded urgency indicators**:
  - 🔴 Red: Expires today/tomorrow
  - 🟡 Yellow: Expires in 2-3 days
  - 🔵 Blue: Expires in 4-7 days

### Recipe Suggestions
Each expiring item shows:
- **Item name** and **days remaining**
- **Contextual reason** (e.g., "expires in 2 days - perfect time to cook")
- **3 recipe suggestions** as clickable buttons
- **Chef hat icon** for easy visual identification

### Example Suggestions

| Ingredient | Suggested Recipes |
|------------|-------------------|
| Lettuce | Caesar Salad, Garden Salad, BLT Sandwich |
| Chicken | Grilled Chicken, Chicken Soup, Chicken Stir Fry |
| Tomatoes | Caprese Salad, Pasta Sauce, Tomato Soup |
| Bananas | Banana Bread, Smoothie, Fruit Salad |
| Milk | Cereal, Pancakes, Mac and Cheese |

## Technical Implementation

### New Components
- `RecipeSuggestion` interface in `types.ts`
- `generateRecipeSuggestions()` function in `utils/appUtils.ts`
- Enhanced `PantryScanner` component with "Use Soon" section

### Data Flow
```
Pantry Items → Expiration Check → Recipe Matching → UI Display
     ↓              ↓              ↓              ↓
  Firebase      Within 7 days   Smart mapping   Green cards
```

### Recipe Database
Built-in recipe mapping for common ingredients:
- **Vegetables**: 15+ common items with recipe suggestions
- **Fruits**: 10+ items with dessert/smoothie recipes
- **Proteins**: Meat, fish, tofu with cooking method variations
- **Dairy**: Cheese, milk, yogurt with meal ideas
- **Other**: Bread, pasta, rice with quick meal ideas

## User Benefits

### Waste Reduction
- **Proactive notifications** prevent forgotten ingredients
- **Actionable suggestions** turn "use soon" into "use now"
- **Meal planning integration** helps use multiple expiring items

### Enhanced Experience
- **Visual priority system** shows most urgent items first
- **One-click recipe access** (buttons ready for future integration)
- **Contextual messaging** explains why suggestions are timely

### Smart Features
- **Automatic categorization** of new ingredients
- **Fallback suggestions** for uncommon items
- **Urgency-based sorting** (soonest expiring first)

## Future Enhancements

### Planned Features
- **Recipe finder integration** - Click buttons to search recipes
- **Multi-ingredient suggestions** - Recipes using multiple expiring items
- **Custom recipe database** - User-added recipe suggestions
- **Shopping list integration** - Auto-add recipe ingredients
- **Usage tracking** - Learn which suggestions users prefer

### Advanced Features
- **AI-powered suggestions** using Gemini for personalized recipes
- **Household preferences** - Learn favorite recipes per user
- **Seasonal adjustments** - Different suggestions based on season
- **Nutritional balancing** - Suggest complete meals

## Integration Points

### Existing Features
- **Expiration tracking** - Uses existing `expirationDate` fields
- **Pantry management** - Integrates with current inventory system
- **UI consistency** - Matches existing alert styling
- **Performance** - Computed efficiently with `useMemo`

### Future Connections
- **Recipe Finder** - Direct links to search suggested recipes
- **Meal Planner** - Add suggested recipes to meal plans
- **Shopping List** - Auto-suggest replacements for expiring items
- **Analytics** - Track which suggestions prevent waste

## Configuration

### Display Settings
- Shows up to **3 suggestions per item**
- Limited to items expiring within **7 days**
- **Green color scheme** to indicate positive action
- **Responsive design** works on mobile and desktop

### Customization Options
- **Recipe preferences** (future: vegetarian, low-carb, etc.)
- **Notification settings** (future: push notifications)
- **Display count** (future: show more/fewer suggestions)

---

## Summary

The Smart Expiration Alerts feature transforms passive expiration warnings into **active recipe inspiration**, helping users:

- ✅ **Reduce food waste** through timely recipe suggestions
- ✅ **Discover new meals** using ingredients they already have
- ✅ **Save money** by using items before they expire
- ✅ **Enjoy cooking** with contextual, helpful recommendations

This feature positions Smart Pantry Chef as a **proactive kitchen assistant** that doesn't just track inventory—it helps users make the most of what they have! 🥬👨‍🍳