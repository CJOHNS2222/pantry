import { PriceData, PriceDataCacheService } from './priceDataCacheService';

// This is the shape of the data that the Open Prices API returns.
interface OpenPricesAPIResponse {
  "product_name": string;
  "barcode": string;
  "store_name": string;
  "price": number;
  "currency": string;
  "date": string;
}

// This is the shape of the data that we store in our cache.
export interface PriceCache {
  [itemName: string]: PriceData;
}

// This class is responsible for fetching price data from the Open Prices API and caching it.
class PriceCacheService {
  private static readonly API_URL = 'https://www.openprices.org/api/v0/prices';

  // This is the in-memory cache that we use to store price data.
  private cache: PriceCache = {};

  // This function loads the price data from the cache.
  async loadPriceData() {
    const cachedData = await PriceDataCacheService.loadPriceData();
    this.cache = cachedData;
  }

  // This function gets the price data for a single item from the cache.
  getPriceData(itemName: string): PriceData | undefined {
    return this.cache[itemName.toLowerCase()];
  }

  // This function sets the price data for a single item in the cache.
  setPriceData(itemName: string, data: PriceData) {
    this.cache[itemName.toLowerCase()] = data;
    this.persistToFirestore();
  }

  // This function fetches the price data for a single item from the Open Prices API.
  async fetchPriceData(itemName: string): Promise<PriceData | null> {
    try {
      const response = await fetch(`${PriceCacheService.API_URL}?product_name=${encodeURIComponent(itemName)}`);
      const data: OpenPricesAPIResponse[] = await response.json();

      if (data && data.length > 0) {
        // Calculate the average, min, and max price from the API response.
        const prices = data.map(item => item.price);
        const averagePrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        // Create a new PriceData object and store it in the cache.
        const priceData: PriceData = {
          averagePrice: parseFloat(averagePrice.toFixed(2)),
          minPrice: minPrice,
          maxPrice: maxPrice,
          sampleSize: data.length,
          lastUpdated: new Date(),
          unit: 'each', // You may want to update this based on your product data
        };
        this.setPriceData(itemName, priceData);
        return priceData;
      }
    } catch (error: any) {
      console.error(`Failed to fetch price data for ${itemName}:`, error);
    }

    return null;
  }

  // This function persists the in-memory cache to Firestore.
  private persistToFirestore() {
    // We use a timeout to debounce the writes to Firestore.
    setTimeout(() => {
      try {
        PriceDataCacheService.savePriceData();
      } catch (error: any) {
        console.error('Failed to persist price data to Firestore:', error);
      }
    }, 1000);
  }
}

export const priceCacheService = new PriceCacheService();
