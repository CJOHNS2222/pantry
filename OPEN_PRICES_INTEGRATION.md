# Open Prices API Integration

## Overview

Smart Pantry now integrates with **Open Prices** - a global, crowdsourced food price database that's completely free and open source.

## How It Works

The app now uses a **3-tier fallback system** for price data:

1. **Primary**: Your existing crowdsourced Firebase data (most accurate, local)
2. **Secondary**: Open Prices API (global community data)
3. **Tertiary**: Default fallback prices (built-in estimates)

## API Details

### Base URL
```
https://api.open-prices.org/
```

### Data Sources
- **Global coverage**: Prices from users worldwide
- **Community-driven**: Anyone can contribute price data
- **Open source**: Free to use, modify, and contribute to
- **No API keys required**: Basic usage is completely free

## Integration Features

### Automatic Fallback
When local crowdsourced data isn't available, the app automatically fetches from Open Prices:

```typescript
// Example: User searches for "banana" prices
// 1. Check Firebase for local user-submitted prices
// 2. If none found, query Open Prices API
// 3. If still none, use default price
```

### Data Quality
- Filters to USD prices only
- Calculates averages, min/max from community data
- Includes sample size information
- Shows data freshness (last updated)

### User Contributions (Optional)
Users can optionally contribute their price data back to the global database:

```typescript
await groceryPriceService.submitToOpenPrices({
  product_name: "Organic Bananas",
  price: 2.99,
  currency: "USD",
  location: "Springfield, IL",
  store: "Local Grocery Store"
});
```

## Benefits

### For Users
- ✅ **More price data available** (global coverage)
- ✅ **Better price discovery** (see what's normal in other areas)
- ✅ **Community-driven** (prices from real people)

### For the App
- ✅ **Zero cost** (completely free API)
- ✅ **No rate limits** (for basic usage)
- ✅ **Global reach** (works worldwide)
- ✅ **Open source alignment** (matches your philosophy)

## Technical Implementation

### Files Modified
- `services/groceryPriceService.ts` - Added Open Prices integration

### New Methods
- `fetchOpenPrices()` - Fetches data from API
- `convertOpenPricesToPriceData()` - Converts API format to app format
- `submitToOpenPrices()` - Allows users to contribute data

### Data Flow
```
User searches for ingredient price
    ↓
Check Firebase (local crowdsourced data)
    ↓
If no data → Query Open Prices API
    ↓
If still no data → Use default prices
    ↓
Return PriceData to user
```

## Usage Examples

### Automatic Price Lookup
```typescript
const priceData = await groceryPriceService.getIngredientPrice('banana');
// Returns: { averagePrice: 0.59, minPrice: 0.49, maxPrice: 0.79, sampleSize: 25, ... }
```

### Contributing Data
```typescript
const success = await groceryPriceService.submitToOpenPrices({
  product_name: "Bananas",
  price: 0.65,
  currency: "USD",
  location: "Your City, State"
});
```

## Data Quality Notes

- **Source**: Community-contributed (variable quality)
- **Coverage**: Better for common grocery items
- **Freshness**: Varies by location and popularity
- **Accuracy**: Cross-reference with your local data

## Future Enhancements

### Potential Additions
- **Location-based filtering** (show prices near user)
- **Price history trends** (from Open Prices data)
- **Store-specific data** (Walmart, Kroger, etc.)
- **User contribution prompts** (encourage data sharing)
- **Data validation** (flag suspicious prices)

### Integration Ideas
- **Price comparison views** (local vs global averages)
- **Travel mode** (see prices in different cities)
- **Community features** (top contributors, data quality scores)

## Contributing to Open Prices

Users can help improve the global database by sharing their local prices. This creates a positive feedback loop where:

1. Users get better price data
2. Users contribute back to the community
3. Everyone benefits from more comprehensive data

## Support

- **Open Prices Website**: https://open-prices.org/
- **GitHub**: https://github.com/openfoodfacts/open-prices
- **API Docs**: https://open-prices.github.io/api/
- **Mobile App**: Available for iOS/Android to contribute data

---

## Summary

The Open Prices integration provides your Smart Pantry app with:
- **Free global price data** as a fallback
- **Community-driven pricing** that aligns with your app's philosophy
- **Zero additional costs** or API keys required
- **Enhanced user experience** with more comprehensive price information

This is a perfect complement to your existing crowdsourced system! 🌍🥬