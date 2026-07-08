/// <reference types="vitest" />
/// <reference types="@testing-library/jest-dom" />

// Relax Firestore snapshot types for test mocks so test fixtures can be plain objects
declare module 'firebase/firestore' {
  export interface DocumentSnapshot<T = any> {
    exists: boolean | (() => boolean);
    data(): T;
    id?: string;
    metadata?: any;
    get?: any;
    toJSON?: any;
    ref?: any;
  }

  export interface QuerySnapshot<T = any> {
    docs: DocumentSnapshot<T>[];
    forEach: any;
    size: number;
    empty: boolean;
    metadata?: any;
    query?: any;
    docChanges?: any;
    toJSON?: any;
  }
}

// Allow vitest's `mocked` helper to be used without strict generic typing in tests
declare module 'vitest' {
  export function mocked<T = any>(fn: T): any;
}

export {};

// Minimal project type shims for tests (relative import paths used in tests)
declare module '../../types' {
  export interface StructuredRecipe { [key: string]: any }
  export interface SavedRecipe { [key: string]: any }
  export interface User { id: string; email?: string; name?: string; householdId?: string; provider?: string; hasSeenTutorial?: boolean; discoveredFeatures?: string[]; dismissedTutorialTips?: string[]; fcmTokens?: string[] }
  export interface GroceryPrice { [key: string]: any }
  export interface PriceTrend { currentPrice?: number | undefined; priceChange?: number | undefined; priceChangePercent: number; lastUpdated: Date; priceHistory: { date: Date; price: number }[] }
}

declare module '../types' {
  export interface StructuredRecipe { [key: string]: any }
  export interface SavedRecipe { [key: string]: any }
  export interface User { id: string; email?: string; name?: string; householdId?: string; provider?: string; hasSeenTutorial?: boolean; discoveredFeatures?: string[]; dismissedTutorialTips?: string[]; fcmTokens?: string[] }
}

declare module '../../../types' {
  export interface StructuredRecipe { [key: string]: any }
  export interface SavedRecipe { [key: string]: any }
  export interface User { id: string; email?: string; name?: string; householdId?: string; provider?: string; hasSeenTutorial?: boolean; discoveredFeatures?: string[]; dismissedTutorialTips?: string[]; fcmTokens?: string[] }
}

// Provide a global GroceryPrice for tests that reference it by name
declare global {
  interface GroceryPrice { id?: string; ingredient?: string; price?: number; unit?: string; store?: string; currency?: string; lastUpdated?: Date; source?: string }
}
