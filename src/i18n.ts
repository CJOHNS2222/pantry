import { createIntl, createIntlCache, IntlShape } from 'react-intl';

// Create the cache
const cache = createIntlCache();

// Default locale
export const DEFAULT_LOCALE = 'en';

// Available locales
export const LOCALES = {
  en: 'English',
} as const;

export type Locale = keyof typeof LOCALES;

// Import locale messages
import enMessages from './locales/en.json';

const messages: Record<Locale, any> = {
  en: enMessages,
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
export const t = (id: string, values?: Record<string, any>): string => {
  return getIntl().formatMessage({ id }, values);
};

export default intl;