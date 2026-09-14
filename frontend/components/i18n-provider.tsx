"use client";

import * as React from "react";

import {
  AVAILABLE_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type Locale,
  resolveLocale,
  translate,
  translateCount
} from "@/lib/i18n";

type I18nContextValue = {
  locale: Locale;
  availableLocales: Locale[];
  setLocale: (next: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  tc: (
    count: number,
    singularKey: string,
    pluralKey: string,
    params?: Record<string, string | number>
  ) => string;
};

const I18nContext = React.createContext<I18nContextValue | undefined>(undefined);

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const persistLocale = (locale: Locale) => {
  if (typeof document === "undefined") {
    return;
  }
  // A cookie (not localStorage) so the server can render the right language
  // and `<html lang>` on the very first response.
  document.cookie = `${LOCALE_COOKIE}=${locale};path=/;max-age=${ONE_YEAR_SECONDS};samesite=lax`;
};

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  // Seeded from the server-resolved locale, so there is no English flash and
  // no hydration mismatch.
  const [locale, setLocaleState] = React.useState<Locale>(initialLocale);

  React.useEffect(() => {
    // Preserve choices made before locale persistence moved to a cookie.
    // An explicit cookie always wins over legacy browser storage.
    const cookie = document.cookie.split(";").find((part) => part.trim().startsWith(`${LOCALE_COOKIE}=`));
    if (cookie) {
      setLocaleState(resolveLocale(cookie.split("=").slice(1).join("=")));
      return;
    }
    try {
      const legacy = window.localStorage.getItem(LOCALE_COOKIE);
      if (legacy && AVAILABLE_LOCALES.includes(legacy as Locale)) {
        const migrated = resolveLocale(legacy);
        persistLocale(migrated);
        window.localStorage.removeItem(LOCALE_COOKIE);
        setLocaleState(migrated);
        return;
      }
    } catch { /* Storage can be disabled; keep the server's locale. */ }
    setLocaleState(initialLocale);
  }, [initialLocale]);

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = React.useCallback((next: Locale) => {
    const resolved = resolveLocale(next);
    setLocaleState(resolved);
    persistLocale(resolved);
  }, []);

  const t = React.useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale]
  );

  const tc = React.useCallback(
    (
      count: number,
      singularKey: string,
      pluralKey: string,
      params?: Record<string, string | number>
    ) => translateCount(locale, count, singularKey, pluralKey, params),
    [locale]
  );

  const value = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      availableLocales: AVAILABLE_LOCALES,
      setLocale,
      t,
      tc
    }),
    [locale, setLocale, t, tc]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}
