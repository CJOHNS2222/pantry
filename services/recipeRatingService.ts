import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  increment,
  arrayUnion,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import {
  RecipeRating,
  RecipeCommunityStats,
  RecipeModification,
  StructuredRecipe,
  RecipeFeedback
} from '../types';
import { log } from './logService';

export class RecipeRatingService {
  private static readonly RATINGS_COLLECTION = 'recipeRatings';
  private static readonly COMMUNITY_STATS_COLLECTION = 'recipeCommunityStats';
  private static readonly MODIFICATIONS_COLLECTION = 'recipeModifications';

  /**
   * Submit or update a recipe rating
   */
  static async submitRating(rating: RecipeRating, userId: string, householdId?: string): Promise<void> {
    try {
      const ratingRef = doc(db, this.RATINGS_COLLECTION, rating.id);
      const ratingData = {
        ...rating,
        userId,
        householdId,
        date: Timestamp.fromDate(new Date(rating.date)),
        updatedAt: Timestamp.now()
      };

      await setDoc(ratingRef, ratingData, { merge: true });

      // Update community stats
      await this.updateCommunityStats(rating.recipeTitle, householdId);

      log.info('Recipe rating submitted', { recipeTitle: rating.recipeTitle, userId });
    } catch (err: any) {
      log.error('Failed to submit recipe rating', { error, recipeTitle: rating.recipeTitle });
      throw error;
    }
  }

  /**
   * Get community stats for a recipe
   */
  static async getCommunityStats(recipeTitle: string, householdId?: string): Promise<RecipeCommunityStats> {
    try {
      const statsRef = doc(db, this.COMMUNITY_STATS_COLLECTION, recipeTitle);
      const statsDoc = await getDoc(statsRef);

      if (statsDoc.exists()) {
        const data = statsDoc.data();
        let householdStats = undefined;

        if (householdId) {
          // Get household-specific stats
          const householdRatingsQuery = query(
            collection(db, this.RATINGS_COLLECTION),
            where('recipeTitle', '==', recipeTitle),
            where('householdId', '==', householdId)
          );
          const householdRatings = await getDocs(householdRatingsQuery);

          if (!householdRatings.empty) {
            const ratings = householdRatings.docs.map(doc => doc.data());
            const wouldMakeAgainCount = ratings.filter(r => r.wouldMakeAgain).length;

            householdStats = {
              householdRatings: ratings.length,
              householdAverageRating: ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length,
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
      log.error('Failed to get community stats', { error, recipeTitle });
      throw error;
    }
  }

  /**
   * Update community statistics after a rating is submitted
   */
  private static async updateCommunityStats(recipeTitle: string, householdId?: string): Promise<void> {
    try {
      const ratingsQuery = query(
        collection(db, this.RATINGS_COLLECTION),
        where('recipeTitle', '==', recipeTitle)
      );
      const ratingsSnapshot = await getDocs(ratingsQuery);
      const ratings = ratingsSnapshot.docs.map(doc => doc.data());

      if (ratings.length === 0) return;

      // Calculate stats
      const totalRatings = ratings.length;
      const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings;
      const wouldMakeAgainCount = ratings.filter(r => r.wouldMakeAgain).length;
      const wouldMakeAgainPercentage = (wouldMakeAgainCount / totalRatings) * 100;

      // Calculate top feedback
      const feedbackCount: Record<string, number> = {};
      ratings.forEach(rating => {
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
      const statsRef = doc(db, this.COMMUNITY_STATS_COLLECTION, recipeTitle);
      await setDoc(statsRef, {
        totalRatings,
        averageRating,
        wouldMakeAgainPercentage,
        topFeedback,
        lastUpdated: Timestamp.now()
      }, { merge: true });

    } catch (err: any) {
      log.error('Failed to update community stats', { error, recipeTitle });
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
      const modRef = doc(db, this.MODIFICATIONS_COLLECTION, modId);

      await setDoc(modRef, {
        ...modification,
        id: modId,
        recipeTitle,
        userId,
        helpful: 0,
        date: Timestamp.fromDate(new Date(modification.date))
      });

      log.info('Recipe modification added', { recipeTitle, userId });
    } catch (err: any) {
      log.error('Failed to add recipe modification', { error, recipeTitle });
      throw error;
    }
  }

  /**
   * Mark a modification as helpful
   */
  static async markModificationHelpful(modificationId: string, userId: string): Promise<void> {
    try {
      const modRef = doc(db, this.MODIFICATIONS_COLLECTION, modificationId);
      await updateDoc(modRef, {
        helpful: increment(1),
        helpfulBy: arrayUnion(userId)
      });

      log.info('Modification marked as helpful', { modificationId, userId });
    } catch (err: any) {
      log.error('Failed to mark modification as helpful', { error, modificationId });
      throw error;
    }
  }

  /**
   * Get top modifications for a recipe
   */
  static async getTopModifications(recipeTitle: string, limitCount: number = 10): Promise<RecipeModification[]> {
    try {
      const modsQuery = query(
        collection(db, this.MODIFICATIONS_COLLECTION),
        where('recipeTitle', '==', recipeTitle),
        orderBy('helpful', 'desc'),
        orderBy('date', 'desc'),
        limit(limitCount)
      );

      const modsSnapshot = await getDocs(modsQuery);
      return modsSnapshot.docs.map(doc => ({
        ...doc.data(),
        date: doc.data().date.toDate().toISOString()
      })) as RecipeModification[];
    } catch (err: any) {
      log.error('Failed to get top modifications', { error, recipeTitle });
      return [];
    }
  }

  /**
   * Get user's rating for a recipe
   */
  static async getUserRating(recipeTitle: string, userId: string): Promise<RecipeRating | null> {
    try {
      const ratingQuery = query(
        collection(db, this.RATINGS_COLLECTION),
        where('recipeTitle', '==', recipeTitle),
        where('userId', '==', userId),
        limit(1)
      );

      const ratingSnapshot = await getDocs(ratingQuery);
      if (!ratingSnapshot.empty) {
        const data = ratingSnapshot.docs[0].data();
        return {
          ...data,
          date: data.date.toDate().toISOString()
        } as RecipeRating;
      }
      return null;
    } catch (err: any) {
      log.error('Failed to get user rating', { error, recipeTitle, userId });
      return null;
    }
  }

  /**
   * Get household ratings for a recipe
   */
  static async getHouseholdRatings(recipeTitle: string, householdId: string): Promise<RecipeRating[]> {
    try {
      const ratingsQuery = query(
        collection(db, this.RATINGS_COLLECTION),
        where('recipeTitle', '==', recipeTitle),
        where('householdId', '==', householdId),
        orderBy('date', 'desc'),
        limit(10)
      );

      const ratingsSnapshot = await getDocs(ratingsQuery);
      return ratingsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          date: data.date.toDate().toISOString()
        } as RecipeRating;
      });
    } catch (err: any) {
      log.error('Failed to get household ratings', { error, recipeTitle, householdId });
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
      const userRatingsQuery = query(
        collection(db, this.RATINGS_COLLECTION),
        where('userId', '==', userId),
        orderBy('date', 'desc'),
        limit(20)
      );
      const userRatings = await getDocs(userRatingsQuery);
      const userRatingData = userRatings.docs.map(doc => doc.data());

      // Get household preferences
      let householdRatings: any[] = [];
      if (householdId) {
        const householdQuery = query(
          collection(db, this.RATINGS_COLLECTION),
          where('householdId', '==', householdId),
          orderBy('date', 'desc'),
          limit(50)
        );
        const householdSnapshot = await getDocs(householdQuery);
        householdRatings = householdSnapshot.docs.map(doc => doc.data());
      }

      // Simple recommendation logic (can be enhanced with ML)
      const recommendations = [];

      // Household-loved recipes that user hasn't rated
      if (householdRatings.length > 0) {
        const householdLoved = householdRatings
          .filter(r => r.wouldMakeAgain)
          .filter(r => !userRatingData.some(ur => ur.recipeTitle === r.recipeTitle))
          .reduce((acc, rating) => {
            acc[rating.recipeTitle] = (acc[rating.recipeTitle] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);

        Object.entries(householdLoved)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 2)
          .forEach(([recipeTitle, count]) => {
            recommendations.push({
              recipe: { title: recipeTitle }, // TODO: Get full recipe data
              reason: `${count} household members loved this`,
              confidence: Math.min(0.9, count / 5),
              type: 'household-loved'
            });
          });
      }

      // Recipes with similar ingredients to pantry
      // TODO: Implement ingredient matching logic

      return recommendations.slice(0, limitCount);
    } catch (err: any) {
      log.error('Failed to get personalized recommendations', { error, userId });
      return [];
    }
  }
}
