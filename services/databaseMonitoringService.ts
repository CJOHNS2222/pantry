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
import { reportDatabaseError, reportHeavyWritePattern, reportPerformanceIssue } from './sentryService';

interface DatabaseMetrics {
  reads: number;
  writes: number;
  deletes: number;
  queries: number;
  batchOperations: number;
  realtimeSubscriptions: number;
}

interface WritePattern {
  collection: string;
  count: number;
  startTime: number;
  lastWrite: number;
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
  private static writePatterns: Map<string, WritePattern> = new Map();
  private static readonly HEAVY_WRITE_THRESHOLD = 50; // writes per minute
  private static readonly HEAVY_WRITE_WINDOW = 60000; // 1 minute in milliseconds
  private static readonly PERFORMANCE_THRESHOLD = 5000; // 5 seconds

  // Track write patterns for heavy write detection
  private static trackWritePattern(collection: string): void {
    const now = Date.now();
    const key = collection;

    if (!this.writePatterns.has(key)) {
      this.writePatterns.set(key, {
        collection,
        count: 1,
        startTime: now,
        lastWrite: now
      });
    } else {
      const pattern = this.writePatterns.get(key)!;
      pattern.count++;
      pattern.lastWrite = now;

      // Check if this is a heavy write pattern
      const timeWindow = now - pattern.startTime;
      if (timeWindow <= this.HEAVY_WRITE_WINDOW) {
        const writesPerMinute = (pattern.count / timeWindow) * 60000;
        if (writesPerMinute >= this.HEAVY_WRITE_THRESHOLD) {
          console.warn(`🚨 Heavy write pattern detected: ${pattern.count} writes to ${collection} in ${timeWindow}ms`);

          // Report to Sentry
          reportHeavyWritePattern(collection, pattern.count, timeWindow, {
            writes_per_minute: writesPerMinute,
            session_duration: Date.now() - this.sessionStartTime
          });

          // Reset pattern after reporting
          this.writePatterns.delete(key);
        }
      } else {
        // Reset pattern if window has expired
        this.writePatterns.set(key, {
          collection,
          count: 1,
          startTime: now,
          lastWrite: now
        });
      }
    }
  }

  // Clean up old write patterns periodically
  private static cleanupWritePatterns(): void {
    const now = Date.now();
    for (const [key, pattern] of this.writePatterns.entries()) {
      if (now - pattern.lastWrite > this.HEAVY_WRITE_WINDOW * 2) {
        this.writePatterns.delete(key);
      }
    }
  }

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
    const startTime = Date.now();
    try {
      await setDoc(ref, data);
      const duration = Date.now() - startTime;

      this.metrics.writes++;
      this.trackWritePattern(ref.parent.id);

      // Check for slow operations
      if (duration > this.PERFORMANCE_THRESHOLD) {
        reportPerformanceIssue('setDoc', duration, this.PERFORMANCE_THRESHOLD, {
          collection: ref.parent.id,
          document_id: ref.id
        });
      }

      AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
        operation: 'setDoc',
        success: true,
        duration_ms: duration
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
        operation: 'setDoc',
        success: false,
        error: error.message,
        duration_ms: duration
      });

      reportDatabaseError('setDoc', ref.parent.id, error as Error, {
        document_id: ref.id,
        duration_ms: duration
      });

      throw error;
    }
  }

  static async updateDoc(ref: any, data: Partial<DocumentData>): Promise<void> {
    const startTime = Date.now();
    try {
      await updateDoc(ref, data);
      const duration = Date.now() - startTime;

      this.metrics.writes++;
      this.trackWritePattern(ref.parent.id);

      // Check for slow operations
      if (duration > this.PERFORMANCE_THRESHOLD) {
        reportPerformanceIssue('updateDoc', duration, this.PERFORMANCE_THRESHOLD, {
          collection: ref.parent.id,
          document_id: ref.id
        });
      }

      AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
        operation: 'updateDoc',
        success: true,
        duration_ms: duration
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
        operation: 'updateDoc',
        success: false,
        error: error.message,
        duration_ms: duration
      });

      reportDatabaseError('updateDoc', ref.parent.id, error as Error, {
        document_id: ref.id,
        duration_ms: duration
      });

      throw error;
    }
  }

  static async addDoc(ref: any, data: DocumentData): Promise<any> {
    const startTime = Date.now();
    try {
      const result = await addDoc(ref, data);
      const duration = Date.now() - startTime;

      this.metrics.writes++;
      this.trackWritePattern(ref.id);

      // Check for slow operations
      if (duration > this.PERFORMANCE_THRESHOLD) {
        reportPerformanceIssue('addDoc', duration, this.PERFORMANCE_THRESHOLD, {
          collection: ref.id
        });
      }

      AnalyticsService.trackDatabaseOperation('write', ref.id, 1, {
        operation: 'addDoc',
        success: true,
        duration_ms: duration
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      AnalyticsService.trackDatabaseOperation('write', ref.id, 1, {
        operation: 'addDoc',
        success: false,
        error: error.message,
        duration_ms: duration
      });

      reportDatabaseError('addDoc', ref.id, error as Error, {
        duration_ms: duration
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
    const startTime = Date.now();
    let operationCount = 0;

    const originalCommit = batch.commit.bind(batch);

    batch.commit = async () => {
      try {
        const result = await originalCommit();
        const duration = Date.now() - startTime;

        this.metrics.batchOperations++;
        this.metrics.writes += operationCount; // More accurate tracking

        // Check for slow batch operations
        if (duration > this.PERFORMANCE_THRESHOLD) {
          reportPerformanceIssue('batch_commit', duration, this.PERFORMANCE_THRESHOLD, {
            operation_count: operationCount
          });
        }

        AnalyticsService.trackBatchOperation('batch_write', 'multiple_collections', operationCount);

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        AnalyticsService.trackBatchOperation('batch_write', 'multiple_collections', 0);

        reportDatabaseError('batch_commit', 'multiple_collections', error as Error, {
          operation_count: operationCount,
          duration_ms: duration
        });

        throw error;
      }
    };

    // Override batch operations to count them
    const originalSet = batch.set.bind(batch);
    const originalUpdate = batch.update.bind(batch);
    const originalDelete = batch.delete.bind(batch);

    batch.set = (...args) => {
      operationCount++;
      return originalSet(...args);
    };

    batch.update = (...args) => {
      operationCount++;
      return originalUpdate(...args);
    };

    batch.delete = (...args) => {
      operationCount++;
      return originalDelete(...args);
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
    // Clean up old patterns before logging
    this.cleanupWritePatterns();

    const metrics = this.getMetrics();
    console.log('🔥 Firestore Database Metrics:', {
      ...metrics,
      readsPerMinute: Math.round((metrics.reads / metrics.sessionDuration) * 60000),
      writesPerMinute: Math.round((metrics.writes / metrics.sessionDuration) * 60000),
      activeWritePatterns: this.writePatterns.size
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