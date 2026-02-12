"use client";

import * as React from "react";

import {
  AVAILABLE_LOCALES,
  DEFAULT_LOCALE,
  type Locale,
  resolveLocale,
  translate
} from "@/lib/i18n";

type I18nContextValue = {
  locale: Locale;
  availableLocales: Locale[];
  setLocale: (next: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = React.createContext<I18nContextValue | undefined>(undefined);

const STORAGE_KEY = "preferred-language";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(DEFAULT_LOCALE);

  React.useEffect(() => {
    const stored = typeof window !== "undefined"
      ? window.localStorage.getItem(STORAGE_KEY)
      : null;
    const browser = typeof window !== "undefined" ? window.navigator.language : null;
    const resolved = resolveLocale(stored ?? browser);
    setLocaleState(resolved);
  }, []);

  React.useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = React.useCallback((next: Locale) => {
    const resolved = resolveLocale(next);
    setLocaleState(resolved);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, resolved);
    }
  }, []);

  const t = React.useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    [locale]
  );

  const value = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      availableLocales: AVAILABLE_LOCALES,
      setLocale,
      t
    }),
    [locale, setLocale, t]
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
