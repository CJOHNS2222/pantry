import { createIntl, createIntlCache, IntlShape } from 'react-intl';

// Create the cache
const cache = createIntlCache();

// Default locale
export const DEFAULT_LOCALE = 'en';

// Available locales
export const LOCALES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ru: 'Русский',
  zh: '中文',
  ja: '日本語',
} as const;

export type Locale = keyof typeof LOCALES;

// Import locale messages
import enMessages from './locales/en.json';
import esMessages from './locales/es.json';
import frMessages from './locales/fr.json';
import deMessages from './locales/de.json';
import ruMessages from './locales/ru.json';
import zhMessages from './locales/zh.json';
import jaMessages from './locales/ja.json';

// Function to flatten nested messages
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const flattenMessages = (nestedMessages: any, prefix = ''): Record<string, string> => {
  return Object.keys(nestedMessages).reduce((messages: Record<string, string>, key) => {
    const value = nestedMessages[key];
    const prefixedKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      messages[prefixedKey] = value;
    } else {
      Object.assign(messages, flattenMessages(value, prefixedKey));
    }

    return messages;
  }, {});
};

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
const messages: Record<Locale, any> = {
  en: flattenMessages(enMessages),
  es: flattenMessages(esMessages),
  fr: flattenMessages(frMessages),
  de: flattenMessages(deMessages),
  ru: flattenMessages(ruMessages),
  zh: flattenMessages(zhMessages),
  ja: flattenMessages(jaMessages),
};

// Create intl instance
let intl: IntlShape;

export const getIntl = (): IntlShape => {
  if (!intl) {
    intl = createIntl(
      {
        locale: DEFAULT_LOCALE,
        messages: messages[DEFAULT_LOCALE],
      },
      cache
    );
  }
  return intl;
};

export const setLocale = (locale: Locale): IntlShape => {
  intl = createIntl(
    {
      locale,
      messages: messages[locale],
    },
    cache
  );
  return intl;
};

export const getCurrentLocale = (): Locale => {
  return (intl?.locale as Locale) || DEFAULT_LOCALE;
};

export const getMessages = (locale: Locale = DEFAULT_LOCALE) => {
  return messages[locale];
};

// Utility function to get translated message
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export const t = (id: string, values?: Record<string, any>): string => {
  return getIntl().formatMessage({ id }, values);
};

export default getIntl();
