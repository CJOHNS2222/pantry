import { PantryItem } from '../types';

type ActionType = 'delete_item' | 'bulk_edit' | 'update_item';

interface Action {
  id: string;
  type: ActionType;
  timestamp: number;
  userId: string; // Add user ID to scope actions per user
  data: any; // Previous state or details
}

const DB_NAME = 'SmartPantryUndo';
const STORE_NAME = 'actions';
const MAX_ACTIONS = 20;

class UndoService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async recordAction(action: Omit<Action, 'id' | 'timestamp' | 'userId'>, userId: string): Promise<void> {
    if (!this.db) await this.init();

    const fullAction: Action = {
      ...action,
      id: `${action.type}_${userId}_${Date.now()}`,
      timestamp: Date.now(),
      userId
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(fullAction);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        // Keep only last MAX_ACTIONS per user
        this.pruneOldActions(userId);
        resolve();
      };
    });
  }

  async getRecentActions(userId: string, limit: number = MAX_ACTIONS): Promise<Action[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev'); // Most recent first

      const actions: Action[] = [];
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && actions.length < limit) {
          // Only include actions for the current user
          if (cursor.value.userId === userId) {
            actions.push(cursor.value);
          }
          cursor.continue();
        } else {
          resolve(actions);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async removeAction(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearUserActions(userId: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          if (cursor.value.userId === userId) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async pruneOldActions(userId: string): Promise<void> {
    const actions = await this.getRecentActions(userId, MAX_ACTIONS + 10);
    if (actions.length > MAX_ACTIONS) {
      const toDelete = actions.slice(MAX_ACTIONS);
      for (const action of toDelete) {
        await this.removeAction(action.id);
      }
    }
  }

  async undoAction(action: Action): Promise<{ type: 'restore_item' | 'revert_edit'; data: any } | null> {
    // Return the undo operation details
    if (action.type === 'delete_item') {
      return { type: 'restore_item', data: action.data };
    } else if (action.type === 'bulk_edit') {
      // For bulk edit, data would contain the previous states
      return { type: 'revert_edit', data: action.data };
    } else if (action.type === 'update_item') {
      return { type: 'revert_edit', data: action.data };
    }
    return null;
  }
}

export const undoService = new UndoService();