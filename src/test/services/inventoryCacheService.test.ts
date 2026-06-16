import { describe, it, expect, vi } from 'vitest';
import { InventoryCacheService } from '../../../services/inventoryCacheService';
import { PantryItem } from '../../../types';

// Mock DatabaseMonitoringService since we are only testing local array transformation methods
vi.mock('../../../services/databaseMonitoringService', () => ({
  default: {}
}));

describe('InventoryCacheService serialization and deserialization', () => {
  it('correctly round-trips a fully populated PantryItem', () => {
    const originalItem: PantryItem = {
      id: 'test-item-123',
      category: 'Produce',
      image: 'https://example.com/image.jpg',
      containerImage: 'https://example.com/container.jpg',
      item: 'Apples',
      quantity_estimate: '2.5',
      storageLocation: 'fridge',
      reservations: [
        {
          recipeId: 'recipe-abc',
          recipeName: 'Apple Pie',
          quantity: 2,
          unit: 'lbs'
        }
      ],
      expirationDate: '2026-06-30',
      expirationType: 'use-by',
      dateAdded: '2026-06-10T12:00:00.000Z',
      lastRestocked: '2026-06-12T12:00:00.000Z',
      batches: [
        {
          id: 'batch-1',
          amount: 2.5,
          unit: 'lbs',
          added: '2026-06-12T12:00:00.000Z',
          expires: '2026-06-30'
        }
      ],
      quantity: {
        amount: 2.5,
        unit: 'lbs',
        originalAmount: 3.0,
        originalUnit: 'lbs'
      },
      notes: 'Crisp and sweet',
      isStaple: true,
      isOpened: true,
      openedAt: '2026-06-13T10:00:00.000Z',
      openedExpiry: '2026-06-20',
      visualLevel: 'threeQuarter',
      is_frozen: true,
      frozenAt: '2026-06-14T08:00:00.000Z',
      freezerExpiry: '2026-12-14',
      is_immortal: false,
      is_leftover: false,
      productRiskLevel: 2,
      expiryAlertShown: true
    };

    // Serialize to array
    const serialized = (InventoryCacheService as any).pantryItemToArray(originalItem);
    
    // Deserialize back to object
    const deserialized = InventoryCacheService.arrayToPantryItem(originalItem.id, serialized);

    // Assert that the fields match
    expect(deserialized.id).toBe(originalItem.id);
    expect(deserialized.category).toBe(originalItem.category);
    expect(deserialized.image).toBe(originalItem.image);
    expect(deserialized.containerImage).toBe(originalItem.containerImage);
    expect(deserialized.item).toBe(originalItem.item);
    expect(deserialized.quantity_estimate).toBe(originalItem.quantity_estimate);
    expect(deserialized.storageLocation).toBe(originalItem.storageLocation);
    expect(deserialized.expirationDate).toBe(originalItem.expirationDate);
    expect(deserialized.expirationType).toBe(originalItem.expirationType);
    expect(deserialized.dateAdded).toBe(originalItem.dateAdded);
    expect(deserialized.lastRestocked).toBe(originalItem.lastRestocked);
    
    // Complex objects and arrays
    expect(deserialized.batches).toEqual(originalItem.batches);
    expect(deserialized.quantity).toEqual(originalItem.quantity);
    
    // Individual scalar fields
    expect(deserialized.notes).toBe(originalItem.notes);
    expect(deserialized.isStaple).toBe(originalItem.isStaple);
    expect(deserialized.isOpened).toBe(originalItem.isOpened);
    expect(deserialized.openedAt).toBe(originalItem.openedAt);
    expect(deserialized.openedExpiry).toBe(originalItem.openedExpiry);
    expect(deserialized.visualLevel).toBe(originalItem.visualLevel);
    expect(deserialized.is_frozen).toBe(originalItem.is_frozen);
    expect(deserialized.frozenAt).toBe(originalItem.frozenAt);
    expect(deserialized.freezerExpiry).toBe(originalItem.freezerExpiry);
    expect(deserialized.is_immortal).toBe(originalItem.is_immortal);
    expect(deserialized.is_leftover).toBe(originalItem.is_leftover);
    expect(deserialized.productRiskLevel).toBe(originalItem.productRiskLevel);
    expect(deserialized.expiryAlertShown).toBe(originalItem.expiryAlertShown);
  });

  it('handles backwards compatibility (deserializing old 13-field cache entries)', () => {
    // Represents a legacy serialized array with only 13 elements (up to index 12 - 'batches')
    const legacyArray = [
      'Produce', // category
      'https://example.com/image.jpg', // image
      '', // containerImage
      'Apples', // item
      '2.5', // quantity_estimate
      'fridge', // storageLocation
      'recipe-abc', // recipeId
      'Apple Pie', // recipeName
      '2026-06-30', // expirationDate
      'use-by', // expirationType
      '2026-06-10T12:00:00.000Z', // dateAdded
      '2026-06-12T12:00:00.000Z', // lastRestocked
      '[]' // batches
    ];

    const deserialized = InventoryCacheService.arrayToPantryItem('legacy-item-id', legacyArray);

    expect(deserialized.id).toBe('legacy-item-id');
    expect(deserialized.category).toBe('Produce');
    expect(deserialized.image).toBe('https://example.com/image.jpg');
    expect(deserialized.item).toBe('Apples');
    expect(deserialized.quantity_estimate).toBe('2.5');
    expect(deserialized.storageLocation).toBe('fridge');
    expect(deserialized.expirationDate).toBe('2026-06-30');
    expect(deserialized.expirationType).toBe('use-by');
    
    // New fields should fall back to sensible defaults or undefined
    expect(deserialized.quantity).toBeUndefined();
    expect(deserialized.notes).toBeUndefined();
    expect(deserialized.isStaple).toBe(false);
    expect(deserialized.isOpened).toBe(false);
    expect(deserialized.openedAt).toBeUndefined();
    expect(deserialized.openedExpiry).toBeUndefined();
    expect(deserialized.visualLevel).toBeUndefined();
    expect(deserialized.is_frozen).toBe(false);
    expect(deserialized.frozenAt).toBeUndefined();
    expect(deserialized.freezerExpiry).toBeUndefined();
    expect(deserialized.is_immortal).toBe(false);
    expect(deserialized.is_leftover).toBe(false);
    expect(deserialized.productRiskLevel).toBeUndefined();
    expect(deserialized.expiryAlertShown).toBe(false);
  });
});
