import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';
import DatabaseMonitoringService from './databaseMonitoringService';

/**
 * Upload a File or Blob to Firebase Storage under pantry_images/leftovers and return its download URL.
 * Optionally cache the uploaded image in the shared image cache under `image_cache/global` using itemName as key.
 */
export async function uploadItemImage(
  file: File | Blob,
  householdId: string,
  itemName?: string,
  cacheScope: 'none' | 'household' | 'user' | 'global' = 'none',
  userId?: string
): Promise<string> {
  try {
    const timestamp = Date.now();
    const filename = `pantry_images/leftovers/${householdId}_${timestamp}.jpg`;
    const storageRef = ref(storage, filename);
    await uploadBytes(storageRef, file as any);
    const downloadUrl = await getDownloadURL(storageRef);

    if (cacheScope !== 'none' && itemName) {
      const cacheKey = itemName.toLowerCase().trim();
      try {
        if (cacheScope === 'global') {
          const cacheRef = DatabaseMonitoringService.doc('image_cache/global');
          const snap = await DatabaseMonitoringService.getDoc(cacheRef);
          const data = snap && snap.exists() ? (snap.data() as any) : {};
          data[cacheKey] = {
            originalUrl: downloadUrl,
            cachedUrl: downloadUrl,
            itemName,
            createdAt: new Date(),
            lastUsed: new Date(),
          };
          await DatabaseMonitoringService.setDoc(cacheRef, data);
        } else if (cacheScope === 'household') {
          // Store household-specific cache entry under a single image_cache document
          // keyed by household to produce an even-numbered document path.
          const cacheRef = DatabaseMonitoringService.doc('image_cache', `households_${householdId}`);
          const snap = await DatabaseMonitoringService.getDoc(cacheRef);
          const data = snap && snap.exists() ? (snap.data() as any) : {};
          data[cacheKey] = {
            originalUrl: downloadUrl,
            cachedUrl: downloadUrl,
            itemName,
            householdId,
            createdAt: new Date(),
            lastUsed: new Date(),
          };
          await DatabaseMonitoringService.setDoc(cacheRef, data);
        } else if (cacheScope === 'user') {
          if (!userId) {
            console.warn('userId required for user-scoped image cache; skipping cache write');
          } else {
            // Use a single image_cache document keyed by user to ensure an even-numbered
            // document reference (collection + doc).
            const cacheRef = DatabaseMonitoringService.doc('image_cache', `user_${userId}`);
            const snap = await DatabaseMonitoringService.getDoc(cacheRef);
            const data = snap && snap.exists() ? (snap.data() as any) : {};
            data[cacheKey] = {
              originalUrl: downloadUrl,
              cachedUrl: downloadUrl,
              itemName,
              userId,
              createdAt: new Date(),
              lastUsed: new Date(),
            };
            await DatabaseMonitoringService.setDoc(cacheRef, data);
          }
        }
      } catch (err: any) {
        // Non-fatal: caching is optional
        console.warn('Failed to write to image cache:', err?.message || err);
      }
    }

    return downloadUrl;
  } catch (err: any) {
    console.error('Failed to upload leftover image:', err);
    throw err;
  }
}

// Backwards-compatible alias
export const uploadLeftoverImage = uploadItemImage;
