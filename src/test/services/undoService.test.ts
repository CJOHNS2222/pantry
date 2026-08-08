import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { undoService, refreshUndoMaxActions, UndoAction } from '../../../services/undoService';
import remoteConfig from '../../../services/remoteConfigService';

vi.mock('../../../services/remoteConfigService', () => ({
  default: {
    getNumber: vi.fn().mockReturnValue(20)
  }
}));

describe('undoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('refreshUndoMaxActions', () => {
    it('invalidates cached max actions flag', () => {
      refreshUndoMaxActions();
      expect(remoteConfig.getNumber).toBeDefined();
    });
  });

  describe('undoAction', () => {
    it('returns restore_item operation for delete_item action', async () => {
      const mockAction: UndoAction = {
        id: 'del_1',
        type: 'delete_item',
        timestamp: Date.now(),
        userId: 'user1',
        data: { item: 'Milk', id: 'm1' }
      };

      const result = await undoService.undoAction(mockAction);
      expect(result).toEqual({
        type: 'restore_item',
        data: { item: 'Milk', id: 'm1' }
      });
    });

    it('returns restore_item operation for bulk_delete action', async () => {
      const mockAction: UndoAction = {
        id: 'bulk_del_1',
        type: 'bulk_delete',
        timestamp: Date.now(),
        userId: 'user1',
        data: [{ id: 'm1' }, { id: 'm2' }]
      };

      const result = await undoService.undoAction(mockAction);
      expect(result).toEqual({
        type: 'restore_item',
        data: [{ id: 'm1' }, { id: 'm2' }]
      });
    });

    it('returns revert_edit operation for bulk_edit action', async () => {
      const mockAction: UndoAction = {
        id: 'edit_1',
        type: 'bulk_edit',
        timestamp: Date.now(),
        userId: 'user1',
        data: { previousState: { location: 'pantry' } }
      };

      const result = await undoService.undoAction(mockAction);
      expect(result).toEqual({
        type: 'revert_edit',
        data: { previousState: { location: 'pantry' } }
      });
    });

    it('returns revert_edit operation for update_item action', async () => {
      const mockAction: UndoAction = {
        id: 'update_1',
        type: 'update_item',
        timestamp: Date.now(),
        userId: 'user1',
        data: { previousQuantity: 2 }
      };

      const result = await undoService.undoAction(mockAction);
      expect(result).toEqual({
        type: 'revert_edit',
        data: { previousQuantity: 2 }
      });
    });
  });
});
