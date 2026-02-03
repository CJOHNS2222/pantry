/**
 * Service to manage sync state flags and prevent infinite loops during Firestore operations
 * Replaces unsafe window global usage with a proper, testable service
 */
class SyncStateService {
  private flags = new Map<string, any>();

  /**
   * Set a sync flag to prevent infinite loops
   */
  setFlag(key: string, value: any): void {
    this.flags.set(key, value);
  }

  /**
   * Get a sync flag value
   */
  getFlag(key: string): any {
    return this.flags.get(key);
  }

  /**
   * Check if a boolean flag is set
   */
  isFlagSet(key: string): boolean {
    return Boolean(this.flags.get(key));
  }

  /**
   * Clear all flags
   */
  clearAll(): void {
    this.flags.clear();
  }

  /**
   * Set a flag temporarily with automatic cleanup
   */
  setFlagTemporarily(key: string, value: any, durationMs: number = 100): void {
    this.setFlag(key, value);
    setTimeout(() => {
      this.flags.delete(key);
    }, durationMs);
  }

  /**
   * Get the current state of all flags (for debugging)
   */
  getAllFlags(): Record<string, any> {
    const result: Record<string, any> = {};
    this.flags.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }
}

// Singleton instance
export const syncState = new SyncStateService();

// Convenience functions for common operations
export const setRemoteInventoryUpdate = (value: boolean) =>
  syncState.setFlagTemporarily('remoteInventoryUpdate', value);

export const isRemoteInventoryUpdate = () =>
  syncState.isFlagSet('remoteInventoryUpdate');

export const setRemoteShoppingListUpdate = (value: boolean) =>
  syncState.setFlagTemporarily('remoteShoppingListUpdate', value);

export const isRemoteShoppingListUpdate = () =>
  syncState.isFlagSet('remoteShoppingListUpdate');

export const setRemoteMealPlanUpdate = (value: boolean) =>
  syncState.setFlagTemporarily('remoteMealPlanUpdate', value);

export const isRemoteMealPlanUpdate = () =>
  syncState.isFlagSet('remoteMealPlanUpdate');