import { auth } from '../firebaseConfig';
import DatabaseMonitoringService from './databaseMonitoringService';

// Represents the structure of price data for a single grocery item
export interface PriceData {
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  sampleSize: number;
  lastUpdated: Date;
  unit: string;
}

// Structure of the cache document stored in Firestore
export interface PriceDataCache {
  [itemName: string]: PriceData;
}

// Service for managing the cache of grocery item price data
export class PriceDataCacheService {
  private static readonly CACHE_COLLECTION = 'price_cache';
  private static readonly CACHE_DOC_ID = 'priceData';

  // Debounce saving to Firestore to avoid rapid writes
  private static saveTimeout: NodeJS.Timeout | null = null;

  // In-memory cache to reduce Firestore reads
  private static priceData: PriceDataCache = {};
  private static hasLoaded = false;

  // Get a reference to the global cache document
  private static getCacheRef() {
    return DatabaseMonitoringService.doc(`${this.CACHE_COLLECTION}/${this.CACHE_DOC_ID}`);
  }

  // Load all price data from the cache
  static async loadPriceData(): Promise<PriceDataCache> {
    // Ensure we only try to load if a user is logged in
    if (!auth.currentUser) {
      console.log('User not authenticated, skipping price data load.');
      return {};
    }
    // Avoid re-loading if we already have the data
    if (this.hasLoaded) {
        return this.priceData;
    }

    try {
      const cacheRef = this.getCacheRef();
      const docSnap = await DatabaseMonitoringService.getDoc(cacheRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as PriceDataCache;
        // Convert Firestore Timestamps to JS Date objects
        for (const key in data) {
          if (data[key].lastUpdated && (data[key].lastUpdated as any).toDate) {
            data[key].lastUpdated = (data[key].lastUpdated as any).toDate();
          }
        }
        this.priceData = data;
        this.hasLoaded = true;
        return data;
      }
    } catch (err: any) {
      console.error("Failed to load price data cache:", err);
    }
    return {};
  }

  // Get price data for a single item from the in-memory cache
  static getPriceData(itemName: string): PriceData | undefined {
    return this.priceData[itemName.toLowerCase()];
  }

  // Set price data for a single item in the in-memory cache and schedule a save
  static setPriceData(itemName: string, data: PriceData) {
    this.priceData[itemName.toLowerCase()] = data;
    this.scheduleSave();
  }

  // Debounce the save operation to avoid too many writes
  private static scheduleSave() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.savePriceData();
    }, 2000); // Wait 2 seconds before saving
  }

  // Save the entire in-memory cache to Firestore
  static async savePriceData() {
    // Ensure we only try to save if a user is logged in
    if (!auth.currentUser) {
      console.log('User not authenticated, skipping price data save.');
      return;
    }

    try {
      const cacheRef = this.getCacheRef();
      await DatabaseMonitoringService.setDoc(cacheRef, this.priceData);
    } catch (err: any) {
      console.error("Failed to save price data cache:", err);
    }
  }

  // Call this on user logout
  static clearCache() {
    this.priceData = {};
    this.hasLoaded = false;
  }
}
