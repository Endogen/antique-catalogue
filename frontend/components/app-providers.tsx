"use client";

import * as React from "react";

import { AuthProvider } from "@/components/auth-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { QueryProvider } from "@/components/query-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { ToastProvider } from "@/components/ui/toast-provider";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

export const AppProviders = ({
  children,
  initialLocale = DEFAULT_LOCALE
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) => {
  return (
    // QueryProvider is outermost so auth can clear cached data on sign-out.
    <QueryProvider>
      <ThemeProvider>
        <AuthProvider>
          <I18nProvider initialLocale={initialLocale}>
            <ConfirmProvider>
              <ToastProvider>{children}</ToastProvider>
            </ConfirmProvider>
          </I18nProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
};
