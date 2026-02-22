## Google Play Billing Integration (Android)

The app now uses Google Play Billing for in-app purchases and subscriptions on Android. Stripe and PayPal have been removed for Play Store compliance.

### Integration Plan
1. **Install Capacitor Google Play Billing plugin**
  - Use `@capacitor-community/play-billing` or similar plugin for Android billing.
2. **Update Settings > Subscription tab**
  - Replace Stripe/PayPal UI with Google Play Billing purchase flow.
3. **Handle purchase and subscription events**
  - Use plugin APIs to initiate purchase, check subscription status, and handle upgrades/cancels.
4. **Sync subscription status to Firestore**
  - Store subscription state in Firestore for cross-device sync.
5. **Test with Google Play Console test accounts**
  - Use Play Console to test subscription flows and edge cases.
6. **Update documentation and agent instructions**
  - Remove Stripe/PayPal references and clarify Google Play Billing usage.

### Useful Links
- [Capacitor Google Play Billing Plugin](https://github.com/capacitor-community/play-billing)
- [Google Play Billing Documentation](https://developer.android.com/google/play/billing)
- [Play Console Testing](https://developer.android.com/google/play/billing/test)
# Smart Pantry Chef

## Overview
Smart Pantry Chef is a cross-platform pantry and meal management app built with React, Vite, Firebase, and Capacitor. It supports real-time household sharing, notifications, recipe management, and user customization.

## Key Features
- Household inventory, shopping list, meal plan, and saved recipes shared in real-time via Firebase Firestore
- Email/password and Google authentication (with email verification)
- Daily notifications for shopping list and meal plan (customizable in settings)
- Theme customization (dark/light, accent color)
- Feedback form for user ideas and bug reports
- Recipe sharing between households
- Firebase Analytics for usage tracking
- **AI-Powered Recipe Generation**: Create custom recipes using Google Gemini AI
- **Community Recipe Ratings**: Rate and review recipes with community feedback
- **Smart Meal Planner**: Weekly meal planning with interactive calendar interface
  - Visual calendar view for planning meals across the week
  - Drag-and-drop recipe assignment to meal slots
  - Recipe search integration with context-aware recipe modal
- **Smart Ingredient Cleaning**: Automatic removal of descriptive words from shopping list items
  - Converts "2 chopped onions" to "Onion" for cleaner shopping lists
  - Removes preparation descriptors like "minced", "diced", "finely chopped"
- **Enhanced Recipe Search**: Discover recipes with tile-based grid layout
  - 3-column responsive tile display with recipe images and details
  - Search both AI-generated and user-saved recipes
  - Context-aware recipe actions (save, add to plan, mark as made)
- **Pantry Analytics Dashboard**: Comprehensive statistics and insights
  - Inventory usage patterns and trends
  - Shopping list analytics and cost tracking
  - Recipe popularity and meal planning insights
- **User Behavior Analytics**: Advanced analytics dashboard with insights
  - Feature usage tracking and conversion funnels
  - User journey mapping and engagement metrics
  - Performance monitoring and Core Web Vitals
- **Smart Recommendations**: AI-powered personalized suggestions
  - Recipe matching based on current inventory
  - Feature adoption recommendations
  - Time-based suggestions (dinner time, expiring items)
- **Calendar Integration**: Export meal plans to device calendar
  - All-day events for meal planning
  - Cross-platform support (iOS/Android)
  - Recipe details included in calendar events
- **Enhanced Grocery Price Estimator with Community Data**
  - Real-time price updates from user contributions
  - Price ranges and sample sizes for accuracy
  - Community-driven pricing for current market rates
  - Custom price overrides for personal preferences
- **Subscription system with Stripe payment processing**
  - Free tier: Basic features with limits
  - Premium tier: Unlimited recipes, meal plans, and household members

## Subscription System
The app includes a subscription-based monetization system with the following limits on the free tier:
- Recipe Finder: 5 saved recipes
- Meal Planner: 10 meals per week
- Household: 3 members maximum

Premium subscribers get unlimited access to all features.

### Google Play Billing Setup
1. **Google Play Billing is now used for in-app purchases and subscriptions.**
2. **Upgrade prompts** appear when users hit free tier limits.
3. **Upgrade flow** navigates to Settings > Subscription tab.
4. **Secure checkout** is handled via Google Play Billing plugin.
5. **Subscription status** is stored in Firestore and synced across devices.

### Testing the Payment Flow
Use Google Play Billing test accounts and Google Play Console for subscription testing.

## AI Recipe Generation

The app features AI-powered recipe creation using Google Gemini API:

### Features
- **Custom Recipe Generation**: Create recipes based on available ingredients
- **Ingredient-Based Suggestions**: AI analyzes your pantry inventory to suggest recipes
- **Recipe Variations**: Generate different versions of recipes with dietary modifications
- **Smart Ingredient Matching**: AI considers nutritional balance and flavor profiles

### How It Works
1. **Inventory Analysis**: AI scans your current pantry items
2. **Recipe Generation**: Creates complete recipes with ingredients and instructions
3. **Nutritional Information**: Provides estimated nutritional facts for generated recipes
4. **Save & Rate**: Save AI-generated recipes and rate them with the community

## Enhanced Grocery Price System

The app now features a community-driven grocery price estimator that provides more accurate cost calculations:

### Features
- **Live Price Data**: Prices are updated from user contributions and show current market rates
- **Price Ranges**: Displays min/max prices with sample sizes for transparency
- **Community Contributions**: Users can submit current prices from their local stores
- **Custom Overrides**: Set personal price preferences for specific ingredients
- **Price History**: Track price trends over time (future feature)

### How It Works
1. **Automatic Updates**: The estimator fetches the latest community prices when opened
2. **Contribute Prices**: Click "Contribute Price" on any ingredient to share current pricing
3. **Price Validation**: Community votes help ensure price accuracy
4. **Fallback System**: Uses updated default prices when community data isn't available

### Data Sources
- User-submitted prices from various stores and locations
- Aggregated pricing data with confidence intervals
- Regional price variations (future enhancement)
- Integration with grocery APIs (planned)

## Recent Changes
- **Meal Planner Redesign**: Complete overhaul with unified calendar interface, day detail modals, and integrated recipe search
- **Context-Aware Recipe Modal**: Dynamic button display based on usage context (search/scheduled/saved recipes)
- **Smart Ingredient Cleaning**: Automatic removal of descriptive preparation words from shopping list items
- **Enhanced Recipe Search UI**: 3-column tile grid layout with clickable recipe previews
- **AI Recipe Generation**: Integration with Google Gemini API for custom recipe creation
- **Community Recipe Ratings**: User rating and review system for recipes
- **Pantry Analytics Dashboard**: Comprehensive statistics and visualization features
- Migrated inventory, shopping list, meal plan, and saved recipes to Firestore for household sharing

## API Documentation

### Core Services

#### Analytics Service (`services/analyticsService.ts`)
Tracks user interactions and app usage for insights and optimization.

**Key Methods:**
- `trackEvent(eventName, params)` - Track custom events with parameters
- `trackScreenView(screenName)` - Track screen/page views
- `trackUserAction(action, context)` - Track user actions with context
- `trackFeatureUsage(feature, metadata)` - Track feature usage patterns

**Event Categories:**
- Authentication events (login, signup, logout)
- Recipe interactions (search, save, view, rate)
- Meal planning (add, remove, modify)
- Shopping list operations
- Pantry management
- Navigation and UI interactions

#### Calendar Service (`services/calendarService.ts`)
Manages calendar integration for meal planning and reminders.

**Key Methods:**
- `createMealPlanEvent(dayPlan, date)` - Export meal plan to calendar
- `createCookingReminder(recipeTitle, scheduledTime)` - Create cooking reminders
- `openCalendarAtDate(date)` - Open device calendar at specific date
- `checkPermissions()` - Check calendar access permissions

**Features:**
- Cross-platform calendar integration (iOS/Android)
- All-day meal plan events
- Recipe details in event descriptions
- Automatic permission handling

#### Recipe Service (`services/recipeService.ts`)
Handles recipe data operations and AI-powered recipe generation.

**Key Methods:**
- `searchRecipes(query, filters)` - Search recipes with filters
- `getSavedRecipes(limit)` - Get user's saved recipes
- `saveRecipe(recipe)` - Save recipe to user's collection
- `generateRecipe(prompt, preferences)` - AI recipe generation via Gemini

#### Gemini Service (`services/geminiService.ts`)
AI-powered recipe generation and content processing.

**Key Methods:**
- `generateRecipe(prompt, options)` - Generate recipes from text prompts
- `analyzeIngredients(image)` - Extract ingredients from images
- `suggestRecipes(inventory)` - Suggest recipes based on available ingredients

### Data Management

#### useDataManagement Hook (`hooks/useDataManagement.ts`)
Centralized data management for all Firestore operations.

**Features:**
- Real-time Firestore subscriptions
- Optimistic updates
- Household-scoped data access
- Automatic data synchronization
- Error handling and retry logic

**Managed Collections:**
- `users/{userId}/inventory` - Personal pantry items
- `users/{userId}/shoppingList` - Personal shopping lists
- `users/{userId}/mealPlan` - Personal meal plans
- `users/{userId}/savedRecipes` - Personal saved recipes
- `households/{householdId}/inventory` - Shared household inventory
- `households/{householdId}/shoppingList` - Shared shopping lists
- `households/{householdId}/mealPlan` - Shared meal plans
- `households/{householdId}/sharedRecipes` - Shared recipes

### Component Architecture

#### Key Components
- **Settings**: Main settings hub with analytics, subscription, and preferences
- **MealPlanner**: Interactive meal planning with calendar integration
- **PantryAnalytics**: Inventory and usage analytics dashboard
- **UserBehaviorAnalytics**: User engagement and behavior insights
- **SmartRecommendations**: AI-powered personalized suggestions
- **RecipeFinder**: Recipe discovery with search and filtering
- **ShoppingList**: Shopping list management with smart features

#### State Management
- React hooks for local component state
- Context providers for global app state
- Firebase real-time listeners for data synchronization
- Local storage for user preferences and cache

### Capacitor Plugins

#### Configured Plugins
- **App**: App lifecycle and back button handling
- **Device**: Device information and capabilities
- **Camera**: Photo capture for pantry scanning
- **Local Notifications**: Push notifications and reminders
- **Calendar**: Calendar integration for meal planning

#### Plugin Integration
- Automatic permission handling
- Cross-platform compatibility
- Fallback behavior for web environments
- Error handling and user feedback
- Added Settings screen for notifications, theme, and feedback
- Integrated local notifications (Capacitor) for daily reminders
- Improved signup flow with validation and email verification
- Added Firebase Analytics events for login, tab changes, recipe saves, and settings changes
- `.env.local` is now used for API keys and is included in `.gitignore`

## Setup & Compilation
1. **Clone the repository:**
   ```
   git clone https://github.com/your-username/your-repo-name.git
   cd your-repo-name
   ```
2. **Install dependencies:**
   ```
   npm install
   ```
3. **Add your API keys:**
   - Create a `.env.local` file in the root directory:
     ```
     VITE_GEMINI_API_KEY=your_google_gemini_api_key
     ```
   - Do not commit this file (it's in `.gitignore`).
4. **Configure Firebase:**
   - Update `services/firebase.ts` (or `firebaseConfig.ts`) with your Firebase project settings.
5. **Build the web app:**
   ```
   npm run build
   ```
6. **Sync with Capacitor and Android:**
   ```
   npx cap sync android
   npx cap open android
   ```
7. **Build APK in Android Studio:**
   - Use Android Studio to build and test your APK.
8. **Sync Release Notes (before releases):**
   ```bash
   npm run sync-release-notes
   ```
   Or use the release build command which syncs automatically:
   ```bash
   npm run build:release
   ```
   This automatically converts your `CHANGELOG.md` to plain text and updates `android/release-notes.txt` for Android app releases.

## Notifications
- Daily notifications are scheduled using Capacitor Local Notifications.
- Users can enable/disable and set notification time in the Settings screen.

## Analytics
- Firebase Analytics tracks login, tab changes, recipe saves, and settings changes.
- View analytics in your Firebase console.

## Security
- Sensitive keys (API, Firebase) are stored in `.env.local` and not committed to git.
- Email verification is required for new users.

## Customization
- Users can change theme mode and accent color in Settings.
- Feedback form allows users to suggest features or report bugs.

## Recipe Sharing
- Saved recipes are shared between household members automatically.

## Useful Links
- [Capacitor Local Notifications](https://capacitorjs.com/docs/apis/local-notifications)
- [Firebase Analytics](https://firebase.google.com/docs/analytics)
- [Firebase Firestore](https://firebase.google.com/docs/firestore)
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe React SDK](https://stripe.com/docs/stripe-js/react)
- [PayPal Developer](https://developer.paypal.com)
- [PayPal Subscriptions](https://developer.paypal.com/docs/subscriptions/)

## Contact
For questions or feature requests, use the feedback form in the app or open an issue on GitHub.

## Improvements & Implementation Roadmap

The following user-friendly and productivity improvements were identified during a recent code review. Items marked **(Done)** have been implemented in the codebase; others include a short implementation note.

- Scan review modal: Allow users to review and edit AI-parsed items before saving (local edit, no extra API usage). **(Done)**
- Onboarding & First-run Flow: Add interactive first-run tutorial that highlights `PantryScanner`, adding items, and the meal planner. Implementation: small modal tour persisted to `user.hasSeenTutorial` in `useAuth`.
- Barcode/Product Lookup: Integrate OpenFoodFacts or similar for barcode->product lookup to auto-fill nutrition and images. Implementation: add fallback in `handleScanBarcode` to call lookup API and populate fields.
- Offline Support & Conflict Resolution: Queue writes locally (IndexedDB) when offline and present simple conflict-resolution UI on reconnect. Implementation: small write-queue service + UI to accept/merge remote changes.
- Undo & Change History: Store recent actions per item and allow a one-step undo; add an item history view in `ItemDetailModal`.
- Bulk Edit Actions (Move location, set expiration, add to shopping list, delete): UI available in `PantryScanner` bulk mode; implemented as a bulk-action toolbar. **(Done)**
- Expiration Management: Add calendar view and scheduled reminders for soon-to-expire items; auto-suggest recipes for near-expiry items.
- Smarter Shopping Lists: Auto-generate shopping lists from meal plan with per-store grouping and suggested quantities; allow export/share.
- Household Roles & Permissions: Add household role model (admin/member) and guard UI + Firestore rules accordingly.
- Performance: Virtualize long inventory lists to reduce DOM and memory. Implementation: use `react-window` for large lists. **(Done)**
- Search & Filters: Add fuzzy search (Fuse.js), saved filters, and ingredient autocomplete.
- Accessibility & Shortcuts: Add ARIA attributes, keyboard navigation, and a shortcuts help panel.
- Import/Export & Backup: CSV/JSON import/export and one-click backup to Google Drive or local file.
- Privacy & Data Controls: Add data export and account deletion from Settings.
- Monetization UX: Clear messaging for premium limits and upgrade flow in `PremiumFeature`.
- Testing & CI: Add unit tests for `useDataManagement` and `PantryScanner`, and Github Actions workflows for tests.
- Monitoring & Alerts: Add Sentry for error reporting and monitor heavy DB write patterns in `DatabaseMonitoringService`.
- Localization: Extract strings for translation (i18n-ready).

As tasks are implemented, this section will be updated to mark them complete.
