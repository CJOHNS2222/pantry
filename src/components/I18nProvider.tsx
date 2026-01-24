import React, { useState, useEffect, createContext, useContext } from 'react';
import { IntlProvider } from 'react-intl';
import { DEFAULT_LOCALE, LOCALES, Locale, getMessages, setLocale } from '../i18n';

interface I18nContextType {
  locale: Locale;
  changeLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

interface I18nProviderProps {
  children: React.ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [locale, setCurrentLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState(getMessages(DEFAULT_LOCALE));

  useEffect(() => {
    // Load saved locale from localStorage or browser preference
    const savedLocale = localStorage.getItem('locale') as Locale;
    const browserLocale = navigator.language.split('-')[0] as Locale;

    // Use saved locale, or browser locale if supported, or default
    const initialLocale = savedLocale && LOCALES[savedLocale]
      ? savedLocale
      : LOCALES[browserLocale]
      ? browserLocale
      : DEFAULT_LOCALE;

    if (initialLocale !== locale) {
      changeLocale(initialLocale);
    }
  }, []);

  const changeLocale = (newLocale: Locale) => {
    setCurrentLocale(newLocale);
    setMessages(getMessages(newLocale));
    setLocale(newLocale);
    localStorage.setItem('locale', newLocale);

    // Update document language attribute
    document.documentElement.lang = newLocale;
  };

  const contextValue: I18nContextType = {
    locale,
    changeLocale,
  };

  return (
    <I18nContext.Provider value={contextValue}>
      <IntlProvider
        locale={locale}
        messages={messages}
        defaultLocale={DEFAULT_LOCALE}
      >
        {children}
      </IntlProvider>
    </I18nContext.Provider>
  );
};

export default I18nProvider;