"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, X } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

type PublicHeaderProps = {
  className?: string;
};

/**
 * Header shared by every public page (home, explore, public profiles). On
 * phones the brand and one primary action stay visible and the rest folds
 * into a menu, so nothing wraps onto a second, misaligned row.
 */
export function PublicHeader({ className }: PublicHeaderProps) {
  const pathname = usePathname();
  const { isAuthenticated, logout, status } = useAuth();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const authenticated = status === "authenticated" && isAuthenticated;

  React.useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [menuOpen]);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const navLinks = [
    { href: "/", label: t("Home"), active: pathname === "/" },
    {
      href: "/explore",
      label: t("Explore"),
      active: pathname === "/explore" || pathname.startsWith("/explore/")
    },
    { href: "/dashboard", label: t("Dashboard"), active: false }
  ];

  const logoutButton = (fullWidth: boolean) => (
    <Button
      variant="secondary"
      className={cn(fullWidth && "w-full")}
      onClick={() => void handleLogout()}
      disabled={isLoggingOut}
    >
      <LogOut className="h-4 w-4" />
      {isLoggingOut ? t("Logging out...") : t("Log out")}
    </Button>
  );

  return (
    <header className={cn("relative z-20 px-4 py-4 sm:px-6 sm:py-6 lg:px-12", className)}>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Image
            src="/logo.png"
            alt="Antique Catalogue"
            width={44}
            height={44}
            className="h-10 w-10 shrink-0 rounded-full sm:h-11 sm:w-11"
          />
          <div className="min-w-0">
            <p className="truncate font-display text-base tracking-tight sm:text-lg">
              {t("Antique Catalogue")}
            </p>
            <Eyebrow className="truncate tracking-[0.35em]">
              {t("Studio Archive")}
            </Eyebrow>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-strong lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.active ? "page" : undefined}
              className={cn(
                "transition hover:text-foreground",
                link.active && "font-medium text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          {authenticated ? (
            logoutButton(false)
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">{t("Log in")}</Link>
              </Button>
              <Button asChild>
                <Link href="/register">{t("Create account")}</Link>
              </Button>
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 lg:hidden">
          {authenticated ? (
            <Button size="sm" asChild>
              <Link href="/dashboard">{t("Dashboard")}</Link>
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link href="/login">{t("Log in")}</Link>
            </Button>
          )}
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-card text-muted-strong transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="public-menu"
            aria-label={menuOpen ? t("Close menu") : t("Open menu")}
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div
          id="public-menu"
          className="absolute inset-x-4 top-full z-30 rounded-3xl border border-border bg-card p-4 shadow-xl sm:left-auto sm:right-6 sm:w-72 lg:hidden"
        >
          <nav className="grid gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={link.active ? "page" : undefined}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-sm transition hover:bg-accent",
                  link.active ? "bg-muted font-medium text-foreground" : "text-muted-strong"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
            <span className="text-sm text-muted-strong">{t("Appearance")}</span>
            <ThemeToggle />
          </div>
          <div className="mt-3 border-t border-border pt-3">
            {authenticated ? (
              logoutButton(true)
            ) : (
              <Button variant="outline" className="w-full" asChild>
                <Link href="/register">{t("Create account")}</Link>
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
