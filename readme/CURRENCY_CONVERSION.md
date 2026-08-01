# Currency Conversion

`services/currencyService.ts` converts USD-sourced grocery prices to a user-selected display currency for anywhere the app shows a price (shopping list cost estimates, price analytics, etc).

## How It Works

- All price data in the app is sourced/computed in **USD** (grocery price data, defaults, Open Prices integration - see `readme/OPEN_PRICES_INTEGRATION.md`).
- Exchange rates come from the free, no-API-key [frankfurter.app](https://frankfurter.app) rates API.
- Rates are cached in `localStorage` (`currency_rates_cache_v1`) for 24h (`RATES_CACHE_TTL_MS`) to avoid refetching on every render/session.
- No environment variable or API key is required - frankfurter.app is free and unauthenticated.

## Supported Currencies

`SUPPORTED_CURRENCIES` in `services/currencyService.ts`: USD, EUR, GBP, CAD, AUD, JPY, MXN, INR, BRL, CNY.

## Adding a Currency

Add an entry to `SUPPORTED_CURRENCIES` (`{ code, symbol, label }`) - frankfurter.app supports most ISO 4217 currency codes, so no other code changes are typically needed as long as the code is valid.

## User-Facing Setting

The user's preferred display currency is a per-user setting (Settings screen); conversion happens at render/format time from the cached USD→target rate, not by rewriting stored price data.
