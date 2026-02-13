import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';
import DatabaseMonitoringService from './databaseMonitoringService';
import { writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface CachedImage {
  originalUrl: string;
  cachedUrl: string;
  itemName: string;
  createdAt: Date;
  lastUsed: Date;
}

// In-memory cache for this session
const memoryCache = new Map<string, CachedImage>();
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const LAST_SYNC_KEY = 'imageCacheLastSync';

/**
 * Downloads an image from a URL and returns it as a Blob
 */
async function downloadImageAsBlob(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    return await response.blob();
  } catch (error) {
    console.error('Error downloading image:', error);
    return null;
  }
}

/**
 * Uploads an image blob to Firebase Storage and returns the download URL
 */
async function uploadImageToStorage(blob: Blob, itemName: string): Promise<string | null> {
  try {
    // Create a clean filename from the item name
    const cleanName = itemName.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .substring(0, 50);

    const timestamp = Date.now();
    const filename = `pantry_images/${cleanName}_${timestamp}.jpg`;

    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);

    return downloadUrl;
  } catch (error) {
    console.error('Error uploading image to storage:', error);
    return null;
  }
}

/**
 * Load cache from localStorage
 */
function loadLocalCache(): void {
  try {
    const cached = localStorage.getItem('imageCache');
    if (cached) {
      const cacheData = JSON.parse(cached);
      // Only load cache if it's less than 24 hours old
      const cacheAge = Date.now() - (cacheData.timestamp || 0);
      if (cacheAge < CACHE_EXPIRY_MS) {
        Object.entries(cacheData.cache).forEach(([key, value]) => {
          memoryCache.set(key, value as CachedImage);
        });
      } else {
        // Clear expired cache
        localStorage.removeItem('imageCache');
      }
    }
  } catch (error) {
    console.error('Error loading local cache:', error);
  }
}

/**
 * Save cache to localStorage
 */
function saveLocalCache(): void {
  try {
    const cacheData = {
      timestamp: Date.now(),
      cache: Object.fromEntries(memoryCache)
    };
    localStorage.setItem('imageCache', JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error saving local cache:', error);
  }
}

/**
 * Sync cache with Firestore (only when needed)
 */
async function syncCacheWithFirestore(): Promise<void> {
  const lastSync = localStorage.getItem(LAST_SYNC_KEY);
  const now = Date.now();
  const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  // Only sync if it's been more than an hour
  if (lastSync && (now - parseInt(lastSync)) < SYNC_INTERVAL_MS) {
    return;
  }

  // Check if Firebase is initialized
  try {
    // Import db to check if it's available
    const { db } = await import('../firebaseConfig');
    if (!db) {
      console.log('Firebase not initialized yet, skipping image cache sync');
      return;
    }
  } catch (error) {
    console.log('Firebase config not available, skipping image cache sync');
    return;
  }

  try {
    console.log('Syncing image cache with Firestore...');
    const cacheRef = DatabaseMonitoringService.collection('image_cache');
    const snapshot = await DatabaseMonitoringService.getDocs(DatabaseMonitoringService.query(cacheRef));

    snapshot.forEach(doc => {
      const data = doc.data() as CachedImage;
      memoryCache.set(data.itemName.toLowerCase().trim(), data);
    });

    saveLocalCache();
    localStorage.setItem(LAST_SYNC_KEY, now.toString());
    console.log(`Synced ${snapshot.size} cached images`);
  } catch (error: any) {
    // Handle permission errors gracefully - Firestore sync is optional
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      console.log('Image cache Firestore sync skipped due to permissions (this is normal)');
    } else {
      console.error('Error syncing cache with Firestore:', error);
    }
  }
}

/**
 * Initialize cache system
 */
export async function initializeImageCache(): Promise<void> {
  loadLocalCache();
  // Sync with Firestore in background (don't await)
  syncCacheWithFirestore();
}

/**
 * Gets a cached image URL for an item name, or null if not cached
 * Uses memory cache first, then localStorage, only hits Firestore for misses
 */
export async function getCachedImageUrl(itemName: string): Promise<string | null> {
  const cacheKey = itemName.toLowerCase().trim();

  // Check memory cache first (fastest)
  const memoryCached = memoryCache.get(cacheKey);
  if (memoryCached) {
    return memoryCached.cachedUrl;
  }

  // Check localStorage cache (still fast, no network)
  try {
    const localCache = localStorage.getItem('imageCache');
    if (localCache) {
      const cacheData = JSON.parse(localCache);
      const cached = cacheData.cache[cacheKey];
      if (cached) {
        // Load into memory cache
        memoryCache.set(cacheKey, cached);
        return cached.cachedUrl;
      }
    }
  } catch (error) {
    console.error('Error reading local cache:', error);
  }

  // Only hit Firestore if not in any cache (expensive operation)
  try {
    const cacheRef = DatabaseMonitoringService.doc('image_cache', cacheKey);
    const cacheDoc = await DatabaseMonitoringService.getDoc(cacheRef);

    if (cacheDoc.exists()) {
      const cachedImage = cacheDoc.data() as CachedImage;
      // Store in memory and local cache
      memoryCache.set(cacheKey, cachedImage);
      saveLocalCache();
      return cachedImage.cachedUrl;
    }
  } catch (error) {
    console.error('Error getting cached image from Firestore:', error);
  }

  return null;
}

/**
 * Batch lookup multiple cached images (much more efficient than individual calls)
 */
export async function getCachedImageUrls(itemNames: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const uncachedKeys: string[] = [];

  // Check memory cache first for all items
  itemNames.forEach(name => {
    const cacheKey = name.toLowerCase().trim();
    const memoryCached = memoryCache.get(cacheKey);
    if (memoryCached) {
      results.set(name, memoryCached.cachedUrl);
    } else {
      uncachedKeys.push(cacheKey);
    }
  });

  if (uncachedKeys.length === 0) {
    return results; // All found in memory cache
  }

  // Check localStorage for remaining items
  try {
    const localCache = localStorage.getItem('imageCache');
    if (localCache) {
      const cacheData = JSON.parse(localCache);
      uncachedKeys.forEach(cacheKey => {
        const cached = cacheData.cache[cacheKey];
        if (cached) {
          memoryCache.set(cacheKey, cached);
          results.set(cacheKey, cached.cachedUrl);
        }
      });
      // Remove found items from uncached list
      uncachedKeys.splice(0, uncachedKeys.length, ...uncachedKeys.filter(key => !results.has(key)));
    }
  } catch (error) {
    console.error('Error reading local cache:', error);
  }

  if (uncachedKeys.length === 0) {
    saveLocalCache();
    return results; // All found in local cache
  }

  // Only hit Firestore for remaining items (batch operation)
  try {
    const batchPromises = uncachedKeys.map(async (cacheKey) => {
      const cacheRef = DatabaseMonitoringService.doc('image_cache', cacheKey);
      const cacheDoc = await DatabaseMonitoringService.getDoc(cacheRef);
      return { cacheKey, doc: cacheDoc };
    });

    const batchResults = await Promise.all(batchPromises);

    batchResults.forEach(({ cacheKey, doc }) => {
      if (doc.exists()) {
        const cachedImage = doc.data() as CachedImage;
        memoryCache.set(cacheKey, cachedImage);
        results.set(cacheKey, cachedImage.cachedUrl);
      }
    });

    saveLocalCache();
  } catch (error) {
    console.error('Error batch getting cached images from Firestore:', error);
  }

  return results;
}

/**
 * Caches an image from a URL and returns the cached URL
 */
export async function cacheImageFromUrl(originalUrl: string, itemName: string): Promise<string | null> {
  const cacheKey = itemName.toLowerCase().trim();

  // Check if already cached (without hitting Firestore if possible)
  const existingCache = await getCachedImageUrl(itemName);
  if (existingCache) {
    return existingCache;
  }

  // Download the image
  const imageBlob = await downloadImageAsBlob(originalUrl);
  if (!imageBlob) {
    return null;
  }

  // Upload to Firebase Storage
  const cachedUrl = await uploadImageToStorage(imageBlob, itemName);
  if (!cachedUrl) {
    return null;
  }

  // Cache the mapping in Firestore and local caches
  const cachedImage: CachedImage = {
    originalUrl,
    cachedUrl,
    itemName,
    createdAt: new Date(),
    lastUsed: new Date()
  };

  try {
    const cacheRef = doc(db, 'image_cache', cacheKey);
    await setDoc(cacheRef, cachedImage);

    // Update local caches
    memoryCache.set(cacheKey, cachedImage);
    saveLocalCache();

    return cachedUrl;
  } catch (error) {
    console.error('Error saving to Firestore cache:', error);
    // Still return the cached URL even if Firestore save failed
    // (image is uploaded to Storage, just not cached in DB)
    return cachedUrl;
  }
}

/**
 * Batch cache multiple images (efficient for bulk operations)
 */
export async function cacheImagesFromUrls(imageMap: Map<string, string>): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const toCache: Array<{ itemName: string; originalUrl: string; cacheKey: string }> = [];

  // Check what's already cached first
  const itemNames = Array.from(imageMap.keys());
  const existingCache = await getCachedImageUrls(itemNames);

  // Filter out already cached items
  imageMap.forEach((originalUrl, itemName) => {
    const cacheKey = itemName.toLowerCase().trim();
    if (!existingCache.has(itemName)) {
      toCache.push({ itemName, originalUrl, cacheKey });
    } else {
      results.set(itemName, existingCache.get(itemName)!);
    }
  });

  if (toCache.length === 0) {
    return results; // All already cached
  }

  console.log(`Caching ${toCache.length} new images...`);

  // Process in smaller batches to avoid overwhelming APIs
  const batchSize = 3;
  for (let i = 0; i < toCache.length; i += batchSize) {
    const batch = toCache.slice(i, i + batchSize);

    const batchPromises = batch.map(async ({ itemName, originalUrl, cacheKey }) => {
      try {
        // Download and upload
        const imageBlob = await downloadImageAsBlob(originalUrl);
        if (!imageBlob) return null;

        const cachedUrl = await uploadImageToStorage(imageBlob, itemName);
        if (!cachedUrl) return null;

        return { itemName, cachedUrl, cacheKey };
      } catch (error) {
        console.error(`Error caching image for ${itemName}:`, error);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);

    // Save successful results to Firestore in a batch write
    const validResults = batchResults.filter(result => result !== null) as Array<{ itemName: string; cachedUrl: string; cacheKey: string }>;

    if (validResults.length > 0) {
      try {
        const batch = writeBatch(db);
        const now = new Date();

        validResults.forEach(({ itemName, cachedUrl, cacheKey }) => {
          const cacheRef = doc(db, 'image_cache', cacheKey);
          const cachedImage: CachedImage = {
            originalUrl: imageMap.get(itemName)!,
            cachedUrl,
            itemName,
            createdAt: now,
            lastUsed: now
          };

          batch.set(cacheRef, cachedImage);

          // Update local caches
          memoryCache.set(cacheKey, cachedImage);
          results.set(itemName, cachedUrl);
        });

        await batch.commit();
        console.log(`Successfully cached ${validResults.length} images in this batch`);
      } catch (error) {
        console.error('Error batch saving to Firestore:', error);
        // Still add to results even if Firestore save failed
        validResults.forEach(({ itemName, cachedUrl }) => {
          results.set(itemName, cachedUrl);
        });
      }
    }

    // Small delay between batches to be API-friendly
    if (i + batchSize < toCache.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  saveLocalCache();
  return results;
}

/**
 * Gets a cached image URL or fetches and caches a new one
 */
export async function getOrCacheImageUrl(originalUrl: string, itemName: string): Promise<string | null> {
  // Try to get from cache first
  const cachedUrl = await getCachedImageUrl(itemName);
  if (cachedUrl) {
    return cachedUrl;
  }

  // If not cached, cache it now
  return await cacheImageFromUrl(originalUrl, itemName);
}