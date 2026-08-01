import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../firebaseConfig';
import DatabaseMonitoringService from './databaseMonitoringService';
import { log } from './logService';
import { debounce } from '../utils/debounceUtils';

// Simple cached-image shape used locally by this service
interface CachedImage {
  originalUrl: string;
  cachedUrl: string;
  itemName: string;
  createdAt: Date;
  lastUsed: Date;
}

export interface CachedImageData {
  [cacheKey: string]: CachedImage;
}

// In-memory cache for this session
const memoryCache = new Map<string, CachedImage>();
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_MEMORY_CACHE_SIZE = 300; // Maximum entries in memory to prevent unbounded growth

// The Firestore-side cache used to be a single `image_cache/global` document
// holding every cached image mapping for every household - unbounded growth
// toward Firestore's 1MB per-document hard cap (a write failure app-wide once
// hit). It's now sharded into `image_cache/shard_00` .. `shard_{N-1}`, keyed by
// a cheap string hash of the (lowercased, trimmed) cache key mod
// IMAGE_CACHE_SHARD_COUNT, so no single shard can grow unbounded and firestore.rules
// can validate/bound each shard independently. Matches the `shard_[0-9]+` doc-id
// pattern enforced in firestore.rules' `image_cache/{shardId}` match block.
const IMAGE_CACHE_SHARD_COUNT = 32;
// Soft cap on entries per shard; approached, oldest-lastUsed entries are pruned
// on write. Not perfectly LRU (only pruned on the writes that happen to push a
// shard over the cap), just enough to keep growth bounded. Kept comfortably
// under firestore.rules' hard `keys().size() <= 400` ceiling for the shard doc.
const MAX_ENTRIES_PER_SHARD = 300;

/** Deterministic string hash (djb2-ish) used only to pick a shard - not for security. */
function hashCacheKey(cacheKey: string): number {
  let hash = 0;
  for (let i = 0; i < cacheKey.length; i++) {
    hash = (hash * 31 + cacheKey.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Firestore path for the shard a given (already-normalized) cache key belongs to.
 * Exported so other direct writers into the `image_cache` collection (e.g.
 * services/leftoverImageService.ts) land on the same rules-compliant shard
 * doc-id scheme (firestore.rules only allows `image_cache/shard_[0-9]+` doc ids)
 * instead of inventing their own doc-naming scheme.
 */
export function imageCacheShardPath(cacheKey: string): string {
  const shard = hashCacheKey(cacheKey) % IMAGE_CACHE_SHARD_COUNT;
  return `image_cache/shard_${String(shard).padStart(2, '0')}`;
}

/** Groups cache keys by the shard doc path they belong to. */
function groupKeysByShard(cacheKeys: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const key of cacheKeys) {
    const path = imageCacheShardPath(key);
    const existing = groups.get(path);
    if (existing) {
      existing.push(key);
    } else {
      groups.set(path, [key]);
    }
  }
  return groups;
}

function lastUsedMillis(entry: CachedImage | undefined): number {
  if (!entry) return 0;
  const value = entry.lastUsed as unknown;
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value as any).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Given a shard's current data plus the new entries about to be merged in,
 * returns the keys (if any) that should be evicted to keep the shard under
 * MAX_ENTRIES_PER_SHARD, oldest-lastUsed first.
 */
function computeShardEvictions(existingData: CachedImageData, incomingKeys: string[]): string[] {
  const resultingKeys = new Set([...Object.keys(existingData), ...incomingKeys]);
  const overBy = resultingKeys.size - MAX_ENTRIES_PER_SHARD;
  if (overBy <= 0) return [];

  // Only entries not part of this very write are eviction candidates.
  const incomingSet = new Set(incomingKeys);
  const candidates = Object.entries(existingData)
    .filter(([key]) => !incomingSet.has(key))
    .sort((a, b) => lastUsedMillis(a[1]) - lastUsedMillis(b[1]));

  return candidates.slice(0, overBy).map(([key]) => key);
}

// Negative cache: items confirmed NOT in the Firestore image cache. Without this,
// every lookup for an item with no cached image (the common case for brand-new
// items) re-reads Firestore on every call site that checks it (getCachedImageUrl,
// cacheImageFromUrl), even right after a bulk getCachedImageUrls() pass already
// confirmed the miss - turning a single "add all to pantry" batch into one
// Firestore read per uncached item. Short TTL since a miss can become a hit
// moments later (e.g. this same session about to cache it).
const negativeCache = new Map<string, number>();
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isNegativelyCached(cacheKey: string): boolean {
  const missedAt = negativeCache.get(cacheKey);
  if (missedAt === undefined) return false;
  if (Date.now() - missedAt > NEGATIVE_CACHE_TTL_MS) {
    negativeCache.delete(cacheKey);
    return false;
  }
  return true;
}
const LAST_SYNC_KEY = 'imageCacheLastSync';

/** Evict LRU entries from memoryCache when it exceeds the max size */
function evictLruIfNeeded(): void {
  if (memoryCache.size < MAX_MEMORY_CACHE_SIZE) return;
  // Sort by lastUsed ascending (oldest first)
  const sorted = Array.from(memoryCache.entries()).sort(
    (a, b) => a[1].lastUsed.getTime() - b[1].lastUsed.getTime()
  );
  const toRemove = Math.max(1, Math.floor(MAX_MEMORY_CACHE_SIZE * 0.1));
  for (let i = 0; i < toRemove; i++) {
    memoryCache.delete(sorted[i][0]);
  }
}

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
  } catch (err: any) {
    log.error('Error downloading image', { err });
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
    // Tag with the uploader's uid so storage.rules can enforce that only the
    // original uploader may later delete this image.
    await uploadBytes(storageRef, blob, {
      customMetadata: { uploader: auth.currentUser?.uid || '' }
    });
    const downloadUrl = await getDownloadURL(storageRef);

    return downloadUrl;
  } catch (err: any) {
    log.error('Error uploading image to storage', { err });
    return null;
  }
}

/**
 * Revive Date fields in a cached image that was deserialized from JSON
 */
function reviveCachedImage(data: any): CachedImage {
  return {
    ...data,
    createdAt: data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt),
    lastUsed: data.lastUsed instanceof Date ? data.lastUsed : new Date(data.lastUsed)
  };
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
          memoryCache.set(key, reviveCachedImage(value));
        });
      } else {
        // Clear expired cache
        localStorage.removeItem('imageCache');
      }
    }
  } catch (err: any) {
    log.error('Error loading local cache', { err });
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
  } catch (err: any) {
    log.error('Error saving local cache', { err });
  }
}

// Callers invoke this after every single memoryCache.set(), which during a pantry scan with
// many images resolving in quick succession would otherwise re-stringify up to 300 cache
// entries on every resolve. Debounce collapses a burst into one trailing write.
const debouncedSaveLocalCache = debounce(saveLocalCache, 500);

/**
 * Formerly eagerly pulled the entire `image_cache/global` doc into memory on a
 * ~1hr interval to pre-warm the session cache. Now that Firestore-side storage
 * is sharded (image_cache/shard_00..shard_{N-1}, see IMAGE_CACHE_SHARD_COUNT),
 * there's no single doc to enumerate - doing the equivalent would mean reading
 * all shards up front regardless of which items this session actually needs,
 * which is worse than the per-lookup shard reads getCachedImageUrl(s) already
 * do on demand. Kept as a no-op (just stamps LAST_SYNC_KEY) so
 * initializeImageCache()'s call site doesn't need to change.
 */
async function syncCacheWithFirestore(): Promise<void> {
  localStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
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
    // Check if cache entry is still valid
    const now = new Date();
    const cacheAge = now.getTime() - memoryCached.createdAt.getTime();
    if (cacheAge < CACHE_EXPIRY_MS) {
      // Update last used timestamp
      memoryCached.lastUsed = now;
      return memoryCached.cachedUrl;
    } else {
      // Remove expired entry
      memoryCache.delete(cacheKey);
    }
  }

  // Check localStorage cache (still fast, no network)
  try {
    const localCache = localStorage.getItem('imageCache');
    if (localCache) {
      const cacheData = JSON.parse(localCache);
      const cached = cacheData.cache[cacheKey];
      if (cached) {
        // Load into memory cache, reviving Date fields
        const revivedCache = reviveCachedImage(cached);
        memoryCache.set(cacheKey, revivedCache);
        return revivedCache.cachedUrl;
      }
    }
  } catch (err: any) {
    log.error('Error reading local cache', { err });
  }

  // A prior lookup (this call or a bulk getCachedImageUrls pass) already
  // confirmed Firestore has no entry for this item - don't re-read.
  if (isNegativelyCached(cacheKey)) {
    return null;
  }

  // Only hit Firestore if not in any cache (expensive operation)
  try {
    const cacheRef = DatabaseMonitoringService.doc(imageCacheShardPath(cacheKey));
    const cacheDoc = await DatabaseMonitoringService.getDoc(cacheRef);

    if (cacheDoc.exists()) {
      const data = cacheDoc.data() as CachedImageData;
      const cachedImage = data[cacheKey];
      if (cachedImage) {
        // Store in memory and local cache
        memoryCache.set(cacheKey, cachedImage);
        debouncedSaveLocalCache();
        return cachedImage.cachedUrl;
      }
    }
    negativeCache.set(cacheKey, Date.now());
  } catch (err: any) {
    log.error('Error getting cached image from Firestore', { err });
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
          const revivedCache = reviveCachedImage(cached);
          memoryCache.set(cacheKey, revivedCache);
          results.set(cacheKey, revivedCache.cachedUrl);
        }
      });
      // Remove found items from uncached list
      uncachedKeys.splice(0, uncachedKeys.length, ...uncachedKeys.filter(key => !results.has(key)));
    }
  } catch (err: any) {
    log.error('Error reading local cache', { err });
  }

  if (uncachedKeys.length === 0) {
    debouncedSaveLocalCache();
    return results; // All found in local cache
  }

  // Only hit Firestore for remaining items (batch operation) - group by shard so
  // this is at most IMAGE_CACHE_SHARD_COUNT reads, not one per item.
  try {
    const shardGroups = groupKeysByShard(uncachedKeys);
    const missedAt = Date.now();

    await Promise.all(
      Array.from(shardGroups.entries()).map(async ([shardPath, keysInShard]) => {
        const cacheRef = DatabaseMonitoringService.doc(shardPath);
        const cacheDoc = await DatabaseMonitoringService.getDoc(cacheRef);
        const data = cacheDoc.exists() ? (cacheDoc.data() as CachedImageData) : {};

        keysInShard.forEach(cacheKey => {
          const cachedImage = data[cacheKey];
          if (cachedImage) {
            memoryCache.set(cacheKey, cachedImage);
            results.set(cacheKey, cachedImage.cachedUrl);
          } else {
            // Confirmed miss - stops every per-item caller (getCachedImageUrl,
            // cacheImageFromUrl) from re-reading Firestore for the same item.
            negativeCache.set(cacheKey, missedAt);
          }
        });
      })
    );

    debouncedSaveLocalCache();
  } catch (err: any) {
    log.error('Error batch getting cached images from Firestore', { err });
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
    const cacheRef = DatabaseMonitoringService.doc(imageCacheShardPath(cacheKey));

    // Only read the shard when it's plausibly near the entry cap - not on every
    // single write, to keep this close to the prior no-read-before-write cost for
    // the common case. We can't know the shard's current size without a read, so
    // this is a light heuristic: only bother pruning every so often, keyed off the
    // cache key's hash, rather than reading on literally every cache miss.
    let evictions: string[] = [];
    if (hashCacheKey(cacheKey) % 8 === 0) {
      const existingDoc = await DatabaseMonitoringService.getDoc(cacheRef);
      const existingData = existingDoc.exists() ? (existingDoc.data() as CachedImageData) : {};
      // Cap evictions so this write's total affected-key count (1 new entry +
      // evictions) stays within firestore.rules' image_cache write bound (<=5).
      evictions = computeShardEvictions(existingData, [cacheKey]).slice(0, 4);
    }

    const payload: Record<string, unknown> = { [cacheKey]: cachedImage };
    for (const evictedKey of evictions) {
      payload[evictedKey] = DatabaseMonitoringService.deleteField();
    }

    // merge:true upserts just these fields - creates the doc if missing, merges
    // into it otherwise - instead of the old whole-doc setDoc(), so a concurrent
    // writer caching a different item into the same shard doesn't get clobbered.
    await DatabaseMonitoringService.setDoc(cacheRef, payload, { merge: true });

    // Update local caches
    evictLruIfNeeded();
    memoryCache.set(cacheKey, cachedImage);
    negativeCache.delete(cacheKey);
    for (const evictedKey of evictions) {
      memoryCache.delete(evictedKey);
    }
    debouncedSaveLocalCache();

    return cachedUrl;
  } catch (err: any) {
    log.error('Error saving to Firestore cache', { err });
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

  // Caching new images

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
      } catch (err: any) {
        log.error(`Error caching image for ${itemName}`, { err });
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);

    // Save successful results to Firestore in a batch write
    const validResults = batchResults.filter(result => result !== null) as Array<{ itemName: string; cachedUrl: string; cacheKey: string }>;

    if (validResults.length > 0) {
      try {
        const now = new Date();
        const newImagesByKey = new Map<string, CachedImage>();
        validResults.forEach(({ itemName, cachedUrl, cacheKey }) => {
          newImagesByKey.set(cacheKey, {
            originalUrl: imageMap.get(itemName)!,
            cachedUrl,
            itemName,
            createdAt: now,
            lastUsed: now
          });
        });

        // This batch (size 3) can span multiple shards - write each shard doc
        // separately, field-scoped with merge:true, so a concurrent writer
        // caching a different item into the same shard doesn't get clobbered
        // (the old code setDoc()'d the whole shared doc without merge).
        const shardGroups = groupKeysByShard(Array.from(newImagesByKey.keys()));

        await Promise.all(
          Array.from(shardGroups.entries()).map(async ([shardPath, keysInShard]) => {
            const cacheRef = DatabaseMonitoringService.doc(shardPath);
            const existingDoc = await DatabaseMonitoringService.getDoc(cacheRef);
            const existingData = existingDoc.exists() ? (existingDoc.data() as CachedImageData) : {};

            // Cap evictions so this write's total affected-key count (new
            // entries + evictions) stays within firestore.rules' image_cache
            // write bound (<=5).
            const evictions = computeShardEvictions(existingData, keysInShard)
              .slice(0, Math.max(0, 5 - keysInShard.length));

            const payload: Record<string, unknown> = {};
            keysInShard.forEach(key => {
              payload[key] = newImagesByKey.get(key);
            });
            for (const evictedKey of evictions) {
              payload[evictedKey] = DatabaseMonitoringService.deleteField();
              memoryCache.delete(evictedKey);
            }

            await DatabaseMonitoringService.setDoc(cacheRef, payload, { merge: true });
          })
        );

        validResults.forEach(({ itemName, cachedUrl, cacheKey }) => {
          const cachedImage = newImagesByKey.get(cacheKey)!;
          memoryCache.set(cacheKey, cachedImage);
          results.set(itemName, cachedUrl);
        });
        // Successfully cached images in this batch
      } catch (err: any) {
        log.error('Error batch saving to Firestore', { err });
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

  debouncedSaveLocalCache();
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

/**
 * Cleanup expired cache entries from memory
 */
export function cleanupExpiredImageCache(): void {
  const now = new Date().getTime();
  let cleaned = 0;

  for (const [key, cachedImage] of memoryCache.entries()) {
    const age = now - cachedImage.createdAt.getTime();
    if (age > CACHE_EXPIRY_MS) {
      memoryCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    // Cleaned up expired image cache entries
    debouncedSaveLocalCache(); // Update localStorage
  }
}
