export type Language = 'en' | 'de' | 'pl' | 'ro' | 'es';

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  de: 'Deutsch',
  pl: 'Polski',
  ro: 'Română',
  es: 'Español',
};

const VALID_LANGUAGES = new Set<string>(['en', 'de', 'pl', 'ro', 'es']);

/** Detect system language, fallback to 'en' */
export function detectLanguage(): Language {
  const lang = (navigator.language || '').toLowerCase().slice(0, 2);
  if (VALID_LANGUAGES.has(lang)) return lang as Language;
  return 'en';
}
