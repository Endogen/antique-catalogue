"use client";

import * as React from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "preferred-theme";

/**
 * Runs before first paint to apply the stored theme, so a dark-mode user never
 * sees a white flash. Kept in sync with the provider below.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||((!p||p==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

type ThemeContextValue = {
  preference: ThemePreference;
  theme: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
  toggle: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

const prefersDark = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const resolve = (preference: ThemePreference): ResolvedTheme =>
  preference === "system" ? (prefersDark() ? "dark" : "light") : preference;

const readStoredPreference = (): ThemePreference => {
  if (typeof window === "undefined") {
    return "system";
  }
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // Storage unavailable (private mode); fall back to the system setting.
  }
  return "system";
};

const applyTheme = (theme: ResolvedTheme) => {
  const root = document.documentElement;
  // Suppress transitions for one frame so the whole page doesn't cross-fade.
  root.classList.add("theme-transitions-disabled");
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  window.setTimeout(() => {
    root.classList.remove("theme-transitions-disabled");
  }, 0);
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The inline script already set the class; this state only mirrors it.
  const [preference, setPreferenceState] =
    React.useState<ThemePreference>("system");
  const [theme, setTheme] = React.useState<ResolvedTheme>("light");

  React.useEffect(() => {
    const stored = readStoredPreference();
    setPreferenceState(stored);
    setTheme(resolve(stored));
  }, []);

  React.useEffect(() => {
    if (preference !== "system") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const next = media.matches ? "dark" : "light";
      setTheme(next);
      applyTheme(next);
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [preference]);

  const setPreference = React.useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    const resolved = resolve(next);
    setTheme(resolved);
    applyTheme(resolved);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Preference simply won't persist.
    }
  }, []);

  const toggle = React.useCallback(() => {
    setPreference(resolve(preference) === "dark" ? "light" : "dark");
  }, [preference, setPreference]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ preference, theme, setPreference, toggle }),
    [preference, theme, setPreference, toggle]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
