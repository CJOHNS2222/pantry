import { db } from '../firebaseConfig';
import { doc, setDoc, updateDoc, deleteDoc, collection, addDoc } from 'firebase/firestore';

// IndexedDB setup
const DB_NAME = 'SmartPantryQueue';
const DB_VERSION = 1;
const QUEUE_STORE = 'operations';

interface QueuedOperation {
  id: string;
  type: 'add' | 'update' | 'delete';
  collection: string;
  docId?: string;
  data: any;
  timestamp: number;
}

class OfflineQueueService {
  private db: IDBDatabase | null = null;

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
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        }
      };
    });
  }

  async enqueue(operation: Omit<QueuedOperation, 'id' | 'timestamp'>): Promise<void> {
    if (!this.db) await this.init();

    const queuedOp: QueuedOperation = {
      ...operation,
      id: `${operation.type}_${operation.collection}_${operation.docId || Date.now()}`,
      timestamp: Date.now()
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

  async processQueue(): Promise<void> {
    const operations = await this.dequeue();

    for (const op of operations) {
      try {
        await this.executeOperation(op);
        await this.remove(op.id);
      } catch (error) {
        console.error('Failed to process queued operation:', op, error);
        // Keep failed operations in queue for retry
      }
    }
  }

  private async executeOperation(op: QueuedOperation): Promise<void> {
    const { type, collection: coll, docId, data } = op;

    if (type === 'add') {
      await addDoc(collection(db, coll), data);
    } else if (type === 'update' && docId) {
      await updateDoc(doc(db, coll, docId), data);
    } else if (type === 'delete' && docId) {
      await deleteDoc(doc(db, coll, docId));
    }
  }
}

export const offlineQueue = new OfflineQueueService();