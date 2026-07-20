/* eslint-disable @typescript-eslint/no-explicit-any */
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
  SetOptions,
  Query,
  DocumentData,
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
  private static metricsInterval: NodeJS.Timeout | null = null;

  static cleanup(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  private static get shouldLog(): boolean {
    return !!(import.meta as any).env?.DEV;
  }

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
    return (query as any)(...args);
  }

  static where(field: string, opStr: any, value: any) {
    return (where as any)(field, opStr, value);
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
  static async getDoc(ref: any): Promise<any> {
    const result = await getDoc(ref);
    this.metrics.reads++;
    return result;
  }

  static async getDocs<T = DocumentData>(queryRef: Query<T>): Promise<any> {
    const startTime = Date.now();
    // Handle falsy or mocked queryRefs in tests gracefully
    if (!queryRef) {
      console.warn('DatabaseMonitoringService.getDocs called with falsy queryRef - returning empty snapshot');
      this.metrics.queries++;
      return { size: 0, docs: [], forEach: (_fn: any) => {}, empty: true } as any;
    }

    try {
      const result = await getDocs(queryRef);
      const duration = Date.now() - startTime;

      this.metrics.queries++;
      this.metrics.reads += result.size;

      // Detailed logging for query tracking
      const queryPath = this.getQueryPath(queryRef as any);
      if (this.shouldLog) {
        console.log(`🔍 QUERY: ${queryPath} | Results: ${result.size} | Duration: ${duration}ms | Total Queries: ${this.metrics.queries}`);
      }

      return result;
    } catch (err: any) {
      const queryPath = this.getQueryPath(queryRef as any);
      if (this.shouldLog) {
        console.error(`❌ QUERY FAILED: ${queryPath} | Error: ${err.message}`);
      }

      // If this query failed due to security rules (permission denied),
      // return an empty snapshot so callers can gracefully handle lack
      // of access without crashing the UI.
      if (err?.code === 'permission-denied' || /permission/i.test(err?.message || '')) {
        console.warn(`Permission denied for query ${queryPath}; returning empty snapshot.`);
        return { size: 0, docs: [], forEach: (_fn: any) => {}, empty: true } as any;
      }

      throw err;
    }
  }

  // Helper method to extract query path for logging
  private static getQueryPath(queryRef: any): string {
    try {
      // Try multiple ways to get the path
      if ((queryRef as any).parent?.path) {
        return (queryRef as any).parent.path;
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
    } catch {
      return 'unknown';
    }
  }

  static async setDoc(ref: any, data: DocumentData, options?: SetOptions): Promise<void> {
    const startTime = Date.now();
    const parentId = (ref as any)?.parent?.id || 'unknown';
    const docId = (ref as any)?.id || 'unknown';
    try {
      await setDoc(ref, data, options as any);
      const duration = Date.now() - startTime;

      this.metrics.writes++;
      this.trackWritePattern(parentId);

      // Check for slow operations
      if (duration > this.PERFORMANCE_THRESHOLD) {
        reportPerformanceIssue('setDoc', duration, this.PERFORMANCE_THRESHOLD, {
          collection: parentId,
          document_id: docId
        });
      }
    } catch (err: any) {
      const duration = Date.now() - startTime;
      reportDatabaseError('setDoc', parentId, err as Error, {
        document_id: docId,
        duration_ms: duration
      });

      throw err;
    }
  }

  static async updateDoc(ref: any, data: Partial<DocumentData>): Promise<void> {
    const startTime = Date.now();
    const parentId = (ref as any)?.parent?.id || 'unknown';
    const docId = (ref as any)?.id || 'unknown';
    try {
      await updateDoc(ref, data);
      const duration = Date.now() - startTime;

      this.metrics.writes++;
      this.trackWritePattern(parentId);

      // Check for slow operations
      if (duration > this.PERFORMANCE_THRESHOLD) {
        reportPerformanceIssue('updateDoc', duration, this.PERFORMANCE_THRESHOLD, {
          collection: parentId,
          document_id: docId
        });
      }
    } catch (err: any) {
      const duration = Date.now() - startTime;
      reportDatabaseError('updateDoc', parentId, err as Error, {
        document_id: docId,
        duration_ms: duration
      });

      throw err;
    }
  }

  static async addDoc(ref: any, data: DocumentData): Promise<any> {
    const startTime = Date.now();
    const parentId = (ref as any)?.parent?.id || 'unknown';
    try {
      const result = await addDoc(ref, data);
      const duration = Date.now() - startTime;

      this.metrics.writes++;
      this.trackWritePattern(parentId);

      // Check for slow operations
      if (duration > this.PERFORMANCE_THRESHOLD) {
        reportPerformanceIssue('addDoc', duration, this.PERFORMANCE_THRESHOLD, {
          collection: parentId
        });
      }

      return result;
    } catch (err: any) {
      const duration = Date.now() - startTime;
      reportDatabaseError('addDoc', parentId, err as Error, {
        duration_ms: duration
      });

      throw err;
    }
  }

  static async deleteDoc(ref: any): Promise<void> {
    try {
      await deleteDoc(ref);
      this.metrics.deletes++;
    } catch (err: any) {
      const parentId = (ref as any)?.parent?.id || 'unknown';
      reportDatabaseError('deleteDoc', parentId, err as Error, {});
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

        return result;
      } catch (err: any) {
        const duration = Date.now() - startTime;
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
      return (originalSet as any)(...args);
    };

    (batch as any).update = (...args: any[]) => {
      operationCount++;
      return (originalUpdate as any)(...args);
    };

    (batch as any).delete = (...args: any[]) => {
      operationCount++;
      return (originalDelete as any)(...args);
    };

    return batch;
  }

  // Enhanced real-time subscriptions
  static onSnapshot(ref: any, callback: (snapshot: any) => void, errorCallback?: (err: any) => void): Unsubscribe {
    this.metrics.realtimeSubscriptions++;

    const path = ref.path || 'unknown';
    if (this.shouldLog) {
      console.log(`📡 SUBSCRIPTION: ${path} | Total Subscriptions: ${this.metrics.realtimeSubscriptions}`);
    }

    const unsubscribe = onSnapshot(ref, (snapshot: any) => {
      // Count reads exactly as Firebase bills them:
      // - Query/collection snapshot: 1 read per document on initial load, 1 per changed doc on updates (docChanges)
      // - Document snapshot: always 1 read per delivery
      if (snapshot.docChanges) {
        // Query/collection snapshot
        const changedDocs = snapshot.docChanges().length;
        this.metrics.reads += changedDocs;
        if (changedDocs > 0) {
          if (this.shouldLog) {
            console.log(`📡 SUBSCRIPTION UPDATE: ${path} | Reads: ${changedDocs} | Total Reads: ${this.metrics.reads}`);
          }
        }
      } else {
        // Document snapshot: 1 read per delivery
        this.metrics.reads++;
        if (this.shouldLog) {
          console.log(`📡 SNAPSHOT READ: ${path} | Total Reads: ${this.metrics.reads}`);
        }
      }
      callback(snapshot);
    }, errorCallback);

    // Return enhanced unsubscribe function
    return () => {
      this.metrics.realtimeSubscriptions--;
      unsubscribe();
    };
  }

  // Utility method to log current metrics
  static logCurrentMetrics(): void {
    // Clean up old patterns before logging
    this.cleanupWritePatterns();

    const metrics = this.getMetrics();
    const timestamp = new Date().toLocaleTimeString();
    if (this.shouldLog) {
      console.log(`🔥 [${timestamp}] Firestore Database Metrics:`, {
        ...metrics,
        readsPerMinute: Math.round((metrics.reads / metrics.sessionDuration) * 60000),
        writesPerMinute: Math.round((metrics.writes / metrics.sessionDuration) * 60000),
        activeWritePatterns: this.writePatterns.size
      });
    }
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
    if (!this.shouldLog) {
      this.isInitialized = true;
      return;
    }

    try {
      // Store original functions
      const originalGetDoc = getDoc;
      const originalGetDocs = getDocs;
      const originalSetDoc = setDoc;
      const originalUpdateDoc = updateDoc;
      const originalAddDoc = addDoc;
      const originalDeleteDoc = deleteDoc;
      const originalOnSnapshot = onSnapshot;

      // Monkey-patch getDoc
      (globalThis as any).getDoc = async (ref: any) => {
        const startTime = Date.now();
        const parentId = (ref as any)?.parent?.id || 'unknown';
        try {
          const result = await originalGetDoc(ref);
          const duration = Date.now() - startTime;

          this.metrics.reads++;
          AnalyticsService.trackDatabaseOperation('read', parentId, 1, {
            operation: 'getDoc',
            success: true,
            duration_ms: duration
          });
          return result;
        } catch (err: any) {
          const duration = Date.now() - startTime;
          AnalyticsService.trackDatabaseOperation('read', parentId, 1, {
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
        const parentId = (ref as any)?.parent?.id || 'unknown';
        try {
          const result = await originalSetDoc(ref, data);
          const duration = Date.now() - startTime;

          this.metrics.writes++;
          this.trackWritePattern(parentId);
          AnalyticsService.trackDatabaseOperation('write', parentId, 1, {
            operation: 'setDoc',
            success: true,
            duration_ms: duration
          });
          return result;
        } catch (err: any) {
          const duration = Date.now() - startTime;
          AnalyticsService.trackDatabaseOperation('write', parentId, 1, {
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
        const parentId = (ref as any)?.parent?.id || 'unknown';
        try {
          const result = await originalUpdateDoc(ref, data);
          const duration = Date.now() - startTime;

          this.metrics.writes++;
          this.trackWritePattern(parentId);
          AnalyticsService.trackDatabaseOperation('write', parentId, 1, {
            operation: 'updateDoc',
            success: true,
            duration_ms: duration
          });
          return result;
        } catch (err: any) {
          const duration = Date.now() - startTime;
          AnalyticsService.trackDatabaseOperation('write', parentId, 1, {
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
        const parentId = (ref as any)?.parent?.id || 'unknown';
        try {
          const result = await originalAddDoc(ref, data);
          const duration = Date.now() - startTime;

          this.metrics.writes++;
          this.trackWritePattern(parentId);
          AnalyticsService.trackDatabaseOperation('write', parentId, 1, {
            operation: 'addDoc',
            success: true,
            duration_ms: duration
          });
          return result;
        } catch (err: any) {
          const duration = Date.now() - startTime;
          AnalyticsService.trackDatabaseOperation('write', parentId, 1, {
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
        const parentId = (ref as any)?.parent?.id || 'unknown';
        try {
          const result = await originalDeleteDoc(ref);
          const duration = Date.now() - startTime;

          this.metrics.deletes++;
          AnalyticsService.trackDatabaseOperation('write', parentId, 1, {
            operation: 'deleteDoc',
            success: true,
            duration_ms: duration
          });
          return result;
        } catch (err: any) {
          const duration = Date.now() - startTime;
          AnalyticsService.trackDatabaseOperation('write', parentId, 1, {
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

        const wrappedCallback = (snapshot: any) => {
          // Count reads exactly as Firebase bills them
          if (snapshot.docChanges) {
            const changedDocs = snapshot.docChanges().length;
            this.metrics.reads += changedDocs;
            AnalyticsService.trackDatabaseOperation('read', ref.parent?.id || 'unknown', changedDocs, {
              operation: 'onSnapshot_update'
            });
          } else {
            this.metrics.reads++;
            AnalyticsService.trackDatabaseOperation('read', ref.parent?.id || 'unknown', 1, {
              operation: 'onSnapshot_read'
            });
          }
          if (typeof callback === 'function') callback(snapshot);
        };

        const unsubscribe = originalOnSnapshot(ref, wrappedCallback, errorCallback);

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
      this.metricsInterval = setInterval(() => {
        this.logCurrentMetrics();
      }, 30000);

      this.isInitialized = true;
      if (this.shouldLog) {
        console.log('🔥 Database monitoring initialized with function overrides');
      }
    } catch (err: any) {
      if (this.shouldLog) {
        console.error('Failed to initialize database monitoring:', err);
      }
    }
  }

  // Cleanup method to clear the metrics interval
  static cleanupMonitoring(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }
}

export default DatabaseMonitoringService;
