# Recipe Database Setup

This guide explains how to populate your app with recipes using the Spoonacular API free tier.

## Prerequisites

1. **Get a Spoonacular API Key**
   - Visit [https://spoonacular.com/food-api](https://spoonacular.com/food-api)
   - Sign up for a free account
   - Get your API key from the dashboard

2. **Configure Environment Variables**
   - Add your API key to `.env.local`:
   ```
   VITE_SPOONACULAR_API_KEY=your_actual_api_key_here
   ```

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

1. **Fetches recipes** from Spoonacular API for 50+ search terms
2. **Converts format** from Spoonacular to your app's recipe structure
3. **Uploads images** to Firebase Storage
4. **Stores recipes** in Firestore under the `recipes` collection

### Categories included:
- Proteins: chicken, beef, fish, pork, turkey, lamb, seafood
- Cuisines: italian, mexican, asian, indian, thai, french, greek
- Meal types: breakfast, lunch, dinner, snack, appetizer, dessert
- Cooking methods: grilled, baked, roasted, slow cooker, stir fry
- Dietary: vegetarian, vegan, keto, gluten free, healthy

### Expected Results:
- **~50 recipes** (2 recipes × 25 categories)
- **Storage usage**: ~10-20MB (recipes + images)
- **Time**: ~30-45 seconds (with API rate limiting)

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
3. Run the script again (it will add new recipes without duplicating)

## Manual Recipe Addition

You can also manually add recipes through the app's "Save Recipe" feature, which stores them in your user-specific collection.