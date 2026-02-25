import { db } from '../firebaseConfig';
import DatabaseMonitoringService from './databaseMonitoringService';
import { serverTimestamp } from 'firebase/firestore';

// IndexedDB setup
const DB_NAME = 'SmartPantryQueue';
const DB_VERSION = 2; // Incremented for new schema
const QUEUE_STORE = 'operations';
const CONFLICT_STORE = 'conflicts';

interface QueuedOperation {
  id: string;
  type: 'add' | 'update' | 'delete';
  collection: string;
  docId?: string;
  data: any;
  timestamp: number;
  retryCount?: number;
  lastError?: string;
}

interface ConflictResolution {
  id: string;
  operation: QueuedOperation;
  serverData: any;
  localData: any;
  resolved: boolean;
  resolution?: 'server' | 'local' | 'merge';
  timestamp: number;
}

interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  conflicts: number;
}

type SyncCallback = (progress: SyncProgress) => void;

class OfflineQueueService {
  private db: IDBDatabase | null = null;
  private syncCallbacks: SyncCallback[] = [];
  private isProcessing = false;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Operations store
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          const queueStore = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
          queueStore.createIndex('timestamp', 'timestamp');
          queueStore.createIndex('collection', 'collection');
        }

        // Conflicts store
        if (!db.objectStoreNames.contains(CONFLICT_STORE)) {
          const conflictStore = db.createObjectStore(CONFLICT_STORE, { keyPath: 'id' });
          conflictStore.createIndex('timestamp', 'timestamp');
        }
      };
    });
  }

  async enqueue(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount' | 'lastError'>): Promise<void> {
    if (!this.db) await this.init();

    const queuedOp: QueuedOperation = {
      ...operation,
      id: `${operation.type}_${operation.collection}_${operation.docId || Date.now()}_${Date.now()}`,
      timestamp: Date.now(),
      retryCount: 0
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE);
      const request = store.add(queuedOp);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async dequeue(): Promise<QueuedOperation[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE], 'readonly');
      const store = transaction.objectStore(QUEUE_STORE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const operations = request.result.sort((a, b) => a.timestamp - b.timestamp);
        resolve(operations);
      };
    });
  }

  async remove(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Enhanced sync processing with conflict resolution
  async processQueueWithSync(callback?: SyncCallback): Promise<SyncProgress> {
    if (this.isProcessing) {
      throw new Error('Sync already in progress');
    }

    this.isProcessing = true;
    const operations = await this.dequeue();
    const progress: SyncProgress = {
      total: operations.length,
      completed: 0,
      failed: 0,
      conflicts: 0
    };

    try {
      for (const op of operations) {
        try {
            await this.executeOperationWithConflictResolution(op);
            await this.remove(op.id);
            progress.completed++;
        } catch (err: any) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';

            if (this.isConflictError(err)) {
            // Handle conflict resolution
            await this.handleConflict(op, err);
            progress.conflicts++;
          } else {
            // Handle retry logic
            await this.handleRetry(op, errorMessage);
            progress.failed++;
          }
        }

        // Update progress
        if (callback) {
          callback(progress);
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return progress;
  }

  private async executeOperationWithConflictResolution(op: QueuedOperation): Promise<void> {
    const { type, collection: coll, docId, data } = op;

    if (type === 'add') {
      await DatabaseMonitoringService.addDoc(DatabaseMonitoringService.collection(coll), data);
    } else if (type === 'update' && docId) {
      // Check for conflicts before updating
      const docRef = DatabaseMonitoringService.doc(coll, docId);
      const docSnap = await DatabaseMonitoringService.getDoc(docRef);

      if (docSnap.exists()) {
        const serverData = docSnap.data();
        const serverTimestamp = serverData.updatedAt || serverData.timestamp;

        // Simple conflict detection: if server data is newer than our operation
        if (serverTimestamp && serverTimestamp.toMillis() > op.timestamp) {
          throw new Error(`Conflict detected for ${coll}/${docId}`);
        }
      }

      await DatabaseMonitoringService.updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
    } else if (type === 'delete' && docId) {
      await DatabaseMonitoringService.deleteDoc(DatabaseMonitoringService.doc(coll, docId));
    }
  }

  private isConflictError(error: any): boolean {
    return error?.message?.includes('Conflict detected') ||
           error?.code === 'permission-denied' ||
           error?.code === 'not-found';
  }

  private async handleConflict(op: QueuedOperation, error: any): Promise<void> {
    if (!this.db) await this.init();

    // Store conflict for user resolution
    const conflict: ConflictResolution = {
      id: `conflict_${op.id}`,
      operation: op,
      serverData: null, // Would need to fetch server data
      localData: op.data,
      resolved: false,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CONFLICT_STORE], 'readwrite');
      const store = transaction.objectStore(CONFLICT_STORE);
      const request = store.add(conflict);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private async handleRetry(op: QueuedOperation, errorMessage: string): Promise<void> {
    const maxRetries = 3;
    const retryCount = (op.retryCount || 0) + 1;

    if (retryCount >= maxRetries) {
      // Move to failed operations or notify user
      console.error(`Operation failed after ${maxRetries} retries:`, op, errorMessage);
      return;
    }

    // Update retry count and schedule retry with exponential backoff
    const updatedOp: QueuedOperation = {
      ...op,
      retryCount,
      lastError: errorMessage
    };

    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE], 'readwrite');
      const store = transaction.objectStore(QUEUE_STORE);
      const request = store.put(updatedOp);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Get pending operations count
  async getPendingCount(): Promise<number> {
    const operations = await this.dequeue();
    return operations.length;
  }

  // Get unresolved conflicts
  async getConflicts(): Promise<ConflictResolution[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CONFLICT_STORE], 'readonly');
      const store = transaction.objectStore(CONFLICT_STORE);
      const index = store.index('timestamp');
      const request = index.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const conflicts = request.result.filter((c: ConflictResolution) => !c.resolved);
        resolve(conflicts);
      };
    });
  }

  // Resolve conflict
  async resolveConflict(conflictId: string, resolution: 'server' | 'local' | 'merge'): Promise<void> {
    if (!this.db) await this.init();

    const conflicts = await this.getConflicts();
    const conflict = conflicts.find(c => c.id === conflictId);

    if (!conflict) {
      throw new Error('Conflict not found');
    }

    if (resolution === 'local') {
      // Re-queue the operation
      await this.enqueue(conflict.operation);
    } else if (resolution === 'server') {
      // Discard local changes
    } else if (resolution === 'merge') {
      // Would need merge logic here
      await this.enqueue(conflict.operation);
    }

    // Mark conflict as resolved
    const updatedConflict: ConflictResolution = {
      ...conflict,
      resolved: true,
      resolution
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([CONFLICT_STORE], 'readwrite');
      const store = transaction.objectStore(CONFLICT_STORE);
      const request = store.put(updatedConflict);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // Legacy method for backward compatibility
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('🔥 [OfflineQueueService] Sync already in progress, skipping');
      return;
    }
    console.log('🔥 [OfflineQueueService] Starting to process offline queue');
    const result = await this.processQueueWithSync();
    console.log(`🔥 [OfflineQueueService] Processed ${result.total} operations: ${result.completed} completed, ${result.failed} failed, ${result.conflicts} conflicts`);
  }
}

export const offlineQueue = new OfflineQueueService();
