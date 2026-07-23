import React, { useState } from 'react';
import { Globe } from 'lucide-react';
import { LOCALES, Locale } from '../i18n';
import { useI18n } from './I18nProvider';

export const LanguageSelector: React.FC = () => {
  const { locale, changeLocale } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const handleLocaleChange = (newLocale: Locale) => {
    changeLocale(newLocale);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      >
        <Globe className="w-4 h-4" />
        <span>{LOCALES[locale]}</span>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          {Object.entries(LOCALES).map(([localeKey, localeName]) => (
            <button
              key={localeKey}
              onClick={() => handleLocaleChange(localeKey as Locale)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                locale === localeKey
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {localeName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;