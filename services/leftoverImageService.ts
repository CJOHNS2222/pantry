import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, auth } from '../firebaseConfig';
import DatabaseMonitoringService from './databaseMonitoringService';
import { log } from './logService';
import { imageCacheShardPath } from './imageCacheService';

/**
 * Upload a File or Blob to Firebase Storage under pantry_images/leftovers and return its download URL.
 * Optionally cache the uploaded image in the shared image cache, keyed by itemName.
 *
 * All three cache scopes below write into the SAME sharded `image_cache/shard_NN`
 * doc scheme as services/imageCacheService.ts (imageCacheShardPath) rather than
 * their own `image_cache/global` / `image_cache/households_{id}` /
 * `image_cache/user_{id}` doc ids - firestore.rules now only allows
 * `image_cache/shard_[0-9]+` doc ids (see F12), and the old per-scope doc ids
 * would otherwise be rejected outright. The household/user/global "scope" is
 * preserved as metadata on the cached entry itself, not as a separate document.
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
    // Tag with the uploader's uid so storage.rules can enforce that only the
    // original uploader may later delete this image.
    await uploadBytes(storageRef, file as any, {
      customMetadata: { uploader: userId || auth.currentUser?.uid || '' }
    });
    const downloadUrl = await getDownloadURL(storageRef);

    if (cacheScope !== 'none' && itemName) {
      const cacheKey = itemName.toLowerCase().trim();
      try {
        if (cacheScope === 'user' && !userId) {
          log.warn('userId required for user-scoped image cache; skipping cache write', {}, 'LeftoverImageService');
        } else {
          const entry: Record<string, unknown> = {
            originalUrl: downloadUrl,
            cachedUrl: downloadUrl,
            itemName,
            createdAt: new Date(),
            lastUsed: new Date(),
          };
          if (cacheScope === 'household') entry.householdId = householdId;
          if (cacheScope === 'user') entry.userId = userId;

          // Field-scoped merge write into the shared shard doc - creates it if
          // missing, never clobbers concurrent writers caching a different item
          // into the same shard (the old code read-modified-wrote the whole doc).
          const cacheRef = DatabaseMonitoringService.doc(imageCacheShardPath(cacheKey));
          await DatabaseMonitoringService.setDoc(cacheRef, { [cacheKey]: entry }, { merge: true });
        }
      } catch (err: any) {
        // Non-fatal: caching is optional
        log.warn('Failed to write to image cache:', { err: err?.message || err }, 'LeftoverImageService');
      }
    }

    return downloadUrl;
  } catch (err: any) {
    log.error('Failed to upload leftover image:', { err }, 'LeftoverImageService');
    throw err;
  }
}

// Backwards-compatible alias
export const uploadLeftoverImage = uploadItemImage;
