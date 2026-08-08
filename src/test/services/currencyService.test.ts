import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initCurrency,
  setActiveCurrency,
  getActiveCurrency,
  convertFromUSD,
  formatCurrency,
  SUPPORTED_CURRENCIES
} from '../../../services/currencyService';

describe('currencyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setActiveCurrency('USD');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('SUPPORTED_CURRENCIES', () => {
    it('defines supported currency list with codes and symbols', () => {
      expect(SUPPORTED_CURRENCIES).toBeDefined();
      expect(SUPPORTED_CURRENCIES.length).toBeGreaterThan(0);
      const usd = SUPPORTED_CURRENCIES.find((c) => c.code === 'USD');
      expect(usd).toBeDefined();
      expect(usd?.symbol).toBe('$');
    });
  });

  describe('getActiveCurrency & setActiveCurrency', () => {
    it('defaults to USD and updates when setActiveCurrency is called', () => {
      expect(getActiveCurrency()).toBe('USD');
      setActiveCurrency('EUR');
      expect(getActiveCurrency()).toBe('EUR');
    });
  });

  describe('initCurrency & convertFromUSD', () => {
    it('fetches exchange rates and converts USD amounts', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ rates: { EUR: 0.9, GBP: 0.8 } })
      } as Response);

      await initCurrency('EUR');

      expect(getActiveCurrency()).toBe('EUR');
      expect(convertFromUSD(10, 'EUR')).toBe(9);
      expect(convertFromUSD(10, 'GBP')).toBe(8);
      expect(convertFromUSD(10, 'USD')).toBe(10);
    });

    it('falls back gracefully to 1.0 rate for unsupported/unmapped currencies', async () => {
      await initCurrency('USD');
      expect(convertFromUSD(10, 'UNKNOWN_CURRENCY')).toBe(10);
    });
  });

  describe('formatCurrency', () => {
    it('formats USD currency amounts correctly', () => {
      setActiveCurrency('USD');
      const formatted = formatCurrency(12.34, 'USD');
      expect(formatted).toContain('12.34');
    });

    it('formats JPY with 0 fraction digits', () => {
      const formatted = formatCurrency(1234.56, 'JPY');
      // Should not contain decimals for JPY
      expect(formatted).not.toContain('.56');
    });

    it('handles fallback string when formatting fails or unknown currency code is used', () => {
      const formatted = formatCurrency(25.5, 'INVALID_CODE');
      expect(formatted).toBe('USD 25.50');
    });
  });
});
