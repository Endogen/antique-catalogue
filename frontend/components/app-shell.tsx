"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Compass,
  Folder,
  Home,
  LayoutGrid,
  LogOut,
  Menu,
  Search,
  Settings2,
  Star,
  Sparkles,
  UserRound,
  X,
  Zap,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { Eyebrow } from "@/components/ui/typography";

type NavItem = {
  label: string;
  href: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  match: string[];
};

type SidebarContentProps = {
  onNavigate?: () => void;
  onClose?: () => void;
};

const SidebarContent = ({ onNavigate, onClose }: SidebarContentProps) => {
  const pathname = usePathname();
  const { t } = useI18n();
  const { user } = useAuth();

  const primaryNav: NavItem[] = [
    {
      label: t("Dashboard"),
      href: "/dashboard",
      description: t("Your private archive"),
      icon: LayoutGrid,
      match: ["/dashboard"]
    },
    {
      label: t("Speed Capture"),
      href: "/speed-capture",
      description: t("Quick photo-first cataloguing"),
      icon: Zap,
      match: ["/speed-capture"]
    },
    {
      label: t("Collections"),
      href: "/collections",
      description: t("Saved collections"),
      icon: Folder,
      match: ["/collections"]
    },
    {
      label: t("Schema templates"),
      href: "/schema-templates",
      description: t("Reusable metadata schemas"),
      icon: Sparkles,
      match: ["/schema-templates"]
    },
    {
      label: t("Stars"),
      href: "/stars",
      description: t("Starred items and collections"),
      icon: Star,
      match: ["/stars"]
    },
    {
      label: t("Profile"),
      href: "/profile",
      description: t("Your public profile"),
      icon: UserRound,
      match: ["/profile"]
    },
    {
      label: t("Settings"),
      href: "/settings",
      description: t("Profile and security"),
      icon: Settings2,
      match: ["/settings"]
    }
  ];

  const secondaryNav: NavItem[] = [
    {
      label: t("Home"),
      href: "/",
      description: t("Return to the homepage"),
      icon: Home,
      match: ["/"]
    },
    {
      label: t("Explore"),
      href: "/explore",
      description: t("Public collections"),
      icon: Compass,
      match: ["/explore"]
    }
  ];

  return (
    <div className="relative flex h-full flex-col gap-6">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-3"
          onClick={onNavigate}
        >
          <Image
            src="/logo.png"
            alt="Antique Catalogue"
            width={44}
            height={44}
            className="rounded-full"
          />
          <div>
            <p className="font-display text-lg tracking-tight text-panel-foreground">
              {t("Antique Catalogue")}
            </p>
            <Eyebrow tone="subtle" className="tracking-[0.35em]">
              {t("Studio Archive")}
            </Eyebrow>
          </div>
        </Link>
        {onClose ? (
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-panel-border text-panel-muted-foreground transition hover:border-muted-subtle hover:text-panel-foreground"
            onClick={onClose}
            aria-label={t("Close menu")}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav className="space-y-2">
        {primaryNav.map((item) => {
          const isActive = item.match.some((path) =>
            pathname === path || pathname.startsWith(`${path}/`)
          );
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-start gap-3 rounded-2xl px-3 py-3 transition",
                isActive
                  ? "bg-amber-100/10 text-amber-50 ring-1 ring-ring/30"
                  : "text-panel-muted-foreground hover:bg-panel-border/60 hover:text-panel-foreground"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl transition",
                  isActive
                    ? "bg-amber-200/15 text-amber-200"
                    : "bg-panel text-muted-subtle group-hover:text-panel-muted-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
              </span>
              <span>
                <span className="text-sm font-medium">{item.label}</span>
                <span
                  className={cn(
                    "mt-1 block text-xs",
                    isActive ? "text-amber-200/80" : "text-muted-subtle"
                  )}
                >
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="my-2 border-t border-panel-border/70" />

      <nav className="space-y-2">
        {secondaryNav.map((item) => {
          const isActive = item.match.some((path) =>
            pathname === path || pathname.startsWith(`${path}/`)
          );
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-start gap-3 rounded-2xl px-3 py-3 transition",
                isActive
                  ? "bg-amber-100/10 text-amber-50 ring-1 ring-ring/30"
                  : "text-panel-muted-foreground hover:bg-panel-border/60 hover:text-panel-foreground"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl transition",
                  isActive
                    ? "bg-amber-200/15 text-amber-200"
                    : "bg-panel text-muted-subtle group-hover:text-panel-muted-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
              </span>
              <span>
                <span className="text-sm font-medium">{item.label}</span>
                <span
                  className={cn(
                    "mt-1 block text-xs",
                    isActive ? "text-amber-200/80" : "text-muted-subtle"
                  )}
                >
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      {user ? (
        <div className="mt-auto border-t border-panel-border/70 pt-4">
          <Link
            href="/profile"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-2xl px-3 py-3 transition hover:bg-panel-border/60"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-200/15 font-display text-lg text-amber-200 ring-1 ring-ring/30">
              {user.username.charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-panel-foreground">
                @{user.username}
              </span>
              <span className="block truncate text-xs text-muted-subtle">
                {user.email}
              </span>
            </span>
          </Link>
        </div>
      ) : null}
    </div>
  );
};

type AppShellProps = {
  children: React.ReactNode;
};

export const AppShell = ({ children }: AppShellProps) => {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { logout } = useAuth();
  const { t } = useI18n();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState(
    searchParams.get("query") ?? ""
  );

  React.useEffect(() => {
    setSearchValue(searchParams.get("query") ?? "");
  }, [searchParams]);

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    const term = event.currentTarget.value.trim();
    if (!term) {
      return;
    }
    router.push(`/search?query=${encodeURIComponent(term)}`);
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }
    setIsLoggingOut(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("antique_logout_redirect", "home");
    }
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  React.useEffect(() => {
    if (!mobileOpen) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 right-[-6rem] h-72 w-72 rounded-full bg-amber-200/30 blur-[140px]" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-panel/10 blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-brand-muted/40 blur-[90px]" />
      </div>

      <div className="relative flex min-h-screen">
        <aside className="relative hidden h-screen w-72 flex-col overflow-y-auto overscroll-contain border-r border-panel-border/80 bg-panel-deep text-panel-foreground lg:sticky lg:top-0 lg:flex">
          <div className="pointer-events-none absolute -top-24 left-10 h-32 w-32 rounded-full bg-amber-300/20 blur-[90px]" />
          <div className="relative flex h-full flex-col p-6">
            <SidebarContent />
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur">
            <div className="flex items-center justify-between px-6 py-4 lg:px-10">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card/80 text-muted-strong shadow-sm transition hover:border-muted-subtle hover:text-foreground lg:hidden"
                  onClick={() => setMobileOpen(true)}
                  aria-label={t("Open menu")}
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div>
                  <Eyebrow tone="brand" spacing="wide">
                    {t("Workspace")}
                  </Eyebrow>
                  <p className="font-display text-xl text-foreground">
                    {t("Catalogue Studio")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle className="md:hidden" />
                <div className="hidden items-center gap-3 md:flex">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-subtle" />
                  <input
                    type="search"
                    placeholder={t("Search all items")}
                    className="h-10 w-64 rounded-full border border-border bg-card/90 pl-9 pr-3 text-sm text-muted-strong shadow-sm transition focus:border-brand-border focus:outline-none focus:ring-2 focus:ring-ring"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? t("Logging out...") : t("Log out")}
                </Button>
                <ThemeToggle />
                </div>
              </div>
            </div>
            <div className="px-6 pb-4 md:hidden">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-subtle" />
                  <input
                    type="search"
                    placeholder={t("Search all items")}
                    className="h-10 w-full rounded-full border border-border bg-card/90 pl-9 pr-3 text-sm text-muted-strong shadow-sm transition focus:border-brand-border focus:outline-none focus:ring-2 focus:ring-ring"
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    onKeyDown={handleSearchKeyDown}
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? t("Logging out...") : t("Log out")}
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-6 pb-12 pt-8 lg:px-10">
            {children}
          </main>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-stone-950/60"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-80 max-w-[85vw] overflow-y-auto overscroll-contain border-r border-panel-border bg-panel-deep p-6 text-panel-foreground shadow-2xl">
            <SidebarContent
              onNavigate={() => setMobileOpen(false)}
              onClose={() => setMobileOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
