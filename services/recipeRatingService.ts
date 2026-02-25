import { increment, arrayUnion, Timestamp } from 'firebase/firestore';
import DatabaseMonitoringService from './databaseMonitoringService';
import {
  RecipeRating,
  RecipeCommunityStats,
  RecipeModification,
  StructuredRecipe,
  RecipeFeedback
} from '../types';
import { log } from './logService';
import { upsertCommunityRatedRecipeByTitle } from './recipeService';

// Recursively remove undefined properties (preserve Timestamp and other non-plain values)
const sanitizeForFirestore = (obj: any): any => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => sanitizeForFirestore(item)).filter(i => i !== undefined);
  // Keep Firebase Timestamps and special types as-is (they usually have toDate or _seconds/_nanoseconds)
  if (obj.constructor && obj.constructor.name && ['Timestamp'].includes(obj.constructor.name)) return obj;

  const out: any = {};
  for (const key of Object.keys(obj)) {
    const v = sanitizeForFirestore(obj[key]);
    if (v !== undefined) out[key] = v;
  }
  return out;
};

export class RecipeRatingService {
  private static readonly RATINGS_COLLECTION = 'recipeRatings';
  private static readonly COMMUNITY_STATS_COLLECTION = 'recipeCommunityStats';
  private static readonly MODIFICATIONS_COLLECTION = 'recipeModifications';

  /**
   * Submit or update a recipe rating
   */
  static async submitRating(rating: RecipeRating, userId: string, householdId?: string): Promise<void> {
    try {
      const ratingRef = DatabaseMonitoringService.doc(this.RATINGS_COLLECTION, rating.id);
      const ratingData = {
        ...rating,
        userId,
        householdId,
        date: Timestamp.fromDate(new Date(rating.date)),
        updatedAt: Timestamp.now()
      };

      // Remove any undefined fields (Firestore rejects undefined)
      const cleanRatingData = sanitizeForFirestore(ratingData);
      await DatabaseMonitoringService.setDoc(ratingRef, cleanRatingData);

      // Update community stats
      await this.updateCommunityStats(rating.recipeTitle, householdId);

      // Update single-doc community-rated cache so UI can read one document
      try {
        await upsertCommunityRatedRecipeByTitle(rating.recipeTitle);
      } catch (e) {
        // swallow cache errors - rating write must not fail because cache update failed
        log.warn('Failed to update community-rated cache after rating', { error: e, recipeTitle: rating.recipeTitle });
      }

      log.info('Recipe rating submitted', { recipeTitle: rating.recipeTitle, userId });
    } catch (err: any) {
      log.error('Failed to submit recipe rating', { err, recipeTitle: rating.recipeTitle });
      throw err;
    }
  }

  /**
   * Get community stats for a recipe
   */
  static async getCommunityStats(recipeTitle: string, householdId?: string): Promise<RecipeCommunityStats> {
    try {
      const statsRef = DatabaseMonitoringService.doc(this.COMMUNITY_STATS_COLLECTION, recipeTitle);
      const statsDoc = await DatabaseMonitoringService.getDoc(statsRef);

      if (statsDoc.exists()) {
        const data = statsDoc.data() as any;
        let householdStats = undefined;

        if (householdId) {
          // Get household-specific stats
          const householdRatingsQuery = DatabaseMonitoringService.query(
            DatabaseMonitoringService.collection(this.RATINGS_COLLECTION),
            DatabaseMonitoringService.where('recipeTitle', '==', recipeTitle),
            DatabaseMonitoringService.where('householdId', '==', householdId)
          );
          const householdRatings = await DatabaseMonitoringService.getDocs(householdRatingsQuery);

            if (!householdRatings.empty) {
            const ratings = householdRatings.docs.map((doc: any) => doc.data() as any);
            const wouldMakeAgainCount = ratings.filter((r: any) => r.wouldMakeAgain).length;

            householdStats = {
              householdRatings: ratings.length,
              householdAverageRating: ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / ratings.length,
              householdWouldMakeAgain: (wouldMakeAgainCount / ratings.length) * 100
            };
          }
        }

        return {
          ...data,
          householdStats
        } as RecipeCommunityStats;
      }

      // Return default stats if none exist
      return {
        totalRatings: 0,
        averageRating: 0,
        wouldMakeAgainPercentage: 0,
        topFeedback: [],
        topModifications: [],
        householdStats: householdId ? {
          householdRatings: 0,
          householdAverageRating: 0,
          householdWouldMakeAgain: 0
        } : undefined
      };
    } catch (err: any) {
      log.error('Failed to get community stats', { err, recipeTitle });
      throw err;
    }
  }

  /**
   * Update community statistics after a rating is submitted
   */
  private static async updateCommunityStats(recipeTitle: string, householdId?: string): Promise<void> {
    try {
      const ratingsQuery = DatabaseMonitoringService.query(
        DatabaseMonitoringService.collection(this.RATINGS_COLLECTION),
        DatabaseMonitoringService.where('recipeTitle', '==', recipeTitle)
      );
      const ratingsSnapshot = await DatabaseMonitoringService.getDocs(ratingsQuery);
      const ratings = ratingsSnapshot.docs.map((doc: any) => doc.data() as any);

      if (ratings.length === 0) return;

      // Calculate stats
      const totalRatings = ratings.length;
      const averageRating = ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / totalRatings;
      const wouldMakeAgainCount = ratings.filter((r: any) => r.wouldMakeAgain).length;
      const wouldMakeAgainPercentage = (wouldMakeAgainCount / totalRatings) * 100;

      // Calculate top feedback
      const feedbackCount: Record<string, number> = {};
      ratings.forEach((rating: any) => {
        if (rating.feedback) {
          rating.feedback.forEach((fb: RecipeFeedback) => {
            feedbackCount[fb.type] = (feedbackCount[fb.type] || 0) + 1;
          });
        }
      });

      const topFeedback = Object.entries(feedbackCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([type]) => ({ type: type as RecipeFeedback['type'] }));

      // Update stats document
      const statsRef = DatabaseMonitoringService.doc(this.COMMUNITY_STATS_COLLECTION, recipeTitle);
      await DatabaseMonitoringService.setDoc(statsRef, {
        totalRatings,
        averageRating,
        wouldMakeAgainPercentage,
        topFeedback,
        lastUpdated: Timestamp.now()
      });

    } catch (err: any) {
      log.error('Failed to update community stats', { err, recipeTitle });
    }
  }

  /**
   * Add a recipe modification suggestion
   */
  static async addModification(
    recipeTitle: string,
    modification: Omit<RecipeModification, 'id' | 'helpful'>,
    userId: string
  ): Promise<void> {
    try {
      const modId = `${recipeTitle}_${userId}_${Date.now()}`;
      const modRef = DatabaseMonitoringService.doc(this.MODIFICATIONS_COLLECTION, modId);

      await DatabaseMonitoringService.setDoc(modRef, {
        ...modification,
        id: modId,
        recipeTitle,
        userId,
        helpful: 0,
        date: Timestamp.fromDate(new Date(modification.date))
      });

      log.info('Recipe modification added', { recipeTitle, userId });
    } catch (err: any) {
      log.error('Failed to add recipe modification', { err, recipeTitle });
      throw err;
    }
  }

  /**
   * Mark a modification as helpful
   */
  static async markModificationHelpful(modificationId: string, userId: string): Promise<void> {
    try {
      const modRef = DatabaseMonitoringService.doc(this.MODIFICATIONS_COLLECTION, modificationId);
      await DatabaseMonitoringService.updateDoc(modRef, {
        helpful: increment(1),
        helpfulBy: arrayUnion(userId)
      });

      log.info('Modification marked as helpful', { modificationId, userId });
    } catch (err: any) {
      log.error('Failed to mark modification as helpful', { err, modificationId });
      throw err;
    }
  }

  /**
   * Get top modifications for a recipe
   */
  static async getTopModifications(recipeTitle: string, limitCount: number = 10): Promise<RecipeModification[]> {
    try {
      const modsQuery = DatabaseMonitoringService.query(
        DatabaseMonitoringService.collection(this.MODIFICATIONS_COLLECTION),
        DatabaseMonitoringService.where('recipeTitle', '==', recipeTitle),
        DatabaseMonitoringService.orderBy('helpful', 'desc'),
        DatabaseMonitoringService.orderBy('date', 'desc'),
        DatabaseMonitoringService.limit(limitCount)
      );

      const modsSnapshot = await DatabaseMonitoringService.getDocs(modsQuery);
      return modsSnapshot.docs.map((doc: any) => {
        const d = doc.data() as any;
        return {
          ...d,
          date: normalizeDate(d.date)
        } as RecipeModification;
      });
    } catch (err: any) {
      log.error('Failed to get top modifications', { err, recipeTitle });
      return [];
    }
  }

  /**
   * Get user's rating for a recipe
   */
  static async getUserRating(recipeTitle: string, userId: string): Promise<RecipeRating | null> {
    try {
      const ratingQuery = DatabaseMonitoringService.query(
        DatabaseMonitoringService.collection(this.RATINGS_COLLECTION),
        DatabaseMonitoringService.where('recipeTitle', '==', recipeTitle),
        DatabaseMonitoringService.where('userId', '==', userId),
        DatabaseMonitoringService.limit(1)
      );

      const ratingSnapshot = await DatabaseMonitoringService.getDocs(ratingQuery);
      if (!ratingSnapshot.empty) {
        const data = ratingSnapshot.docs[0].data() as any;
        return {
          ...data,
          date: normalizeDate(data.date)
        } as RecipeRating;
      }
      return null;
    } catch (err: any) {
      log.error('Failed to get user rating', { err, recipeTitle, userId });
      return null;
    }
  }

  /**
   * Get household ratings for a recipe
   */
  static async getHouseholdRatings(recipeTitle: string, householdId: string): Promise<RecipeRating[]> {
    try {
      const ratingsQuery = DatabaseMonitoringService.query(
        DatabaseMonitoringService.collection(this.RATINGS_COLLECTION),
        DatabaseMonitoringService.where('recipeTitle', '==', recipeTitle),
        DatabaseMonitoringService.where('householdId', '==', householdId),
        DatabaseMonitoringService.orderBy('date', 'desc'),
        DatabaseMonitoringService.limit(10)
      );

      const ratingsSnapshot = await DatabaseMonitoringService.getDocs(ratingsQuery);
      return ratingsSnapshot.docs.map((doc: any) => {
        const data = doc.data() as any;
        return {
          ...data,
          date: normalizeDate(data.date)
        } as RecipeRating;
      });
    } catch (err: any) {
      log.error('Failed to get household ratings', { err, recipeTitle, householdId });
      return [];
    }
  }

  /**
   * Generate personalized recommendations based on user and household data
   */
  static async getPersonalizedRecommendations(
    userId: string,
    householdId?: string,
    pantryItems: string[] = [],
    limitCount: number = 5
  ): Promise<any[]> { // TODO: Define proper recommendation type
    try {
      // Get user's rating history
      const userRatingsQuery = DatabaseMonitoringService.query(
        DatabaseMonitoringService.collection(this.RATINGS_COLLECTION),
        DatabaseMonitoringService.where('userId', '==', userId),
        DatabaseMonitoringService.orderBy('date', 'desc'),
        DatabaseMonitoringService.limit(20)
      );
      const userRatings = await DatabaseMonitoringService.getDocs(userRatingsQuery);
      const userRatingData = userRatings.docs.map((doc: any) => doc.data());

      // Get household preferences
      let householdRatings: any[] = [];
      if (householdId) {
        const householdQuery = DatabaseMonitoringService.query(
          DatabaseMonitoringService.collection(this.RATINGS_COLLECTION),
          DatabaseMonitoringService.where('householdId', '==', householdId),
          DatabaseMonitoringService.orderBy('date', 'desc'),
          DatabaseMonitoringService.limit(50)
        );
        const householdSnapshot = await DatabaseMonitoringService.getDocs(householdQuery);
        householdRatings = householdSnapshot.docs.map((doc: any) => doc.data());
      }

      // Simple recommendation logic (can be enhanced with ML)
      const recommendations: any[] = [];

      // Household-loved recipes that user hasn't rated
      if (householdRatings.length > 0) {
        const householdLoved = householdRatings
          .filter((r: any) => r.wouldMakeAgain)
            .filter((r: any) => !userRatingData.some((ur: any) => ur.recipeTitle === r.recipeTitle))
            .reduce((acc: Record<string, number>, rating: any) => {
              const title = rating.recipeTitle || 'unknown';
              acc[title] = (acc[title] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);

        Object.entries(householdLoved)
              .sort(([,a]: any, [,b]: any) => (b as number) - (a as number))
              .slice(0, 2)
              .forEach(([recipeTitle, count]: [string, number]) => {
                const c = Number(count || 0);
                recommendations.push({
                  recipe: { title: recipeTitle }, // TODO: Get full recipe data
                  reason: `${c} household members loved this`,
                  confidence: Math.min(0.9, c / 5),
                  type: 'household-loved'
                });
              });
      }

      // Recipes with similar ingredients to pantry
      // TODO: Implement ingredient matching logic

      return recommendations.slice(0, limitCount);
    } catch (err: any) {
      log.error('Failed to get personalized recommendations', { err, userId });
      return [];
    }
  }
}

// Helper to normalize Firestore date fields that may be Timestamp, string, or plain object
const normalizeDate = (dateField: any): string | null => {
  if (!dateField) return null;
  // Firestore Timestamp
  if (typeof dateField.toDate === 'function') {
    try { return dateField.toDate().toISOString(); } catch { /* fallthrough */ }
  }
  // Legacy proto-like object with seconds
  if (typeof dateField.seconds === 'number') {
    return new Date(dateField.seconds * 1000).toISOString();
  }
  if (typeof dateField._seconds === 'number') {
    return new Date(dateField._seconds * 1000).toISOString();
  }
  // Already a string
  if (typeof dateField === 'string') return dateField;
  return null;
};
