# Changelog

All notable changes to Smart Pantry Chef will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-04

### Added
- **Item Cards UI**: Replaced cluttered inline controls with clean item cards for better pantry management
- **Original Quantity Preservation**: Added `originalQuantity` field to preserve recipe quantities (e.g., "1/2 cup", "4 oz") when moving items from shopping list to pantry
- **Recipe Quantity Display**: Item detail modal now shows original recipe quantity alongside current pantry quantity
- **Improved Quantity Controls**: Replaced text input with intuitive +/- buttons for quantity adjustment
- **Smart Save Button**: Save/Cancel buttons only appear when quantity has actually changed

### Fixed
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