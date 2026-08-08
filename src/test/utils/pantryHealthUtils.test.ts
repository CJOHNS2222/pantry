import { describe, it, expect } from 'vitest';
import { getHealthGrade, calculatePantryHealth } from '../../../utils/pantryHealthUtils';
import { PantryItem } from '../../../types';

describe('pantryHealthUtils', () => {
  describe('getHealthGrade', () => {
    it('returns A+ for score >= 90', () => {
      const grade = getHealthGrade(95);
      expect(grade.letter).toBe('A+');
      expect(grade.label).toBe('Excellent');
      expect(grade.color).toBe('#22c55e');
    });

    it('returns A for score >= 80 and < 90', () => {
      expect(getHealthGrade(85).letter).toBe('A');
    });

    it('returns B for score >= 70 and < 80', () => {
      expect(getHealthGrade(75).letter).toBe('B');
    });

    it('returns C for score >= 60 and < 70', () => {
      expect(getHealthGrade(65).letter).toBe('C');
    });

    it('returns D for score >= 40 and < 60', () => {
      expect(getHealthGrade(50).letter).toBe('D');
    });

    it('returns F for score < 40', () => {
      expect(getHealthGrade(30).letter).toBe('F');
      expect(getHealthGrade(30).label).toBe('Critical');
    });
  });

  describe('calculatePantryHealth', () => {
    it('returns score 0 and empty factors for empty inventory', () => {
      const result = calculatePantryHealth([]);
      expect(result.score).toBe(0);
      expect(result.factors).toEqual([]);
      expect(result.expiringSoonCount).toBe(0);
    });

    it('calculates score and 5 factor breakdowns for populated inventory', () => {
      const now = new Date();
      const future10Days = new Date(now.getTime() + 10 * 86400000).toISOString();

      const items: PantryItem[] = [
        { id: '1', item: 'Milk', category: 'Dairy', expirationDate: future10Days, quantity: 1, dateAdded: now.toISOString() },
        { id: '2', item: 'Apples', category: 'Produce', expirationDate: future10Days, quantity: 5, dateAdded: now.toISOString() },
        { id: '3', item: 'Rice', category: 'Grains', expirationDate: future10Days, quantity: 2, dateAdded: now.toISOString() },
        { id: '4', item: 'Beans', category: 'Canned', expirationDate: future10Days, quantity: 3, dateAdded: now.toISOString() }
      ];

      const result = calculatePantryHealth(items);

      expect(result.score).toBeGreaterThan(50);
      expect(result.factors.length).toBe(5);

      const freshnessFactor = result.factors.find(f => f.label === 'Freshness');
      expect(freshnessFactor?.points).toBe(30);

      const varietyFactor = result.factors.find(f => f.label === 'Variety');
      expect(varietyFactor?.points).toBe(12); // 4 categories * 3
    });

    it('penalizes freshness score for expired and expiring-soon items', () => {
      const past3Days = new Date(Date.now() - 3 * 86400000).toISOString();
      const next1Day = new Date(Date.now() + 1 * 86400000).toISOString();

      const items: PantryItem[] = [
        { id: '1', item: 'Old Milk', category: 'Dairy', expirationDate: past3Days, quantity: 1 },
        { id: '2', item: 'Soon Spinach', category: 'Produce', expirationDate: next1Day, quantity: 1 }
      ];

      const result = calculatePantryHealth(items);
      expect(result.expiringSoonCount).toBe(1);

      const freshnessFactor = result.factors.find(f => f.label === 'Freshness');
      // 30 - (1 expired * 10) - (1 expiring soon * 3) = 17
      expect(freshnessFactor?.points).toBe(17);
    });
  });
});
