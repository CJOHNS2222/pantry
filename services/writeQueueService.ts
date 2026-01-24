import { db } from '../firebaseConfig';
import { setDoc, deleteDoc, doc } from 'firebase/firestore';
import { reportSyncIssue } from './sentryService';

// Enhanced retry configuration
const RETRY_CONFIG = {
  maxAttempts: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  jitter: 0.1 // Add 10% jitter to prevent thundering herd
};

// Utility functions for retry logic
export function calculateRetryDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
    RETRY_CONFIG.maxDelay
  );

  // Add jitter to prevent thundering herd
  const jitter = delay * RETRY_CONFIG.jitter * (Math.random() * 2 - 1);
  return Math.max(1000, delay + jitter);
}

export function isRetryableError(error: any): boolean {
  // Network errors
  if (!navigator.onLine) return false;

  // Firebase specific errors
  if (error?.code) {
    const retryableCodes = [
      'unavailable',
      'deadline-exceeded',
      'resource-exhausted',
      'cancelled',
      'internal',
      'unknown'
    ];
    return retryableCodes.includes(error.code);
  }

  // Network-related errors
  if (error?.message) {
    const retryableMessages = [
      'network',
      'timeout',
      'connection',
      'fetch',
      'failed to fetch'
    ];
    return retryableMessages.some(msg => error.message.toLowerCase().includes(msg));
  }

  return false;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxAttempts: number = RETRY_CONFIG.maxAttempts
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts || !isRetryableError(error)) {
        throw error;
      }

      const delay = calculateRetryDelay(attempt);
      console.warn(`${operationName} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms:`, error);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

type BaseOp = {
  id?: number;
  type: string;
  userId?: string;
  householdId?: string | null;
  payload?: any;
  attempts?: number;
  nextAttempt?: number; // timestamp
  timestamp: number;
  lastError?: string;
};

type InventorySyncOp = BaseOp & {
  type: 'inventorySync';
  inHousehold: boolean;
  inventory: any[];
};

const DB_NAME = 'smartpantry-write-queue';
const STORE_NAME = 'operations';

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueInventorySync(op: Omit<InventorySyncOp, 'id' | 'timestamp' | 'attempts' | 'nextAttempt'>) {
  const dbInst = await open();
  return new Promise<number>((resolve, reject) => {
    const tx = dbInst.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const entry = { ...op, timestamp: Date.now(), attempts: 0, nextAttempt: 0 };
    const req = store.add(entry);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueGenericOp(op: Omit<BaseOp, 'id' | 'timestamp' | 'attempts' | 'nextAttempt'>) {
  const dbInst = await open();
  return new Promise<number>((resolve, reject) => {
    const tx = dbInst.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const entry = { ...op, timestamp: Date.now(), attempts: 0, nextAttempt: 0 };
    const req = store.add(entry as any);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

async function getAllOps() {
  const dbInst = await open();
  return new Promise<InventorySyncOp[]>((resolve, reject) => {
    const tx = dbInst.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as InventorySyncOp[]);
    req.onerror = () => reject(req.error);
  });
}

async function deleteOp(id: number) {
  const dbInst = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = dbInst.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function cleanObject(obj: any) {
  const cleaned: any = {};
  for (const k in obj) {
    if (obj[k] !== undefined) cleaned[k] = obj[k];
  }
  return cleaned;
}

export async function processQueue() {
  if (!navigator.onLine) return;
  let ops: BaseOp[] = [];
  try {
    ops = await getAllOps();
  } catch (err) {
    console.error('Failed to read write queue:', err);
    return;
  }

  const now = Date.now();
  for (const op of ops) {
    // Skip until nextAttempt if set
    if (op.nextAttempt && op.nextAttempt > now) continue;

    try {
      if (op.type === 'inventorySync') {
        const invOp = op as InventorySyncOp;
        const pathBase = invOp.inHousehold && invOp.householdId ? `households/${invOp.householdId}/inventory` : `users/${invOp.userId}/inventory`;
        for (const item of invOp.inventory) {
          try {
            await setDoc(doc(db, pathBase, item.id), cleanObject(item));
          } catch (err) {
            console.error('Failed to write queued inventory item:', err);
            throw err;
          }
        }
      } else {
        // Placeholder: handle other op types here (e.g., mealPlan, recipes)
        console.debug('Processing generic op type:', op.type);
      }

      if (op.id) await deleteOp(op.id);
    } catch (err) {
      const error = err as Error;
      const attempts = (op.attempts || 0) + 1;

      if (attempts >= RETRY_CONFIG.maxAttempts || !isRetryableError(error)) {
        console.error(`Operation ${op.type} failed permanently after ${attempts} attempts:`, error);
        // Mark for permanent failure - could move to dead letter queue
        if (op.id) await deleteOp(op.id);
      } else {
        // Schedule retry with exponential backoff
        const delay = calculateRetryDelay(attempts);
        const nextAttempt = Date.now() + delay;

        console.warn(`Operation ${op.type} failed, scheduling retry ${attempts}/${RETRY_CONFIG.maxAttempts} in ${delay}ms:`, error);

        // Update operation with retry info
        const dbInst = await open();
        const tx = dbInst.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const updatedOp = {
          ...op,
          attempts,
          nextAttempt,
          lastError: error.message
        };
        store.put(updatedOp);
      }

      // Report sync issues to Sentry for monitoring
      reportSyncIssue(op.type, error, attempts, {
        operation_id: op.id,
        user_id: op.userId,
        household_id: op.householdId,
        timestamp: op.timestamp,
        is_retryable: isRetryableError(error),
        will_retry: attempts < RETRY_CONFIG.maxAttempts && isRetryableError(error)
      });

      try {
        // update op in storage
        const dbInst = await open();
        const tx = dbInst.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(op.id as number);
        getReq.onsuccess = () => {
          const existing = getReq.result;
          if (existing) {
            existing.attempts = attempts;
            existing.nextAttempt = nextAttempt;
            store.put(existing);
          }
        };
      } catch (e) {
        console.error('Failed to schedule retry for op:', e);
        // Report this secondary error as well
        reportSyncIssue('retry_scheduling', e as Error, attempts, {
          original_operation: op.type,
          operation_id: op.id
        });
      }
      // continue with next op rather than stop processing
    }
  }
}

// Auto-process when online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    processQueue().catch(err => console.error('Error processing write queue on online:', err));
  });
}

export default { enqueueInventorySync, processQueue };
