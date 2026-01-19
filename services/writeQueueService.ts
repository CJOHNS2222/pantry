import { db } from '../firebaseConfig';
import { setDoc, deleteDoc, doc } from 'firebase/firestore';

type BaseOp = {
  id?: number;
  type: string;
  userId?: string;
  householdId?: string | null;
  payload?: any;
  attempts?: number;
  nextAttempt?: number; // timestamp
  timestamp: number;
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
      console.warn('Processing op failed, will schedule retry:', err);
      // increment attempts and set exponential backoff nextAttempt
      const attempts = (op.attempts || 0) + 1;
      const backoffMs = Math.min(60_000 * Math.pow(2, attempts - 1), 1000 * 60 * 60); // max 1 hour
      const nextAttempt = Date.now() + backoffMs;
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
