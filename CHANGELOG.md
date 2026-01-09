# Changelog

All notable changes to Smart Pantry Chef will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.7] - 2026-01-08

### Features
- **Usage Limit Enforcement**: Added button disabling when users hit weekly usage limits to prevent excessive database reads
- **Subscription Tier Rebalance**: Updated Premium plan limits (15 searches/week, 20 recipes, 7-day planning) and Family plan (unlimited everything, 5 members)
- **Mobile Back Button Support**: Implemented hardware back button functionality for Android devices to close modals and navigate between tabs
- **Double-Tap Exit**: Enhanced back button with double-tap to exit app, showing a toast message on first press

### Fixed
- **Performance**: Prevented repeated API calls after hitting limits
- **Free Tier Limits**: Fixed issue where free users showed 0 available searches instead of 5

## [1.1.6] - 2026-01-07

### Infrastructure
- **Firebase Project Migration**: Complete migration from legacy project to new Firebase project
  - **Project ID Change**: Migrated from `gen-lang-client-0893655267` to `ornate-compass-478504-e1`
  - **Data Migration**: Successfully migrated 316 Firestore documents and 6 authentication users
  - **Configuration Updates**: Updated all Firebase configuration files (.firebaserc, .env.local, firebaseConfig.ts)
  - **Service Continuity**: Maintained all existing functionality during migration

### Monitoring & Analytics
- **Firebase Performance Monitoring**: Comprehensive performance tracking implementation
  - **AI Operations**: Added traces for `analyze_pantry_image` and `search_recipes` with custom metrics
  - **Database Operations**: Performance monitoring for Firestore read/write operations
  - **External API Calls**: Tracking Spoonacular API response times and success rates
  - **Image Processing**: Monitoring image upload operations and file sizes
  - **Household Management**: Performance traces for user management and household operations
  - **Utility Functions**: Ingredient parsing performance for shopping list generation

### Technical
- **Firebase Crashlytics**: Enhanced Android crash reporting setup
  - **SDK Integration**: Added Crashlytics 3.0.6 dependency and plugin configuration
  - **Debug Logging**: Enabled performance event logging in AndroidManifest.xml
  - **Test Crash Button**: Added crash testing functionality in MainActivity.java
- **Build Configuration**: Updated Android Gradle configuration for monitoring services
- **Performance Metrics**: Custom attributes and metrics for detailed performance analysis

## [1.1.5] - 2026-01-07

### Performance
- **Bundle Size Optimization**: 71% reduction in main bundle size through manual chunk splitting
  - **Main Bundle**: Reduced from ~1MB to 273KB (82KB gzipped)
  - **Firebase Vendor Chunk**: 670KB (157KB gzipped) - separated for independent loading
  - **Gemini AI Service Chunk**: 225KB (41KB gzipped) - lazy-loaded for AI features
  - **Analytics Service Chunk**: 13KB (5KB gzipped) - separated from AI services
  - **Faster Initial Load**: Improved app startup performance and reduced memory usage

### Fixed
- **Infinite Saving Loops**: Resolved constant Firestore writes in shopping list and inventory
  - **Data Change Detection**: Added JSON comparison checks in Firestore listeners
  - **Performance Improvement**: Eliminated unnecessary database operations
  - **Battery Life**: Reduced device battery drain from constant syncing
- **External Image Fetching**: Implemented async image loading for all item creation paths
  - **Pantry Scanner**: Async image fetching for scanned items
  - **Manual Item Addition**: Async image fetching for manually added items
  - **Shopping List Conversion**: Async image fetching when moving items to pantry

### Technical
- **Build Configuration**: Enhanced Vite config with manual chunk splitting strategy
- **Code Splitting**: Separated vendor libraries into logical, cacheable chunks
- **Lazy Loading**: Components and services load on-demand for better performance

## [1.1.4] - 2026-01-07

### Added
- **Interactive Tutorial System**: Complete overhaul of user onboarding experience
  - **15-Step Guided Tour**: Interactive walkthrough covering all major app features
  - **Glow Highlighting**: Replaced circle overlays with smooth CSS glow effects on actual buttons
  - **Dynamic Modal Positioning**: Tutorial modal automatically adjusts position to avoid navigation bar overlap
  - **Smart Timing**: 2-second pause for household button to allow visual identification before auto-click
  - **Theme Toggle Demo**: Automatic theme switching demonstration with return to dark theme
  - **Context-Aware Descriptions**: Updated tutorial text to match actual app interface and features
- **UI/UX Enhancements**: Comprehensive visual and interaction improvements
  - **Hover Animations**: Smooth scale and shadow transitions on interactive elements
  - **Progressive Loading**: Skeleton loaders and smooth content transitions throughout the app
  - **Voice Search Integration**: Microphone button for voice-powered recipe and ingredient search
  - **Accessibility Improvements**: Enhanced keyboard navigation, screen reader support, and focus management
  - **Cooking Reminders**: Smart notification system for meal preparation timing
  - **Enhanced Analytics Dashboard**: Improved Firebase Analytics integration with detailed usage insights
- **Tutorial Navigation Improvements**:
  - **Raised Modal Positioning**: Tutorial modal positioned 25px higher for navigation-related steps
  - **Corrected Feature Descriptions**: Updated tutorial text to accurately reflect app functionality
  - **Recipe Finder Clarification**: Tutorial now correctly references "Chef" tab and "Use Inventory Only" option
  - **Meal Planning Guidance**: Clear instructions for adding recipes by clicking days in the meal planner

### Changed
- **Tutorial Descriptions**: Updated all tutorial step descriptions to match actual app interface and functionality
- **Recipe Search Guidance**: Tutorial now explains clicking days to add recipes instead of non-existent search buttons
- **AI Recipe Finder**: Tutorial references correct tab name ("Chef") and search option ("Use Inventory Only")

### Fixed
- **Tutorial Timing**: Added appropriate delays for user comprehension before automatic actions
- **Theme Persistence**: Tutorial now returns to dark theme after theme toggle demonstration
- **Modal Positioning**: Tutorial modal no longer overlaps navigation bar during navigation steps

## [1.1.3] - 2026-01-06

## [1.1.3] - 2026-01-06

### Added
- **MealPlanner Redesign**: Complete reconfiguration of meal planning interface
  - **Unified Calendar View**: Removed list/calendar toggle, now uses calendar grid as primary interface
  - **Day Detail Modal**: Click any day to open fullscreen modal showing detailed meal planning for that day
  - **Recipe Search Integration**: "Add Recipe" buttons in empty meal slots open search modal
  - **Saved Recipes Access**: Search modal shows both AI-generated recipes and user's saved recipes
  - **Enhanced Meal Management**: View, add, and remove recipes directly from day detail modal
- **Context-Aware Recipe Modal**: Dynamic button display based on usage context
  - **Search Context**: Shows "Save Recipe" and "Add to Plan" buttons when browsing recipes
  - **Scheduled Context**: Shows "Mark as Made" and "Remove from Plan" buttons for planned meals
  - **Saved Recipes Context**: Shows "Add to Plan" and "Delete Recipe" buttons for saved recipes
- **Enhanced Recipe Search UI**: Improved recipe discovery with tile-based layout
  - **3-Column Tile Grid**: Recipes displayed in clean tiles with image, title, cook time, and calories
  - **Clickable Recipe Tiles**: Click any tile to preview recipe details before adding
  - **Unified Recipe Source**: Single search interface for both AI-generated and user-saved recipes
- **Smart Ingredient Cleaning**: Automatic removal of descriptive preparation words from shopping list items
  - **Recipe Ingredients**: Ingredients like "2 chopped onions" become "Onion" in shopping lists
  - **Pantry Items**: Descriptive words like "chopped", "minced", "diced", "sliced", "finely" are removed when adding to shopping lists
  - **Enhanced Shopping Experience**: Cleaner, more actionable shopping list items for better grocery shopping
- **Recipe Ratings System**: Complete rating and review functionality for recipes
  - **Post-Cooking Rating Prompt**: After marking a recipe as made, users are prompted to rate the recipe
  - **Dedicated Rating Modal**: Clean, focused modal for rating recipes with star selection and optional comments
  - **MealPlanner Integration**: Ratings functionality now available in MealPlanner recipe modals
  - **Event Handling Fix**: Resolved modal closing issues when interacting with rating inputs
- **Recipe Data Management Scripts**: New utility scripts for maintaining recipe database quality
  - **Bulk Recipe Upload Enhancements**: Improved deduplication and duplicate description prevention
  - **Incomplete Recipe Cleanup**: Script to remove recipes with missing instructions
  - **Duplicate Description Cleanup**: Script to remove redundant descriptions matching instructions
- **RecipeFinder Firebase Integration**: Replaced hardcoded recipes with dynamic Firebase data
  - **4-Column Tile Layout**: Updated from 3-column to 4-column grid for better space utilization
  - **Category Filtering**: Added filter buttons for different recipe categories
  - **Real-time Firebase Data**: Popular recipes section now loads from user's saved recipes
- **API Optimization**: Switched to free recipe API with paid fallback
  - **TheMealDB Primary API**: Free, reliable recipe source as primary data provider
  - **Spoonacular Fallback**: Paid API used only when free API is unavailable
  - **Cost Reduction**: Significantly reduced API costs while maintaining functionality

### Fixed
- **MealPlanner Grid Display**: Resolved 3-column tile layout issues in recipe search modal
- **Recipe Deduplication**: Added filtering to prevent duplicate recipes in saved recipes list
- **Bulk Upload Optimization**: Enhanced to fetch unique recipes and prevent duplicate API calls
- **Search Result Variety**: Improved query randomization to avoid repetitive recipe results
- **Modal Event Handling**: Fixed rating modal closing when clicking input fields

### Changed
- **MealPlanner UX**: Streamlined from dual-view system to single calendar-based workflow
- **Recipe Addition Flow**: Now integrated directly into meal planning with contextual search

### Removed
- **List View Toggle**: Eliminated list/calendar view switching buttons for simplified interface
- **Complex View State**: Removed viewMode state management in favor of modal-based interaction

## [1.1.2] - 2026-01-05

### Added
- **Cooking Timer**: Recipe timer feature in RecipeModal with MM:SS display, progress bar, and play/pause/reset controls
- **Smart Substitutions**: Missing ingredient detection with category-based ingredient suggestions
- **Weekly Meal Prep Calendar**: Dual-view meal planning with list and calendar view modes
- **Calendar View Toggle**: Switch between traditional list view and new grid-based calendar layout
- **Pantry Analytics Dashboard**: Statistics and visualization dashboard with charts and item metrics

### Changed
- **MealPlanner Calendar Layout**: Optimized from 7-column grid to 3-column grid for better mobile/tablet display
- **Calendar Cell Height**: Increased from 200px to 250px for improved meal content visibility
- **Calendar Header**: Removed redundant day name labels above calendar grid (Mon, Tue, Wed, etc.)

### Removed
- **Batch Selection Feature**: Removed multi-select/batch edit functionality from PantryScanner component for simplified UI

### Fixed
- **Calendar Feature**: Re-implemented calendar functionality with proper state management and view toggling

## [1.1.0] - 2026-01-04

### Added
#### Major Features
- **Item Cards UI**: Replaced cluttered inline controls with clean item cards for better pantry management
- **Fixed Price Trends**: Complete Open Prices API integration with proper error handling and data visualization
- **Original Quantity Preservation**: Added `originalQuantity` field to preserve recipe quantities (e.g., "1/2 cup", "4 oz") when moving items from shopping list to pantry
- **Improved Quantity Controls**: Replaced text input with intuitive +/- buttons for quantity adjustment
- **Enhanced Theming Consistency**: Applied consistent theming throughout all components using CSS custom properties

#### New Components (6 new)
- **ItemDetailModal**: Complete pantry item management interface with quantity controls and theming
- **PriceTrends**: Grocery price trend analysis and visualization component
- **CategoryManager**: Component for managing pantry item categories
- **GroceryCostEstimator**: Tool for estimating grocery costs based on pantry items
- **ErrorBoundary**: Error handling component for graceful failure recovery
- **GlobalUpdatePrompt**: Component for prompting users about app updates
- **SkeletonLoader**: Loading state component for better UX
- **VersionUpdate**: Component for handling version update notifications

#### Services & Integrations (4 new)
- **groceryPriceService**: Service for Open Prices API integration and price trend analysis
- **analyticsService**: Service for Firebase Analytics integration and usage tracking
- **usageService**: Service for tracking user usage patterns and app engagement
- **versionService**: Service for managing app versioning and update checks

#### Functions & Backend (3 new)
- **leaveHousehold**: Firebase function for users to leave household groups
- **migrateHouseholdClaims**: Function for migrating household ownership claims
- **sendHouseholdInvitation**: Function for sending household invitation emails

#### Assets (100+ new)
- **35 Avatar Images**: Enhanced user profile customization options
- **100+ Food Icons**: Comprehensive icon set for pantry items and recipes (converted from WebP to PNG for mobile compatibility)
- **Enhanced Visual Experience**: Improved UI assets for better user engagement

#### Testing (expanded)
- **New Test Files**: Comprehensive test coverage for new components and services
- **Hook Testing**: Added tests for custom React hooks (useAuth, useDataManagement, etc.)
- **Component Validation**: Enhanced component testing with proper validation

#### Infrastructure
- **Android Build Updates**: Improved Capacitor configuration and build processes
- **Firebase Enhancements**: Updated Firebase rules and configuration for better security
- **Capacitor Improvements**: Enhanced mobile app build and deployment
- **Performance Optimizations**: Code splitting and build optimizations for better performance
- **Database Maintenance**: Added automatic cleanup of old meal plan entries to prevent database bloat
- **Asset Management**: Improved image asset handling and mobile compatibility (WebP to PNG conversion)

### Fixed
- **Image Loading Issues**: Fixed pantry item images not loading in Android Capacitor builds by converting WebP assets to PNG and correcting asset serving paths
- **Shopping List Item Images**: Fixed items moved from shopping list to pantry not receiving proper image assignments
- **Meal Plan Database Cleanup**: Added automatic cleanup of old meal plan entries to prevent database bloat and performance issues
- **Milk Expiration Settings**: Updated milk expiration to 10 days with warning threshold at 3 days remaining (instead of 7 days)
- **Price Trends Functionality**: Fixed Firebase permission errors, API network issues, and undefined data crashes
- **Open Prices API Integration**: Corrected API URL from `api.open-prices.org` to `prices.openfoodfacts.org/api/v1`
- **API Response Handling**: Updated response interfaces to match actual Open Prices API structure
- **Theme Consistency**: Applied consistent theming throughout ItemDetailModal and other components
- **Type Safety**: Added proper TypeScript interfaces for PriceTrend and updated imports

### Changed
- **Quantity Editing UX**: Improved quantity adjustment workflow with visual feedback and conditional save buttons
- **Modal Theming**: Updated all modal sections to use CSS custom properties for consistent theming
- **API Parameter Handling**: Removed unsupported location parameter from Open Prices API calls

### Technical
- **New Interfaces**: Added `PriceTrend` and `PriceHistoryEntry` interfaces
- **Service Methods**: Added `getPriceTrendAnalysis()` method for comprehensive price trend data
- **State Management**: Enhanced quantity editing state with change detection
- **Build Optimization**: Successful builds with improved chunk management
- **Build Status**: Project builds successfully with `npm run build`
- **Test Status**: Tests currently failing (exit code 1), investigation needed

## [1.0.0] - 2025-12-XX

### Added
- Initial release of Smart Pantry Chef
- Cross-platform pantry and meal management
- Real-time household sharing via Firebase
- Recipe management and meal planning
- Grocery price estimation with community data
- Subscription system with Stripe integration
- Theme customization and notifications
- Firebase Analytics integration