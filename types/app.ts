export enum Tab {
  PANTRY = 'PANTRY',
  SHOPPING = 'SHOPPING',
  MEALS = 'MEALS',
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
