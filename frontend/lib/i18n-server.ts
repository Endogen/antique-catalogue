import { cookies, headers } from "next/headers";

import { DEFAULT_LOCALE, LOCALE_COOKIE, resolveLocale, type Locale } from "@/lib/i18n";

/**
 * Resolves the locale on the server so the first paint (and `<html lang>`)
 * already matches the visitor, instead of rendering English and correcting it
 * after hydration.
 *
 * An explicit cookie choice wins; otherwise we fall back to Accept-Language,
 * which is the same signal `navigator.language` exposes on the client.
 */
export const resolveServerLocale = async (): Promise<Locale> => {
  try {
    const cookieStore = await cookies();
    const stored = cookieStore.get(LOCALE_COOKIE)?.value;
    if (stored) {
      return resolveLocale(stored);
    }

    const requestHeaders = await headers();
    const acceptLanguage = requestHeaders.get("accept-language");
    if (acceptLanguage) {
      const preferred = acceptLanguage.split(",")[0]?.trim();
      return resolveLocale(preferred);
    }
  } catch {
    // Rendering outside a request scope: fall through to the default.
  }

  return DEFAULT_LOCALE;
};
