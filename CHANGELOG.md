# Changelog

All notable changes to Smart Pantry Chef will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-02-13

### Added
- **Expiry Alerts**: Added persistent expiry alert system with visual indicators
  - Items expiring within 7 days now show a clock icon in the pantry view
  - Alert status is stored with each item to avoid constant database queries
  - Automatic calculation when adding or updating items with expiration dates
 - **Community Quick-Save**: Added a "Save Recipe" quick action on Community cards to let users save recipes directly from community ratings
 - **Rating Persistence**: Ratings now persist the embedded `recipe` object at submission time so Community entries display correct title, image, and ingredients without additional lookups
 - **Sanitize Recipe Saves**: Recipe saves now strip placeholder or empty ingredient/instruction fields to prevent saving incomplete recipes

### Fixed
- **Database Performance**: Resolved critical performance issue causing excessive database reads
  - **Root Cause**: Random cleanup operations running 10% of the time on every inventory save
  - **Impact**: Reduced database reads from 1,002 per minute to ~2 per minute (99.8% reduction)
  - **Solution**: Removed unnecessary random cleanup operations that were causing periodic query spikes
  - **Result**: Database queries now remain stable instead of growing every 30 seconds
- **Meal Plan Performance**: Fixed infinite loop in meal plan listener causing excessive database reads
  - Replaced shallow array comparison with deep equality check using `hasMealPlansChanged`
  - Prevents unnecessary state updates when meal plan data hasn't actually changed
- **Database Monitoring**: Fixed TypeError in `DatabaseMonitoringService.getDocs` when queryRef.parent is null

### Fixed (2026-02-24)
- **Meal Planner today label & date handling**: Corrected local date handling and label logic so the Meal Planner shows the correct "today" meal and preserves meal-type labels when editing or saving plans.
- **Database instrumentation coverage**: Replaced several runtime direct Firestore calls with `DatabaseMonitoringService` wrappers to ensure reads/writes are tracked by analytics and monitoring.
- **TypeScript: defensive casts and guards**: Added defensive `doc.data()` casts/guards in services and small type fixes to reduce compile errors (e.g., `recipeRatingService`, `householdService`, `imageCacheService`).
- **Meal plan cache API**: Fixed incorrect `setDoc` call signature in `mealPlanCacheService` (removed unsupported options arg for wrapper).

### Changed (2026-02-24)
- **Developer**: Continued incremental TypeScript remediation focused on low-risk fixes (casting, adding missing local interfaces, and normalizing date handling) to make the codebase easier to iterate on.

### Changed
- **Inventory Management**: Migrated PantryScanner to use InventoryCacheService for efficient bulk operations
- **Database Monitoring**: Reduced update frequencies for PerformanceMonitoringDashboard (1s → 60s) and DatabaseAnalytics (5s → 60s)
- **Listener Optimization**: Added 6-second throttling to inventory listeners to prevent excessive reads
 - **AdMob Gating**: AdMob banners and interstitials are now shown only to non-premium (free) users; ad display is gated by feature flags and user subscription status
 - **Payments Migration**: Removed Stripe and PayPal client integrations; migrated in-app purchases and subscriptions to Google Play Billing (Android). Web payment UI components were removed or gated behind premium feature flags.

### Investigation
- **Database Read Issue**: Investigated excessive database reads occurring every 6 seconds; implemented throttling and monitoring adjustments (later reverted due to increased read volume)

### Fixed (2026-02-18)
- **Shopping List**: Fixed a dynamic-import runtime error by correcting a syntax issue in `components/ShoppingList.tsx`. Normalized selection behavior to use only the `checked` flag and removed top-level Select All / Delete Checked controls.
- **Price Cache Auth**: Made price-cache Firestore access auth-aware to prevent permission errors when the app initializes before authentication.
- **TypeScript Hygiene**: Applied targeted type fixes to reduce compiler noise: narrowed unknown `catch` types, adjusted optional properties in `groceryPriceService`, and fixed several utility typings (`utils/appUtils.ts`, `utils/errorUtils.ts`).

### Changed (developer)
- Continued incremental TypeScript remediation across the repository (focused, low-risk patches). Next focus: add typed Firestore test mock factories to resolve many test mock typing errors.

## [1.3.1] - 2026-02-09

### Fixed
- **Settings Component**: Resolved duplicate declaration error causing dynamic import failures
- **Household Member Management**: Fixed currentUser scope error in member preferences
- **Component Architecture**: Various component fixes and improvements across the application

## [1.3.0] - 2026-02-02

### Enhanced
- **Performance Optimizations**: Comprehensive performance improvements across the application
  - **Critical Fixes**: Replaced JSON.stringify with direct object comparison, deduplicated Firestore listeners, implemented batch operations
  - **Memory Management**: Added useCallback optimizations, list memoization, lazy loading for components
  - **UI Performance**: Implemented virtual scrolling for large lists, search debouncing (300ms), optimized re-renders
  - **Data Operations**: Enhanced Firestore batch operations and optimistic updates

### Enhanced
- **Code Architecture**: Major refactoring for maintainability and performance
  - **Service Layer**: Extracted business logic to dedicated services (pantryService.ts)
  - **State Management**: Implemented Context API to eliminate prop drilling (AppContext, AppActionsContext)
  - **Listener Management**: Created generic hooks (useDataListener) to remove duplicate Firestore listeners
  - **Error Handling**: Added comprehensive error boundaries for component resilience

### Enhanced
- **TypeScript Strict Mode**: Enabled strict TypeScript compiler options for better type safety
  - **Compiler Configuration**: Added "strict": true, "noImplicitAny": true, "strictNullChecks": true, and other strict options
  - **Type Safety**: Improved code reliability with compile-time error detection

### Enhanced
- **Progressive Image Loading**: Implemented blur-up technique for recipe images
  - **ProgressiveImage Component**: Created reusable component with blur placeholder and smooth transitions
  - **Blur Data URLs**: Added utility function to generate SVG-based blur placeholders
  - **Recipe Images**: Updated RecipeModal and RecipeFinder to use progressive loading
  - **Loading States**: Added loading indicators during image transitions

### Enhanced
- **Loading States**: Comprehensive loading indicators for all async operations
  - **Settings Component**: Added loading states for profile updates, avatar changes, and bulk image operations
  - **RecipeFinder**: Enhanced loading states with skeleton loaders during recipe searches
  - **User Feedback**: Visual loading indicators with disabled states and spinner animations

### Enhanced
- **Skeleton Loaders**: Data-dependent components now show skeleton placeholders
  - **SkeletonLoader Components**: Added PantryItemSkeleton, ShoppingListItemSkeleton, and MealPlanSkeleton
  - **RecipeFinder**: Shows skeleton recipe cards while loading search results
  - **Improved UX**: Better perceived performance with structured content placeholders

## [1.2.1] - 2026-01-28

### Fixed
- **Modal Header Positioning**: Fixed ItemDetailModal and RecipeModal headers to prevent overlap with app header
  - Headers now use fixed positioning at top-[100px] with proper z-index stacking
  - Added padding adjustments to ensure content scrolls correctly under fixed headers
  - Improved close button accessibility and modal usability
- **Scan Review Modal Positioning**: Fixed oversized display and navigation overlap issues
  - Adjusted modal positioning to account for app header (pt-24) and bottom navigation (pb-20)
  - Changed max height from 80vh to calc(100vh-160px) for proper viewport sizing
  - Added responsive width constraints (max-w-sm on mobile, max-w-2xl on larger screens)
  - Improved item layout with stacked remove buttons to ensure all controls are visible
  - Modal now displays correctly within screen bounds without cutting off top or bottom
- **Scan Review Modal**: Identified need for fixed header positioning (pending implementation)
  - AI image analysis confirmation modal should use same fixed header pattern
  - Will prevent header from scrolling away during item review process

### Enhanced
- **Android Build Compatibility**: Upgraded Java runtime to version 21 LTS for improved Android build stability
- **Shopping List Transfer**: Fixed quantity handling when transferring items from shopping list to pantry
  - Added default purchased quantities to prevent transfer failures
  - Improved data consistency during checkout operations

### Fixed
- **Nutrition API Integration**: Resolved USDA FoodData Central API loading issues
  - Changed from process.env to import.meta.env for proper Vite environment variable access
  - Prioritized survey and foundation food data for better nutrition information quality
  - Enhanced nutrient value extraction and display formatting

### Enhanced
- **Item Detail Modal**: Increased image size from w-20 h-20 to w-24 h-24 for better visual space utilization

## [1.2.0] - 2026-01-26

### Added
- **AI Features Opt-in System**: Comprehensive user consent management for Gemini AI-powered features
  - **Settings AI Section**: New "AI Features" section with toggle to enable/disable AI-powered image analysis and smart suggestions
  - **Usage Tracking**: Daily usage counter showing API requests (100/day limit) with clear visual feedback
  - **Privacy Controls**: Explicit user opt-in required before accessing Gemini AI services
  - **Graceful Degradation**: Clear error messages when AI features are disabled, preventing API errors

### Enhanced
- **Pantry Scanner Modal**: Improved modal positioning with 75px bottom padding for better screen centering
- **Mobile Experience**: Resolved horizontal scrolling issues across all components with global overflow-x-hidden
- **Component Architecture**: Updated PantryScanner and Settings components with proper user prop interfaces

### Fixed
- **Android Build System**: Upgraded Gradle Plugin (8.10.0) and Gradle (8.11.1) to resolve compatibility issues
- **Syntax Errors**: Resolved multiple TypeScript compilation errors and code structure issues
- **AI API Integration**: Added opt-in verification before Gemini API calls to prevent unauthorized usage

### Enhanced
- **Offline & Sync Experience**: Comprehensive offline capabilities and sync management
  - **Enhanced Offline Queue Service**: Upgraded with conflict resolution, retry logic, and progress tracking
  - **Sync Status Management**: Real-time sync status with pending operations counter and error handling
  - **Visual Sync Indicators**: Header-integrated sync status showing online/offline state, progress bars, and conflict alerts
  - **Automatic Background Sync**: Seamless data synchronization when connection is restored
  - **Conflict Detection**: Intelligent handling of data conflicts with user resolution options
- **Accessibility (a11y) Improvements**: Comprehensive accessibility enhancements across the application
  - **ARIA Labels**: Added descriptive labels for all interactive elements (buttons, forms, navigation)
  - **Keyboard Navigation**: Implemented full keyboard support with visible focus indicators
  - **Screen Reader Support**: Enhanced compatibility with screen readers using semantic HTML and ARIA attributes
  - **Focus Management**: Added proper focus rings and logical tab order for all components
  - **Semantic HTML**: Improved document structure with proper roles and landmarks
  - **Form Accessibility**: Added field labels, validation messages, and required field indicators

### Enhanced
- **Mobile Layout Optimization**: Comprehensive spacing improvements for mobile devices
  - **Header Spacing**: Optimized 120px top padding for proper content positioning below fixed header
  - **Navigation Spacing**: Minimized bottom gap to 8px minimum, eliminating excessive whitespace above navigation
  - **Safe Area Integration**: Enhanced compatibility with device notches and navigation bars
  - **Content Flow**: Improved vertical spacing throughout the application for better mobile UX

### Fixed
- **Mobile Layout Issues**: Resolved excessive padding and spacing problems in MainContent component
- **Component Spacing**: Fixed inconsistent spacing between header, content, and navigation elements

### Technical
- **Layout Calculations**: Updated MainContent height calculations to properly account for fixed header and navigation heights
- **Safe Area Service**: Improved mobile device compatibility with proper safe area handling

### Fixed
- **Shopping List Sync Issues**: Resolved purchased quantity deletion and reversion problems
  - **Data Validation**: Added `cleanObject()` function to remove undefined fields before Firestore writes
  - **Sync Logic**: Excluded `purchasedQuantity` from sync comparisons to prevent Firestore overwrites
  - **User Experience**: Shopping list items now maintain state when modifying purchased quantities
- **AI Image Processing Modal**: Fixed modal content being cut off behind header/navigation
  - **Modal Positioning**: Increased z-index to `z-[100]` and adjusted top padding to `pt-20`
  - **Modal Sizing**: Increased maximum height to `max-h-[90vh]` for better content visibility
  - **UI Improvements**: Enhanced modal display for AI-powered pantry scanning confirmation
- **Gemini API Rate Limiting**: Implemented automatic retry logic for API rate limit errors
  - **Retry Mechanism**: Added exponential backoff retry (up to 3 attempts, max 10s delay) for 429 errors
  - **Error Handling**: Improved error messages for rate limit scenarios with user-friendly feedback
  - **Multi-Search Support**: Users can now perform multiple AI searches per session without immediate failures

## [1.1.9] - 2026-01-24

### Enhanced
- **Interactive Tutorial System**: Complete overhaul of the onboarding tutorial with robust click detection
  - **Theme Toggle Tutorial**: Fixed click detection reliability for theme button interactions
  - **Add Item Tutorial**: Added data-tutorial attribute to pantry floating action button for proper click detection
  - **Voice Search Tutorial**: Added data-tutorial attribute to microphone button in recipe finder
  - **Click Detection Engine**: Implemented stable ref-based event handling to prevent race conditions and missed clicks
  - **Tutorial Flow**: Improved step completion logic with manual DOM traversal for reliable element detection

### Fixed
- **Tutorial Reliability**: Resolved issues where interactive tutorial steps required multiple clicks to register
- **User Experience**: Ensured smooth onboarding flow without getting stuck on tutorial steps

### Technical
- **Event Handling**: Enhanced click detection with refs and manual DOM traversal for consistent behavior
- **Component Attributes**: Added data-tutorial attributes to interactive elements (theme-toggle, add-item-button, voice-search)
- **State Management**: Improved tutorial state handling to prevent re-render interference with click detection

## [1.1.8] - 2026-01-22

### Fixed
- **Database Performance**: Optimized inventory sync with 1-second debouncing and remote update detection to reduce excessive Firestore reads (from 12-15 per item deletion to 1-2)
- **Nutrition API CORS**: Created Firebase Function proxy for USDA FoodData Central API calls to eliminate browser CORS restrictions
- **Content Security Policy**: Updated CSP policy to allow connections to Firebase Functions emulator (localhost:5001) for development

### Technical
- **Firebase Functions**: Added `getNutritionData` function with support for both food search and detailed nutrition retrieval
- **Nutrition Service**: Refactored to use Firebase Function proxy for all USDA API calls, eliminating direct browser requests
- **Error Handling**: Improved nutrition data fetching with proper fallback strategies and caching

## [1.1.8] - 2026-01-18

### Fixed
- **Critical Runtime Errors**: Resolved multiple TypeScript errors causing app crashes including `userProfile` undefined errors, missing `selectedDayIndex` state, and sodium property access issues
- **Settings Component**: Added proper null checking and optional chaining for user profile data to prevent crashes
- **MealPlanner Component**: Fixed missing state variable causing day selection modal errors
- **RecipeModal**: Fixed nutrition calculation errors with proper type handling
- **Bundle Optimization**: Resolved Vite dynamic import warning by consolidating householdService imports

### Enhanced
- **Saved Recipes UI**: Added beautiful thumbnail images to saved recipes tab for improved visual appeal
- **Recipe Cards**: Enhanced compact recipe display with 16:9 aspect ratio images and hover effects
- **Error Handling**: Improved image loading with fallback placeholders for missing recipe images

### Technical
- **Type Safety**: Added comprehensive optional chaining throughout Settings component
- **Import Optimization**: Converted dynamic imports to static imports for better bundle splitting
- **Build Process**: Cleaned up all TypeScript compilation errors and warnings

### Fixed
- **Capacitor App Listener**: Fixed runtime error "removeListener is not a function" by implementing proper async listener cleanup with useRef
- **TypeScript Compilation**: Resolved 77 TypeScript errors across the application including missing interfaces, methods, and type declarations
- **Form Accessibility**: Added proper id/name attributes and htmlFor labels to all form inputs for WCAG compliance
- **Visual Inventory Levels**: Fixed quantity display to show fractional amounts (½ gal, ¼ cup) when using visual fill level selector
- **Quantity Formatting**: Enhanced formatItemQuantity function to display common fractions (¼, ½, ¾) instead of decimals

### Technical
- **Type Definitions**: Added Member interface, visualLevel field to PantryItem type, and comprehensive Vite environment declarations
- **Service Methods**: Added trackHouseholdJoin and recordMealPlanAddition methods to analytics and usage services
- **Firebase Exports**: Added missing functions export to firebaseConfig.ts for cloud functions integration

## [1.1.7] - 2026-01-08

### Features
- **Usage Limit Enforcement**: Added button disabling when users hit weekly usage limits to prevent excessive database reads
- **Subscription Tier Rebalance**: Updated Premium plan limits (15 searches/week, 20 recipes, 7-day planning) and Family plan (unlimited everything, 5 members)
- **Mobile Back Button Support**: Implemented hardware back button functionality for Android devices to close modals and navigate between tabs
- **Double-Tap Exit**: Enhanced back button with double-tap to exit app, showing a toast message on first press
- **Meal Planner Help**: Added help icon (?) with tooltip explaining drag & drop and day-clicking functionality

### Removed
- **Cooking Reminders**: Removed bell icon notifications from meal planner to reduce UI clutter

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