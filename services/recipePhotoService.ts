import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll
} from 'firebase/storage';
import { storage } from '../firebaseConfig';
import { RecipePhoto } from '../types';
import { log } from './logService';

export class RecipePhotoService {
  private static readonly PHOTOS_FOLDER = 'recipe-photos';

  /**
   * Upload a recipe photo
   */
  static async uploadRecipePhoto(
    file: File,
    recipeTitle: string,
    userId: string,
    ratingId: string
  ): Promise<RecipePhoto> {
    try {
      // Create a unique filename
      const timestamp = Date.now();
      const fileName = `${recipeTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${userId}_${timestamp}.${file.name.split('.').pop()}`;
      const storageRef = ref(storage, `${this.PHOTOS_FOLDER}/${fileName}`);

      // Upload the file
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const photo: RecipePhoto = {
        id: `${ratingId}_${timestamp}`,
        url: downloadURL,
        fileName,
        uploadedAt: new Date().toISOString(),
        userId,
        ratingId,
        recipeTitle
      };

      log.info('Recipe photo uploaded', { recipeTitle, userId, fileName });
      return photo;
    } catch (error) {
      log.error('Failed to upload recipe photo', { error, recipeTitle, userId });
      throw error;
    }
  }

  /**
   * Delete a recipe photo
   */
  static async deleteRecipePhoto(photo: RecipePhoto): Promise<void> {
    try {
      const storageRef = ref(storage, `${this.PHOTOS_FOLDER}/${photo.fileName}`);
      await deleteObject(storageRef);

      log.info('Recipe photo deleted', { photoId: photo.id });
    } catch (error) {
      log.error('Failed to delete recipe photo', { error, photoId: photo.id });
      throw error;
    }
  }

  /**
   * Get all photos for a recipe
   */
  static async getRecipePhotos(recipeTitle: string): Promise<RecipePhoto[]> {
    try {
      const photosRef = ref(storage, this.PHOTOS_FOLDER);
      const result = await listAll(photosRef);

      const photos: RecipePhoto[] = [];

      // Filter items that match the recipe title pattern
      const recipePrefix = recipeTitle.replace(/[^a-zA-Z0-9]/g, '_');
      const matchingItems = result.items.filter(item =>
        item.name.startsWith(recipePrefix)
      );

      // Get metadata for each photo (this is a simplified approach)
      // In a real implementation, you'd store photo metadata in Firestore
      for (const item of matchingItems) {
        try {
          const url = await getDownloadURL(item);
          photos.push({
            id: item.name,
            url,
            fileName: item.name,
            uploadedAt: new Date().toISOString(), // This would come from Firestore in real implementation
            userId: '', // Would come from Firestore
            ratingId: '', // Would come from Firestore
            recipeTitle
          });
        } catch (error) {
          log.warn('Failed to get download URL for photo', { fileName: item.name });
        }
      }

      return photos;
    } catch (error) {
      log.error('Failed to get recipe photos', { error, recipeTitle });
      return [];
    }
  }

  /**
   * Validate file before upload
   */
  static validatePhotoFile(file: File): { valid: boolean; error?: string } {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Only JPEG, PNG, and WebP images are allowed'
      };
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'Image must be smaller than 10MB'
      };
    }

    return { valid: true };
  }

  /**
   * Compress image if needed (client-side compression)
   */
  static async compressImage(file: File, maxWidth: number = 1200, quality: number = 0.8): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback to original
          }
        }, file.type, quality);
      };

      img.src = URL.createObjectURL(file);
    });
  }
}