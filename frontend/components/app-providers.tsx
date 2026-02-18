"use client";

import * as React from "react";

import { AuthProvider } from "@/components/auth-provider";
import { I18nProvider } from "@/components/i18n-provider";
import { ToastProvider } from "@/components/ui/toast-provider";

export const AppProviders = ({
  children
}: {
  children: React.ReactNode;
}) => {
  return (
    <AuthProvider>
      <I18nProvider>
        <ToastProvider>{children}</ToastProvider>
      </I18nProvider>
    </AuthProvider>
  );
};
