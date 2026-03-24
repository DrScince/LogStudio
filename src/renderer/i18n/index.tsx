import React, { createContext, useContext, useState, useCallback } from 'react';
import en, { TranslationKeys } from './en';
import de from './de';
import pl from './pl';
import ro from './ro';
import es from './es';

export type Language = 'en' | 'de' | 'pl' | 'ro' | 'es';

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  de: 'Deutsch',
  pl: 'Polski',
  ro: 'Română',
  es: 'Español',
};

const translations: Record<Language, TranslationKeys> = { en, de, pl, ro, es };

/** Detect system language, fallback to 'en' */
function detectLanguage(): Language {
  const lang = (navigator.language || '').toLowerCase().slice(0, 2);
  if (lang in translations) return lang as Language;
  return 'en';
}

/** Simple template interpolation: replace {{key}} placeholders */
function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`
  );
}

/** Deeply get a nested key from the translation object using dot notation */
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return path; // key not found
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : path;
}

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
});

interface I18nProviderProps {
  children: React.ReactNode;
  initialLanguage?: Language;
  onLanguageChange?: (lang: Language) => void;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({
  children,
  initialLanguage,
  onLanguageChange,
}) => {
  const [language, setLanguageState] = useState<Language>(
    initialLanguage ?? detectLanguage()
  );

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    onLanguageChange?.(lang);
  }, [onLanguageChange]);

  const t = useCallback((key: string, vars?: Record<string, string | number>): string => {
    const translation = translations[language];
    const str = getNestedValue(translation as unknown as Record<string, unknown>, key);
    // Fallback to English if key not found in current language
    const finalStr = str === key
      ? getNestedValue(en as unknown as Record<string, unknown>, key)
      : str;
    return interpolate(finalStr, vars);
  }, [language]);

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export function useTranslation() {
  return useContext(I18nContext);
}

export { detectLanguage };
