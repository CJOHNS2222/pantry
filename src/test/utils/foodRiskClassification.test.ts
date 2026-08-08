import { describe, it, expect } from 'vitest';
import {
  getFoodRiskLevel,
  getNotificationTone,
  generateExpirationMessage,
  generateWasteNotificationMessage,
  generateNotificationStackMessage,
  FOOD_RISK_CATEGORIES,
  SPECIAL_CASE_ITEMS
} from '../../../utils/foodRiskClassification';

describe('foodRiskClassification', () => {
  describe('getFoodRiskLevel', () => {
    it('returns level 5 for high-risk meats and seafood', () => {
      expect(getFoodRiskLevel('Ground Beef')).toBe(5);
      expect(getFoodRiskLevel('Salmon Fillet')).toBe(5);
      expect(getFoodRiskLevel('Shrimp')).toBe(5);
    });

    it('returns level 4 for perishables, cooked meals, and leftovers', () => {
      expect(getFoodRiskLevel('Cooked Chicken')).toBe(4);
      expect(getFoodRiskLevel('Leftovers')).toBe(4);
      expect(getFoodRiskLevel('Milk')).toBe(4);
    });

    it('returns level 4 for special cases like cooked rice and deli meat', () => {
      expect(getFoodRiskLevel('Cooked Rice')).toBe(SPECIAL_CASE_ITEMS.cooked_rice.riskLevel);
      expect(getFoodRiskLevel('Sliced Deli Turkey')).toBe(SPECIAL_CASE_ITEMS.deli_meat.riskLevel);
    });

    it('returns level 3 for fresh produce', () => {
      expect(getFoodRiskLevel('Fresh Spinach')).toBe(3);
      expect(getFoodRiskLevel('Strawberries')).toBe(3);
    });

    it('returns level 2 for hardy fridge items', () => {
      expect(getFoodRiskLevel('Cheddar Cheese')).toBe(2);
      expect(getFoodRiskLevel('Greek Yogurt')).toBe(2);
    });

    it('returns level 1 for shelf-stable staples', () => {
      expect(getFoodRiskLevel('Whole Wheat Bread')).toBe(1);
      expect(getFoodRiskLevel('White Rice')).toBe(1);
      expect(getFoodRiskLevel('Black Tea')).toBe(1);
    });

    it('defaults to level 2 for unrecognized items', () => {
      expect(getFoodRiskLevel('Mysterious Item XYZ')).toBe(2);
    });
  });

  describe('getNotificationTone', () => {
    it('returns urgent directive tone for risk level 5', () => {
      const tone = getNotificationTone(5);
      expect(tone.tone).toBe('urgent_directive');
      expect(tone.priority).toBe('urgent');
      expect(tone.emoji).toBe('🚨');
    });

    it('returns helpful suggestive tone for risk level 4', () => {
      const tone = getNotificationTone(4);
      expect(tone.priority).toBe('high');
      expect(tone.emoji).toBe('🍗');
    });
  });

  describe('generateExpirationMessage', () => {
    it('generates specific alert for expired cooked rice', () => {
      const msg = generateExpirationMessage('Cooked Rice', 0, 4);
      expect(msg.title).toBe('Cooked Rice Alert!');
      expect(msg.message).toContain('Bacillus cereus');
    });

    it('generates high-risk alert for raw meat expiring today', () => {
      const msg = generateExpirationMessage('Ground Beef', 0, 5);
      expect(msg.title).toBe('Action Required!');
      expect(msg.message).toContain('by tonight');
    });

    it('generates produce warning for witing greens', () => {
      const msg = generateExpirationMessage('Spinach', 1, 3);
      expect(msg.title).toBe('Getting Sad');
    });
  });

  describe('generateWasteNotificationMessage', () => {
    it('generates standard toss item notification with shopping list action', () => {
      const msg = generateWasteNotificationMessage('Avocados');
      expect(msg.title).toBe('Item Tossed');
      expect(msg.message).toContain('Avocados');
      expect(msg.actionType).toBe('add_to_shopping');
    });
  });

  describe('generateNotificationStackMessage', () => {
    it('returns empty strings for empty item array', () => {
      const msg = generateNotificationStackMessage([]);
      expect(msg.title).toBe('');
      expect(msg.message).toBe('');
    });

    it('generates Danger Zone alert when urgent/high-risk items are expiring', () => {
      const msg = generateNotificationStackMessage([
        { itemName: 'Ground Beef', daysUntilExpiry: 0, riskLevel: 5 },
        { itemName: 'Fish', daysUntilExpiry: 0, riskLevel: 5 }
      ]);
      expect(msg.title).toBe('Danger Zone Items');
      expect(msg.message).toContain('2 items');
    });
  });
});
