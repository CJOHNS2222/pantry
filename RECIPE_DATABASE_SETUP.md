# Recipe Database Setup

This guide explains how to populate your app with recipes using the Spoonacular API free tier.

## Prerequisites

1. **Firebase Configuration** (required)
   - Firebase project set up with Firestore and Storage enabled

2. **Spoonacular API Key** (optional, for fallback)
   - Visit [https://spoonacular.com/food-api](https://spoonacular.com/food-api)
   - Sign up for a free account (10,000 requests/month)
   - Get your API key from the dashboard

3. **Environment Variables**
   - Add to `.env.local`:
   ```
   VITE_SPOONACULAR_API_KEY=your_actual_api_key_here
   ```
   - Spoonacular key is optional - the script will work with just TheMealDB

## Spoonacular Free Tier Limits

- **50 requests per day** (points/day)
- **1 request per second**
- **2 concurrent requests max**
- Forum support only
- No SLA
- Backlink required on your website

## Quick Setup Test

Before running the bulk upload, test your API connection:

```bash
npm run test-spoonacular
```

This will fetch 2 test recipes to verify your API key works.

## Running the Bulk Upload

The bulk upload script will fetch recipes for various categories and store them in your Firebase database.

### Command

```bash
npm run bulk-upload-recipes
```

### What it does:

1. **Fetches recipes** from TheMealDB (free, unlimited) as primary API
2. **Falls back** to Spoonacular API if TheMealDB doesn't have results
3. **Checks for duplicates** by title before saving (skips existing recipes)
4. **Converts format** from both APIs to your app's recipe structure
5. **Uploads images** to Firebase Storage
6. **Stores recipes** in Firestore under the `recipes` collection

### Categories included:
- Proteins: chicken, beef, fish, pork, turkey, lamb, seafood
- Cuisines: italian, mexican, asian, indian, thai, french, greek
- Meal types: breakfast, lunch, dinner, snack, appetizer, dessert
- Cooking methods: grilled, baked, roasted, slow cooker, stir fry, air fryer
- Dietary: vegetarian, vegan, keto, gluten free, healthy, mediterranean
- Specific combinations: chicken breast, beef stew, fish tacos, etc.

### Expected Results:
- **~50 recipes** (1 recipe × 50+ categories, minus any duplicates)
- **Storage usage**: ~10-20MB (recipes + images)
- **Time**: ~50-70 seconds (with API rate limiting)
- **APIs used**: Primarily TheMealDB (free), falls back to Spoonacular if needed

## Firebase Storage Structure

```
recipes/
├── {recipeId}.jpg    # Recipe images
└── ...

recipes (collection)/
├── {recipeId}/
│   ├── title: string
│   ├── description: string
│   ├── ingredients: string[]
│   ├── instructions: string[]
│   ├── cookTime: string
│   ├── type: string
│   ├── image: string (Firebase Storage URL)
│   └── dateSaved: timestamp
```

## Usage in App

After running the bulk upload, recipes will be available in:

1. **MealPlanner**: Search and add recipes to meal plans
2. **RecipeFinder**: Browse saved recipes
3. **Global database**: Available to all users

## Troubleshooting

### API Key Issues
- Verify your API key is correct in `.env.local`
- Check Spoonacular dashboard for usage limits
- Free tier allows 150 requests/day

### Firebase Issues
- Ensure Firebase Storage is enabled in your project
- Check Firestore security rules allow writes to `recipes` collection
- Verify storage bucket permissions

### Script Errors
- Run `npm install` to ensure dependencies are installed
- Check console output for specific error messages
- Reduce `RECIPES_PER_QUERY` in the script if hitting rate limits

## Adding More Recipes

To add more recipes later:

1. Edit `SEARCH_QUERIES` array in `scripts/bulk-upload-recipes.js`
2. Add new search terms
3. Run the script again (it will add new recipes without duplicating existing ones)

## Manual Recipe Addition

You can also manually add recipes through the app's "Save Recipe" feature, which stores them in your user-specific collection.