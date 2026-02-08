"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/components/auth-provider";

const buildRedirectPath = (pathname: string | null) => {
  if (!pathname) {
    return "/login";
  }
  const encoded = encodeURIComponent(pathname);
  return `/login?next=${encoded}`;
};

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(buildRedirectPath(pathname));
    }
  }, [status, pathname, router]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 text-sm text-stone-500">
        Loading your workspace...
      </div>
    );
  }

  if (status === "unauthenticated") {
    return null;
  }

  return <>{children}</>;
};
