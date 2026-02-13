import DatabaseMonitoringService from './databaseMonitoringService';
import { InventoryCacheService } from './inventoryCacheService';
import { db } from '../firebaseConfig';
import { PantryItem, User } from '../types';
import { fetchExternalItemImage } from '../utils/appUtils';
import { getCachedImageUrls, cacheImagesFromUrls, initializeImageCache } from './imageCacheService';

export interface BulkImageUpdateResult {
  totalItems: number;
  updatedItems: number;
  failedItems: number;
  errors: string[];
}

export class BulkImageUpdateService {
  /**
   * Updates images for all pantry items that currently have placeholder images
   */
  static async updateAllPantryItemImages(user: User, onProgress?: (completed: number, total: number) => void): Promise<BulkImageUpdateResult> {
    const result: BulkImageUpdateResult = {
      totalItems: 0,
      updatedItems: 0,
      failedItems: 0,
      errors: []
    };

    try {
      // Initialize cache system
      await initializeImageCache();

      // Get all pantry items for the user using cached data (1 read instead of N reads)
      const items = await InventoryCacheService.getCachedInventory(undefined, user.id);

      result.totalItems = items.length;

      // Filter items that have placeholder images
      const itemsNeedingImages = items.filter(item =>
        !item.image || item.image.includes('placeholder') || item.image.includes('default')
      );

      console.log(`Found ${itemsNeedingImages.length} items needing image updates out of ${items.length} total items`);

      if (itemsNeedingImages.length === 0) {
        console.log('No items need image updates');
        return result;
      }

      // Check cache for all items in one batch operation (much more efficient!)
      const itemNames = itemsNeedingImages.map(item => item.item);
      const cachedImages = await getCachedImageUrls(itemNames);

      console.log(`Found ${cachedImages.size} items already cached`);

      // Separate cached vs uncached items
      const uncachedItems = itemsNeedingImages.filter(item => !cachedImages.has(item.item));

      // Fetch images for uncached items
      console.log(`Fetching images for ${uncachedItems.length} uncached items...`);
      const fetchedImages = new Map<string, string>();

      // Process in smaller batches to avoid overwhelming external APIs
      const fetchBatchSize = 3;
      for (let i = 0; i < uncachedItems.length; i += fetchBatchSize) {
        const fetchBatch = uncachedItems.slice(i, i + fetchBatchSize);

        const fetchPromises = fetchBatch.map(async (item) => {
          try {
            const newImage = await fetchExternalItemImage(item.item);
            if (newImage) {
              fetchedImages.set(item.item, newImage);
            }
          } catch (error) {
            console.error(`Failed to fetch image for ${item.item}:`, error);
          }
        });

        await Promise.all(fetchPromises);

        // Small delay between batches to be API-friendly
        if (i + fetchBatchSize < uncachedItems.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log(`Fetched ${fetchedImages.size} new images`);

      // Cache all new images in one batch operation
      let newlyCachedImages = new Map<string, string>();
      if (fetchedImages.size > 0) {
        newlyCachedImages = await cacheImagesFromUrls(fetchedImages);
        console.log(`Successfully cached ${newlyCachedImages.size} images`);
      }

      // Combine cached and newly cached images
      const allImageUrls = new Map([...cachedImages, ...newlyCachedImages]);

      // Update all items with their final image URLs
      console.log('Updating pantry items with new images...');
      const updatePromises = itemsNeedingImages.map(async (item) => {
        try {
          const finalImageUrl = allImageUrls.get(item.item);
          if (finalImageUrl && finalImageUrl !== item.image) {
            const itemRef = doc(db, 'users', user.id, 'inventory', item.id);
            await updateDoc(itemRef, {
              image: finalImageUrl,
              imageUpdatedAt: new Date().toISOString(),
              imageCached: true // All images in allImageUrls are now cached
            });

            result.updatedItems++;
            console.log(`✅ Updated image for: ${item.item}`);
          }
        } catch (error) {
          result.failedItems++;
          result.errors.push(`Failed to update item ${item.item}: ${error}`);
          console.error(`Failed to update ${item.item}:`, error);
        }
      });

      // Update in batches to avoid overwhelming Firestore
      const updateBatchSize = 10;
      for (let i = 0; i < updatePromises.length; i += updateBatchSize) {
        const updateBatch = updatePromises.slice(i, i + updateBatchSize);
        await Promise.all(updateBatch);

        const completed = Math.min(i + updateBatchSize, itemsNeedingImages.length);
        onProgress?.(completed, itemsNeedingImages.length);
      }

      console.log(`Bulk image update complete: ${result.updatedItems} updated, ${result.failedItems} failed`);

    } catch (error) {
      result.errors.push(`Bulk update failed: ${error}`);
      console.error('Bulk image update failed:', error);
    }

    return result;
  }

  /**
   * Updates images for pantry items in a specific household
   */
  static async updateHouseholdPantryItemImages(householdId: string, onProgress?: (completed: number, total: number) => void): Promise<BulkImageUpdateResult> {
    const result: BulkImageUpdateResult = {
      totalItems: 0,
      updatedItems: 0,
      failedItems: 0,
      errors: []
    };

    try {
      // Initialize cache system
      await initializeImageCache();

      // Get all pantry items for the household using cached data (1 read instead of N reads)
      const items = await InventoryCacheService.getCachedInventory(householdId);

      result.totalItems = items.length;

      // Filter items that have placeholder images
      const itemsNeedingImages = items.filter(item =>
        !item.image || item.image.includes('placeholder') || item.image.includes('default')
      );

      console.log(`Found ${itemsNeedingImages.length} household items needing image updates out of ${items.length} total items`);

      if (itemsNeedingImages.length === 0) {
        console.log('No household items need image updates');
        return result;
      }

      // Check cache for all items in one batch operation
      const itemNames = itemsNeedingImages.map(item => item.item);
      const cachedImages = await getCachedImageUrls(itemNames);

      console.log(`Found ${cachedImages.size} household items already cached`);

      // Separate cached vs uncached items
      const uncachedItems = itemsNeedingImages.filter(item => !cachedImages.has(item.item));

      // Fetch images for uncached items
      console.log(`Fetching images for ${uncachedItems.length} uncached household items...`);
      const fetchedImages = new Map<string, string>();

      const fetchBatchSize = 3;
      for (let i = 0; i < uncachedItems.length; i += fetchBatchSize) {
        const fetchBatch = uncachedItems.slice(i, i + fetchBatchSize);

        const fetchPromises = fetchBatch.map(async (item) => {
          try {
            const newImage = await fetchExternalItemImage(item.item);
            if (newImage) {
              fetchedImages.set(item.item, newImage);
            }
          } catch (error) {
            console.error(`Failed to fetch image for household item ${item.item}:`, error);
          }
        });

        await Promise.all(fetchPromises);

        if (i + fetchBatchSize < uncachedItems.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log(`Fetched ${fetchedImages.size} new household images`);

      // Cache all new images in one batch operation
      let newlyCachedImages = new Map<string, string>();
      if (fetchedImages.size > 0) {
        newlyCachedImages = await cacheImagesFromUrls(fetchedImages);
        console.log(`Successfully cached ${newlyCachedImages.size} household images`);
      }

      // Combine cached and newly cached images
      const allImageUrls = new Map([...cachedImages, ...newlyCachedImages]);

      // Update all household items with their final image URLs
      console.log('Updating household pantry items with new images...');
      const updatePromises = itemsNeedingImages.map(async (item) => {
        try {
          const finalImageUrl = allImageUrls.get(item.item);
          if (finalImageUrl && finalImageUrl !== item.image) {
            const itemRef = doc(db, 'households', householdId, 'inventory', item.id);
            await updateDoc(itemRef, {
              image: finalImageUrl,
              imageUpdatedAt: new Date().toISOString(),
              imageCached: true
            });

            result.updatedItems++;
            console.log(`✅ Updated household image for: ${item.item}`);
          }
        } catch (error) {
          result.failedItems++;
          result.errors.push(`Failed to update household item ${item.item}: ${error}`);
          console.error(`Failed to update household item ${item.item}:`, error);
        }
      });

      // Update in batches to avoid overwhelming Firestore
      const updateBatchSize = 10;
      for (let i = 0; i < updatePromises.length; i += updateBatchSize) {
        const updateBatch = updatePromises.slice(i, i + updateBatchSize);
        await Promise.all(updateBatch);

        const completed = Math.min(i + updateBatchSize, itemsNeedingImages.length);
        onProgress?.(completed, itemsNeedingImages.length);
      }

      console.log(`Household bulk image update complete: ${result.updatedItems} updated, ${result.failedItems} failed`);

    } catch (error) {
      result.errors.push(`Household bulk update failed: ${error}`);
      console.error('Household bulk image update failed:', error);
    }

    return result;
  }
}