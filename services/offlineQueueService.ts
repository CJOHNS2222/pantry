import DatabaseMonitoringService from './databaseMonitoringService';
import { serverTimestamp } from 'firebase/firestore';
import { log } from './logService';

// IndexedDB setup
const DB_NAME = 'SmartPantryQueue';
const DB_VERSION = 3; // Incremented for dead-letter store (fix F09)
const QUEUE_STORE = 'operations';
const CONFLICT_STORE = 'conflicts';
const DEAD_LETTER_STORE = 'deadLetter';

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

interface DeadLetterEntry {
  id: string;
  operation: QueuedOperation;
  errorMessage: string;
  errorCode?: string;
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

        // Dead-letter store (fix F09a/c): ops that exhausted retries or hit a
        // terminal error land here instead of looping in QUEUE_STORE forever.
        if (!db.objectStoreNames.contains(DEAD_LETTER_STORE)) {
          const deadLetterStore = db.createObjectStore(DEAD_LETTER_STORE, { keyPath: 'id' });
          deadLetterStore.createIndex('timestamp', 'timestamp');
        }
      };
    });
  }

  async enqueue(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount' | 'lastError'>): Promise<void> {
    if (!this.db) await this.init();

    const queuedOp: QueuedOperation = {
      ...operation,
      id: `${operation.type}_${operation.collection}_${crypto.randomUUID()}`,
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
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';

            if (this.isTerminalError(err)) {
            // permission-denied / not-found will never resolve via conflict
            // resolution or retry - dead-letter immediately (fix F09c).
            await this.moveToDeadLetter(op, errorMessage, (err as { code?: string })?.code);
            progress.failed++;
          } else if (this.isConflictError(err)) {
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
      // Replay via setDoc with the op's own stable id instead of addDoc, so
      // replaying this op more than once (e.g. after a partial failure) is
      // idempotent rather than creating duplicate documents (fix F09e).
      const docRef = DatabaseMonitoringService.doc(coll, op.id);
      await DatabaseMonitoringService.setDoc(docRef, data);
    } else if (type === 'update' && docId) {
      // Check for conflicts before updating
      const docRef = DatabaseMonitoringService.doc(coll, docId);
      const docSnap = await DatabaseMonitoringService.getDoc(docRef);

      if (docSnap.exists()) {
        const serverData = docSnap.data();
        const serverTimestampValue = serverData.updatedAt || serverData.timestamp;

        // Simple conflict detection: if server data is newer than our operation.
        // Normalize since some legacy queued/server values are ISO strings
        // rather than Firestore Timestamps (fix F09d).
        if (serverTimestampValue) {
          const serverMillis = typeof serverTimestampValue.toMillis === 'function'
            ? serverTimestampValue.toMillis()
            : Date.parse(serverTimestampValue);

          if (!Number.isNaN(serverMillis) && serverMillis > op.timestamp) {
            throw Object.assign(new Error(`Conflict detected for ${coll}/${docId}`), { _serverData: serverData });
          }
        }
      }

      await DatabaseMonitoringService.updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
    } else if (type === 'delete' && docId) {
      await DatabaseMonitoringService.deleteDoc(DatabaseMonitoringService.doc(coll, docId));
    }
  }

  private isTerminalError(error: any): boolean {
    // These will never resolve via conflict resolution or retry - dead-letter
    // them immediately instead of parking as a conflict (fix F09c).
    return error?.code === 'permission-denied' || error?.code === 'not-found';
  }

  private isConflictError(error: any): boolean {
    return error?.message?.includes('Conflict detected');
  }

  private async handleConflict(op: QueuedOperation, error: any): Promise<void> {
    if (!this.db) await this.init();

    // Store conflict for user resolution
    const conflict: ConflictResolution = {
      id: `conflict_${op.id}`,
      operation: op,
      serverData: error?._serverData || null,
      localData: op.data,
      resolved: false,
      timestamp: Date.now()
    };

    await new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([CONFLICT_STORE], 'readwrite');
      const store = transaction.objectStore(CONFLICT_STORE);
      // put() upserts - if this op was already parked as a conflict (e.g.
      // reprocessed before the queue removal below took effect), add() would
      // throw ConstraintError and abort the rest of the sync pass (fix F09b).
      const request = store.put(conflict);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    // Dequeue from the main queue now that it's parked as a conflict, so it
    // isn't picked up and reprocessed on the next sync pass (fix F09b).
    await this.remove(op.id);
  }

  private async handleRetry(op: QueuedOperation, errorMessage: string): Promise<void> {
    const maxRetries = 3;
    const retryCount = (op.retryCount || 0) + 1;

    if (retryCount >= maxRetries) {
      // Retry budget exhausted - move to the dead-letter store instead of
      // leaving it in QUEUE_STORE, where it would retry forever on every
      // subsequent sync pass (fix F09a).
      log.error(`Operation failed after ${maxRetries} retries`, { op, errorMessage }, 'offlineQueueService');
      await this.moveToDeadLetter(op, errorMessage);
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

  // Move an op that has exhausted retries or hit a terminal error into the
  // dead-letter store and remove it from the active queue (fix F09a/c).
  private async moveToDeadLetter(op: QueuedOperation, errorMessage: string, errorCode?: string): Promise<void> {
    if (!this.db) await this.init();

    const entry: DeadLetterEntry = {
      id: op.id,
      operation: op,
      errorMessage,
      errorCode,
      timestamp: Date.now()
    };

    await new Promise<void>((resolve, reject) => {
      const transaction = this.db!.transaction([DEAD_LETTER_STORE], 'readwrite');
      const store = transaction.objectStore(DEAD_LETTER_STORE);
      const request = store.put(entry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    await this.remove(op.id);
  }

  // Get dead-lettered operations (for diagnostics / manual inspection)
  async getDeadLetterQueue(): Promise<DeadLetterEntry[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([DEAD_LETTER_STORE], 'readonly');
      const store = transaction.objectStore(DEAD_LETTER_STORE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  // Get pending operations count
  async getPendingCount(): Promise<number> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([QUEUE_STORE], 'readonly');
      const store = transaction.objectStore(QUEUE_STORE);
      const request = store.count();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
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

  // Legacy method for backward compatibility. Returns the sync outcome (rather
  // than void) so callers can gate success messaging on whether anything
  // actually failed or was parked as a conflict (fix L5).
  async processQueue(): Promise<SyncProgress | undefined> {
    if (this.isProcessing) {
      log.debug('Sync already in progress, skipping', undefined, 'OfflineQueueService');
      return undefined;
    }
    log.debug('Starting to process offline queue', undefined, 'OfflineQueueService');
    const result = await this.processQueueWithSync();
    log.info('Processed offline queue', { total: result.total, completed: result.completed, failed: result.failed, conflicts: result.conflicts }, 'OfflineQueueService');
    return result;
  }

  getProcessingStatus(): boolean {
    return this.isProcessing;
  }
}

export const offlineQueue = new OfflineQueueService();
