export enum Tab {
  PANTRY = 'PANTRY',
  PANTRY_CACHE_TEST = 'PANTRY_CACHE_TEST',
  SHOPPING = 'SHOPPING',
  MEALS = 'MEALS',
  /* eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values */
  MEAL_PLAN = 'MEALS',
  RECIPES = 'RECIPES',
  COMMUNITY = 'COMMUNITY',
  SETTINGS = 'SETTINGS'
}

export type Theme = 'dark' | 'light';

export interface PriceHistoryEntry {
  date: Date;
  price: number;
}

export interface PriceTrend {
  currentPrice: number;
  lastUpdated: Date;
  priceChange: number;
  priceChangePercent: number;
  priceHistory: PriceHistoryEntry[];
}
