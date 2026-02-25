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
  deleteField,
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
  private static isInitialized = false;

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

  // Document reference wrapper
  static doc(path: string): any;
  static doc(collectionPath: string, documentId: string): any;
  static doc(pathOrCollection: string, documentId?: string) {
    if (documentId !== undefined) {
      // Two parameters: collection path + document ID
      return doc(db, `${pathOrCollection}/${documentId}`);
    } else {
      // One parameter: full path
      return doc(db, pathOrCollection);
    }
  }

  // Query builders
  static query(...args: any[]) {
    return query(...args);
  }

  static where(field: string, opStr: string, value: any) {
    return where(field, opStr, value);
  }

  static orderBy(field: string, direction?: 'asc' | 'desc') {
    return orderBy(field, direction);
  }

  static limit(n: number) {
    return limit(n);
  }

  static startAfter(...fieldValues: any[]) {
    return startAfter(...fieldValues);
  }

  static deleteField() {
    return deleteField();
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
    } catch (err: any) {
      AnalyticsService.trackDatabaseOperation('read', ref.parent.id, 1, {
        operation: 'getDoc',
        success: false,
        error: err.message
      });
      throw err;
    }
  }

  static async getDocs<T = DocumentData>(queryRef: Query<T>): Promise<QuerySnapshot<T>> {
    const startTime = Date.now();
    try {
      const result = await getDocs(queryRef);
      const duration = Date.now() - startTime;

      this.metrics.queries++;
      this.metrics.reads += result.size;

      // Detailed logging for query tracking
      const queryPath = this.getQueryPath(queryRef);
      console.log(`🔍 QUERY: ${queryPath} | Results: ${result.size} | Duration: ${duration}ms | Total Queries: ${this.metrics.queries}`);
      console.trace('Query call stack:');

      AnalyticsService.trackQueryPerformance(
        queryRef.parent?.id || 'unknown',
        'getDocs',
        result.size,
        duration
      );

      return result;
    } catch (err: any) {
      const queryPath = this.getQueryPath(queryRef);
      console.error(`❌ QUERY FAILED: ${queryPath} | Error: ${err.message}`);

      AnalyticsService.trackDatabaseOperation('read', 'unknown', 0, {
        operation: 'getDocs',
        success: false,
        error: err.message
      });
      throw err;
    }
  }

  // Helper method to extract query path for logging
  private static getQueryPath<T = DocumentData>(queryRef: Query<T>): string {
    try {
      // Try multiple ways to get the path
      if (queryRef.parent?.path) {
        return queryRef.parent.path;
      }

      // Try to get path from the query itself
      if ((queryRef as any)._path) {
        return (queryRef as any)._path.segments?.join('/') || 'unknown';
      }

      // Try to get collection name from query
      if ((queryRef as any)._collection) {
        const collection = (queryRef as any)._collection;
        if (collection.path) {
          return collection.path;
        }
        if (collection._path) {
          return collection._path.segments?.join('/') || 'unknown';
        }
      }

      return 'unknown';
    } catch (err: any) {
      return 'unknown';
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
    } catch (err: any) {
      const duration = Date.now() - startTime;
      AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
        operation: 'setDoc',
        success: false,
        error: err.message,
        duration_ms: duration
      });

      reportDatabaseError('setDoc', ref.parent.id, err as Error, {
        document_id: ref.id,
        duration_ms: duration
      });

      throw err;
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
    } catch (err: any) {
      const duration = Date.now() - startTime;
      AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
        operation: 'updateDoc',
        success: false,
        error: err.message,
        duration_ms: duration
      });

      reportDatabaseError('updateDoc', ref.parent.id, err as Error, {
        document_id: ref.id,
        duration_ms: duration
      });

      throw err;
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
    } catch (err: any) {
      const duration = Date.now() - startTime;
      AnalyticsService.trackDatabaseOperation('write', ref.id, 1, {
        operation: 'addDoc',
        success: false,
        error: err.message,
        duration_ms: duration
      });

      reportDatabaseError('addDoc', ref.id, err as Error, {
        duration_ms: duration
      });

      throw err;
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
    } catch (err: any) {
      AnalyticsService.trackDatabaseOperation('delete', ref.parent.id, 1, {
        operation: 'deleteDoc',
        success: false,
        error: err.message
      });
      throw err;
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
      } catch (err: any) {
        const duration = Date.now() - startTime;
        AnalyticsService.trackBatchOperation('batch_write', 'multiple_collections', 0);

        reportDatabaseError('batch_commit', 'multiple_collections', err as Error, {
          operation_count: operationCount,
          duration_ms: duration
        });

        throw err;
      }
    };

    // Override batch operations to count them
    const originalSet = batch.set.bind(batch);
    const originalUpdate = batch.update.bind(batch);
    const originalDelete = batch.delete.bind(batch);

    // Override batch operations to count them (use `any` to satisfy overloads)
    (batch as any).set = (...args: any[]) => {
      operationCount++;
      return originalSet(...args as any);
    };

    (batch as any).update = (...args: any[]) => {
      operationCount++;
      return originalUpdate(...args as any);
    };

    (batch as any).delete = (...args: any[]) => {
      operationCount++;
      return originalDelete(...args as any);
    };

    return batch;
  }

  // Enhanced real-time subscriptions
  static onSnapshot(ref: any, callback: (snapshot: any) => void): Unsubscribe {
    this.metrics.realtimeSubscriptions++;

    const path = ref.parent?.path || ref.path || 'unknown';
    console.log(`📡 SUBSCRIPTION: ${path} | Total Subscriptions: ${this.metrics.realtimeSubscriptions}`);

    AnalyticsService.trackDatabaseOperation('read', ref.parent?.id || 'unknown', 0, {
      operation: 'onSnapshot',
      type: 'subscription_start'
    });

    const unsubscribe = onSnapshot(ref, (snapshot: any) => {
      // Track each snapshot received
      if (snapshot.docChanges) {
        const changes = snapshot.docChanges().length;
        if (changes > 0) {
          console.log(`📡 SUBSCRIPTION UPDATE: ${path} | Changes: ${changes}`);
        }
        AnalyticsService.trackDatabaseOperation('read', ref.parent?.id || 'unknown', changes, {
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
    const timestamp = new Date().toLocaleTimeString();
    console.log(`🔥 [${timestamp}] Firestore Database Metrics:`, {
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

  // Initialize monitoring by monkey-patching Firestore functions
  static initializeMonitoring() {
    if (this.isInitialized) return;

    try {
      // Store original functions
      const originalGetDoc = getDoc;
      const originalGetDocs = getDocs;
      const originalSetDoc = setDoc;
      const originalUpdateDoc = updateDoc;
      const originalAddDoc = addDoc;
      const originalDeleteDoc = deleteDoc;
      const originalOnSnapshot = onSnapshot;
      const originalWriteBatch = writeBatch;

      // Monkey-patch getDoc
      (globalThis as any).getDoc = async (ref: any) => {
        const startTime = Date.now();
        try {
          const result = await originalGetDoc(ref);
          const duration = Date.now() - startTime;

          this.metrics.reads++;
          AnalyticsService.trackDatabaseOperation('read', ref.parent.id, 1, {
            operation: 'getDoc',
            success: true,
            duration_ms: duration
          });
          return result;
        } catch (err: any) {
          const duration = Date.now() - startTime;
          AnalyticsService.trackDatabaseOperation('read', ref.parent.id, 1, {
            operation: 'getDoc',
            success: false,
            error: (err as Error).message,
            duration_ms: duration
          });
          throw err;
        }
      };

      // Monkey-patch getDocs
      (globalThis as any).getDocs = async (query: any) => {
        const startTime = Date.now();
        try {
          const result = await originalGetDocs(query);
          const duration = Date.now() - startTime;

          this.metrics.reads += result.size;
          this.metrics.queries++;
          AnalyticsService.trackDatabaseOperation('read', query._query?.path?.segments?.[0] || 'unknown', result.size, {
            operation: 'getDocs',
            success: true,
            duration_ms: duration
          });
          return result;
        } catch (err: any) {
          const duration = Date.now() - startTime;
          AnalyticsService.trackDatabaseOperation('read', query._query?.path?.segments?.[0] || 'unknown', 0, {
            operation: 'getDocs',
            success: false,
            error: (err as Error).message,
            duration_ms: duration
          });
          throw err;
        }
      };

      // Monkey-patch setDoc
      (globalThis as any).setDoc = async (ref: any, data: any) => {
        const startTime = Date.now();
        try {
          const result = await originalSetDoc(ref, data);
          const duration = Date.now() - startTime;

          this.metrics.writes++;
          this.trackWritePattern(ref.parent.id);
          AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
            operation: 'setDoc',
            success: true,
            duration_ms: duration
          });
          return result;
        } catch (err: any) {
          const duration = Date.now() - startTime;
          AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
            operation: 'setDoc',
            success: false,
            error: (err as Error).message,
            duration_ms: duration
          });
          throw err;
        }
      };

      // Monkey-patch updateDoc
      (globalThis as any).updateDoc = async (ref: any, data: any) => {
        const startTime = Date.now();
        try {
          const result = await originalUpdateDoc(ref, data);
          const duration = Date.now() - startTime;

          this.metrics.writes++;
          this.trackWritePattern(ref.parent.id);
          AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
            operation: 'updateDoc',
            success: true,
            duration_ms: duration
          });
          return result;
        } catch (err: any) {
          const duration = Date.now() - startTime;
          AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
            operation: 'updateDoc',
            success: false,
            error: (err as Error).message,
            duration_ms: duration
          });
          throw err;
        }
      };

      // Monkey-patch addDoc
      (globalThis as any).addDoc = async (ref: any, data: any) => {
        const startTime = Date.now();
        try {
          const result = await originalAddDoc(ref, data);
          const duration = Date.now() - startTime;

          this.metrics.writes++;
          this.trackWritePattern(ref.parent.id);
          AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
            operation: 'addDoc',
            success: true,
            duration_ms: duration
          });
          return result;
        } catch (err: any) {
          const duration = Date.now() - startTime;
          AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
            operation: 'addDoc',
            success: false,
            error: (err as Error).message,
            duration_ms: duration
          });
          throw err;
        }
      };

      // Monkey-patch deleteDoc
      (globalThis as any).deleteDoc = async (ref: any) => {
        const startTime = Date.now();
        try {
          const result = await originalDeleteDoc(ref);
          const duration = Date.now() - startTime;

          this.metrics.deletes++;
          AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
            operation: 'deleteDoc',
            success: true,
            duration_ms: duration
          });
          return result;
        } catch (err: any) {
          const duration = Date.now() - startTime;
          AnalyticsService.trackDatabaseOperation('write', ref.parent.id, 1, {
            operation: 'deleteDoc',
            success: false,
            error: (err as Error).message,
            duration_ms: duration
          });
          throw err;
        }
      };

      // Monkey-patch onSnapshot
      (globalThis as any).onSnapshot = (ref: any, callback: any, errorCallback?: any) => {
        this.metrics.realtimeSubscriptions++;
        AnalyticsService.trackDatabaseOperation('read', ref.parent?.id || 'unknown', 0, {
          operation: 'onSnapshot',
          type: 'subscription_start'
        });

        const unsubscribe = originalOnSnapshot(ref, callback, errorCallback);

        return () => {
          this.metrics.realtimeSubscriptions--;
          AnalyticsService.trackDatabaseOperation('read', ref.parent?.id || 'unknown', 0, {
            operation: 'onSnapshot',
            type: 'subscription_end'
          });
          unsubscribe();
        };
      };

      // Set up periodic metrics logging every 30 seconds
      setInterval(() => {
        this.logCurrentMetrics();
      }, 30000);

      this.isInitialized = true;
      console.log('🔥 Database monitoring initialized with function overrides');
    } catch (err: any) {
      console.error('Failed to initialize database monitoring:', err);
    }
  }
}

export default DatabaseMonitoringService;
