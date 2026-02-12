"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";

const buildRedirectPath = (pathname: string | null) => {
  if (!pathname) {
    return "/login";
  }
  const encoded = encodeURIComponent(pathname);
  return `/login?next=${encoded}`;
};

const LOGOUT_REDIRECT_KEY = "antique_logout_redirect";

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();

  React.useEffect(() => {
    if (status === "unauthenticated") {
      if (typeof window !== "undefined") {
        const redirect = window.sessionStorage.getItem(LOGOUT_REDIRECT_KEY);
        if (redirect === "home") {
          window.sessionStorage.removeItem(LOGOUT_REDIRECT_KEY);
          router.replace("/");
          return;
        }
      }
      router.replace(buildRedirectPath(pathname));
    }
  }, [status, pathname, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 text-sm text-stone-500">
        {t("Loading your workspace...")}
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return <>{children}</>;
};
