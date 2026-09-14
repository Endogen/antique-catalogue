import { DE_TRANSLATIONS, EN_TRANSLATIONS } from "@/lib/i18n/translations";

export const translations = {
  en: EN_TRANSLATIONS,
  de: DE_TRANSLATIONS
} as const;

export type Locale = keyof typeof translations;

export const DEFAULT_LOCALE: Locale = "en";

export const AVAILABLE_LOCALES: Locale[] = ["en", "de"];

/** Shared with the server so `<html lang>` matches what the client renders. */
export const LOCALE_COOKIE = "preferred-language";

export const resolveLocale = (value?: string | null): Locale => {
  if (!value) {
    return DEFAULT_LOCALE;
  }
  const normalized = value.toLowerCase();
  if (normalized.startsWith("de")) {
    return "de";
  }
  if (normalized.startsWith("en")) {
    return "en";
  }
  return DEFAULT_LOCALE;
};

export const translate = (
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string => {
  const table = translations[locale] ?? translations[DEFAULT_LOCALE];
  const fallback = translations[DEFAULT_LOCALE] ?? {};
  let value = table[key] ?? fallback[key] ?? key;

  if (!params) {
    return value;
  }

  Object.entries(params).forEach(([token, replacement]) => {
    value = value.replaceAll(`{${token}}`, String(replacement));
  });

  return value;
};

export const translateCount = (
  locale: Locale,
  count: number,
  singularKey: string,
  pluralKey: string,
  params?: Record<string, string | number>
): string =>
  translate(locale, count === 1 ? singularKey : pluralKey, {
    count,
    ...params
  });
