import { PantryItem } from '../types';
import remoteConfig from './remoteConfigService';

type ActionType = 'delete_item' | 'bulk_edit' | 'update_item';

export interface UndoAction {
  id: string;
  type: ActionType;
  timestamp: number;
  userId: string; // Add user ID to scope actions per user
  data: unknown; // Previous state or details
}

const DB_NAME = 'SmartPantryUndo';
const STORE_NAME = 'actions';

// Number of undo actions to retain — read from RC so it can be tuned without a release.
// Cache the value so remoteConfig.getNumber() is not called on every prune/get operation.
const DEFAULT_MAX_ACTIONS = 20;
let _cachedMaxActions: number = DEFAULT_MAX_ACTIONS;
let _maxActionsFetched = false;

const getMaxActions = (): number => {
  if (!_maxActionsFetched) {
    const val = remoteConfig.getNumber('undo_max_actions');
    _cachedMaxActions = val > 0 ? val : DEFAULT_MAX_ACTIONS;
    _maxActionsFetched = true;
  }
  return _cachedMaxActions;
};

/** Call this after a Remote Config fetch completes to refresh the cached cap. */
export const refreshUndoMaxActions = (): void => {
  _maxActionsFetched = false;
};

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

  async recordAction(action: Omit<UndoAction, 'id' | 'timestamp' | 'userId'>, userId: string): Promise<void> {
    if (!this.db) await this.init();

    const fullAction: UndoAction = {
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
        // Keep only last getMaxActions() per user
        this.pruneOldActions(userId);
        resolve();
      };
    });
  }

  async getRecentActions(userId: string, limit: number = getMaxActions()): Promise<UndoAction[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev'); // Most recent first

      const actions: UndoAction[] = [];
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
    const maxActions = getMaxActions();
    const actions = await this.getRecentActions(userId, maxActions + 10);
    if (actions.length > maxActions) {
      const toDelete = actions.slice(maxActions);
      for (const action of toDelete) {
        await this.removeAction(action.id);
      }
    }
  }

  async undoAction(action: UndoAction): Promise<{ type: 'restore_item' | 'revert_edit'; data: unknown } | null> {
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
