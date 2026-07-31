/**
 * Currency display service.
 * All prices in this app are sourced/computed in USD (grocery price data, defaults, Open Prices).
 * This service converts USD amounts to the user's preferred display currency using free,
 * no-key exchange rates from frankfurter.app, cached in localStorage for 24h.
 */

import { log } from './logService';

export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'CAD', symbol: '$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: '$', label: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'MXN', symbol: '$', label: 'Mexican Peso' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real' },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan' },
];

const RATES_CACHE_KEY = 'currency_rates_cache_v1';
const RATES_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface RatesCache {
  rates: Record<string, number>;
  timestamp: number;
}

let activeCurrency = 'USD';
let activeRates: Record<string, number> = { USD: 1 };
let ratesPromise: Promise<Record<string, number>> | null = null;

function readCache(): RatesCache | null {
  try {
    const raw = localStorage.getItem(RATES_CACHE_KEY);
    return raw ? (JSON.parse(raw) as RatesCache) : null;
  } catch {
    return null;
  }
}

function writeCache(rates: Record<string, number>): void {
  try {
    localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates, timestamp: Date.now() }));
  } catch {
    // localStorage unavailable — non-fatal, just skip caching
  }
}

async function fetchRates(): Promise<Record<string, number>> {
  const cached = readCache();
  if (cached && Date.now() - cached.timestamp < RATES_CACHE_TTL_MS) {
    return cached.rates;
  }

  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD');
    if (!res.ok) throw new Error(`Frankfurter request failed: ${res.status}`);
    const data = await res.json();
    const rates: Record<string, number> = { USD: 1, ...data.rates };
    writeCache(rates);
    return rates;
  } catch (error) {
    log.warn(
      'Failed to fetch currency exchange rates, using cached/USD fallback',
      { error: error instanceof Error ? error.message : String(error) },
      'currencyService'
    );
    return cached?.rates ?? { USD: 1 };
  }
}

/** Fetches (and caches) USD exchange rates. Safe to call repeatedly — coalesces in-flight requests. */
function getExchangeRates(): Promise<Record<string, number>> {
  if (!ratesPromise) ratesPromise = fetchRates();
  return ratesPromise;
}

/** Loads exchange rates and sets the active display currency. Call once at app startup and whenever the user's currency preference changes. */
export async function initCurrency(preferredCode?: string): Promise<void> {
  if (preferredCode) activeCurrency = preferredCode;
  activeRates = await getExchangeRates();
}

export function setActiveCurrency(code: string): void {
  activeCurrency = code;
}

export function getActiveCurrency(): string {
  return activeCurrency;
}

export function convertFromUSD(amountUSD: number, currencyCode: string = activeCurrency): number {
  const rate = activeRates[currencyCode] ?? 1;
  return amountUSD * rate;
}

/** Formats a USD amount as a localized currency string in the active (or given) display currency. */
export function formatCurrency(amountUSD: number, currencyCode: string = activeCurrency): string {
  const converted = convertFromUSD(amountUSD, currencyCode);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: currencyCode === 'JPY' ? 0 : 2,
    }).format(converted);
  } catch {
    // Conversion/formatting failed — fall back to a plain USD-labeled amount rather than
    // silently mislabeling the raw USD value with the target currency's symbol.
    return `USD ${amountUSD.toFixed(2)}`;
  }
}
