import {
  collection as firestoreCollection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  onSnapshot,
  Query,
  DocumentData,
  QuerySnapshot,
  DocumentSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import AnalyticsService from './analyticsService';

interface DatabaseMetrics {
  reads: number;
  writes: number;
  deletes: number;
  queries: number;
  batchOperations: number;
  realtimeSubscriptions: number;
}

class DatabaseMonitoringService {
  private static metrics: DatabaseMetrics = {
    reads: 0,
    writes: 0,
    deletes: 0,
    queries: 0,
    batchOperations: 0,
    realtimeSubscriptions: 0
  };

  private static sessionStartTime = Date.now();

  // Get current session metrics
  static getMetrics(): DatabaseMetrics & { sessionDuration: number } {
    return {
      ...this.metrics,
      sessionDuration: Date.now() - this.sessionStartTime
    };
  }

  // Reset metrics (useful for testing or new sessions)
  static resetMetrics(): void {
    this.metrics = {
      reads: 0,
      writes: 0,
      deletes: 0,
      queries: 0,
      batchOperations: 0,
      realtimeSubscriptions: 0
    };
    this.sessionStartTime = Date.now();
  }

  // Enhanced collection wrapper with tracking
  static collection(path: string) {
    AnalyticsService.trackDatabaseOperation('read', path, 0, { operation: 'collection_reference' });
    return firestoreCollection(db, path);
  }

  // Enhanced document operations with tracking
  static async getDoc(ref: any): Promise<DocumentSnapshot> {
    const startTime = Date.now();
    try {
      const result = await getDoc(ref);
      const duration = Date.now() - startTime;

      this.metrics.reads++;
      AnalyticsService.trackDatabaseOperation('read', ref.parent.id, 1, {
        operation: 'getDoc',
        duration_ms: duration,
        success: true
      });

      return result;
    } catch (error) {
      AnalyticsService.trackDatabaseOperation('read', ref.parent.id, 1, {
        operation: 'getDoc',
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  static async getDocs(queryRef: Query): Promise<QuerySnapshot> {
    const startTime = Date.now();
    try {
      const result = await getDocs(queryRef);
      const duration = Date.now() - startTime;

      this.metrics.queries++;
      this.metrics.reads += result.size;

      AnalyticsService.trackQueryPerformance(
        queryRef.type === 'query' ? 'unknown' : queryRef.parent.id,
        'getDocs',
        result.size,
        duration
      );

      return result;
    } catch (error) {
      AnalyticsService.trackDatabaseOperation('read', 'unknown', 0, {
        operation: 'getDocs',
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  static async setDoc(ref: any, data: DocumentData): Promise<void> {
    try {
      await setDoc(ref, data);
      this.metrics.writes++;

      AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
        operation: 'setDoc',
        success: true
      });
    } catch (error) {
      AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
        operation: 'setDoc',
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  static async updateDoc(ref: any, data: Partial<DocumentData>): Promise<void> {
    try {
      await updateDoc(ref, data);
      this.metrics.writes++;

      AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
        operation: 'updateDoc',
        success: true
      });
    } catch (error) {
      AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
        operation: 'updateDoc',
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  static async addDoc(ref: any, data: DocumentData): Promise<any> {
    try {
      const result = await addDoc(ref, data);
      this.metrics.writes++;

      AnalyticsService.trackDatabaseOperation('write', ref.id, 1, {
        operation: 'addDoc',
        success: true
      });

      return result;
    } catch (error) {
      AnalyticsService.trackDatabaseOperation('write', ref.id, 1, {
        operation: 'addDoc',
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  static async deleteDoc(ref: any): Promise<void> {
    try {
      await deleteDoc(ref);
      this.metrics.deletes++;

      AnalyticsService.trackDatabaseOperation('delete', ref.parent.id, 1, {
        operation: 'deleteDoc',
        success: true
      });
    } catch (error) {
      AnalyticsService.trackDatabaseOperation('delete', ref.parent.id, 1, {
        operation: 'deleteDoc',
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  // Enhanced batch operations
  static writeBatch(): any {
    const batch = writeBatch(db);
    const originalCommit = batch.commit.bind(batch);

    batch.commit = async () => {
      try {
        const result = await originalCommit();
        this.metrics.batchOperations++;
        this.metrics.writes++; // Approximate - batch could contain multiple operations

        AnalyticsService.trackBatchOperation('batch_write', 'multiple_collections', 1);

        return result;
      } catch (error) {
        AnalyticsService.trackBatchOperation('batch_write', 'multiple_collections', 0);
        throw error;
      }
    };

    return batch;
  }

  // Enhanced real-time subscriptions
  static onSnapshot(ref: any, callback: (snapshot: any) => void): Unsubscribe {
    this.metrics.realtimeSubscriptions++;

    AnalyticsService.trackDatabaseOperation('read', ref.parent?.id || 'unknown', 0, {
      operation: 'onSnapshot',
      type: 'subscription_start'
    });

    const unsubscribe = onSnapshot(ref, (snapshot) => {
      // Track each snapshot received
      if (snapshot.docChanges) {
        AnalyticsService.trackDatabaseOperation('read', ref.parent?.id || 'unknown', snapshot.docChanges().length, {
          operation: 'onSnapshot_update'
        });
      }
      callback(snapshot);
    });

    // Return enhanced unsubscribe function
    return () => {
      this.metrics.realtimeSubscriptions--;
      AnalyticsService.trackDatabaseOperation('read', ref.parent?.id || 'unknown', 0, {
        operation: 'onSnapshot',
        type: 'subscription_end'
      });
      unsubscribe();
    };
  }

  // Utility method to log current metrics
  static logCurrentMetrics(): void {
    const metrics = this.getMetrics();
    console.log('🔥 Firestore Database Metrics:', {
      ...metrics,
      readsPerMinute: Math.round((metrics.reads / metrics.sessionDuration) * 60000),
      writesPerMinute: Math.round((metrics.writes / metrics.sessionDuration) * 60000)
    });
  }

  // Export metrics for external monitoring
  static exportMetrics(): DatabaseMetrics & { timestamp: number; sessionDuration: number } {
    return {
      ...this.metrics,
      timestamp: Date.now(),
      sessionDuration: Date.now() - this.sessionStartTime
    };
  }
}

export default DatabaseMonitoringService;