export enum Tab {
  PANTRY = 'PANTRY',
  PANTRY_CACHE_TEST = 'PANTRY_CACHE_TEST',
  SHOPPING = 'SHOPPING',
  MEALS = 'MEALS',
  MEAL_PLAN = 'MEALS',
  RECIPES = 'RECIPES',
  COMMUNITY = 'COMMUNITY',
  ANALYTICS = 'ANALYTICS',
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
