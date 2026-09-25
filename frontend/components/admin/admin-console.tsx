"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Crown,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Package,
  RefreshCcw,
  Sparkles,
  Users
} from "lucide-react";

import {
  type AdminSection,
  adminHref,
  useAdminParams
} from "@/components/admin/admin-ui";
import { CollectionsSection } from "@/components/admin/collections-section";
import { FeaturedSection } from "@/components/admin/featured-section";
import { ItemsSection } from "@/components/admin/items-section";
import { OverviewSection } from "@/components/admin/overview-section";
import { SpotlightSection } from "@/components/admin/spotlight-section";
import { UsersSection } from "@/components/admin/users-section";
import { useI18n } from "@/components/i18n-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/typography";
import { adminApi, getAdminToken, isApiError } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";

type NavEntry = {
  section: AdminSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
};

const SECTIONS: Record<AdminSection, React.ComponentType> = {
  overview: OverviewSection,
  users: UsersSection,
  collections: CollectionsSection,
  items: ItemsSection,
  featured: FeaturedSection,
  spotlight: SpotlightSection
};

function AdminLogin({
  onSignedIn,
  notice
}: {
  onSignedIn: () => void;
  notice: string | null;
}) {
  const { t } = useI18n();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await adminApi.login({ email, password });
      onSignedIn();
    } catch (caught) {
      setError(isApiError(caught) ? caught.detail : "Unable to sign in to the admin console.");
    } finally {
      setPending(false);
    }
  };

  const fieldClassName =
    "mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground shadow-xs transition focus:border-brand-border focus:outline-hidden focus:ring-2 focus:ring-ring";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <Card padding="lg" className="w-full max-w-md">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="Antique Catalogue" width={44} height={44} className="rounded-full" />
          <div>
            <p className="font-display text-lg tracking-tight">{t("Admin Console")}</p>
            <Eyebrow className="tracking-[0.35em]">{t("Antique Catalogue")}</Eyebrow>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-strong">
          {t("Sign in with your admin credentials to manage users, collections, and featured content.")}
        </p>

        {notice ? (
          <Alert tone="info" className="mt-4 px-3 py-2 text-xs">
            {t(notice)}
          </Alert>
        ) : null}
        {error ? <Alert className="mt-4 px-3 py-2 text-xs">{t(error)}</Alert> : null}

        <form method="post" className="mt-6 space-y-4" onSubmit={handleLogin}>
          <div>
            <label className="block text-xs font-medium text-muted-strong" htmlFor="admin-email">
              {t("Email")}
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={fieldClassName}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-strong" htmlFor="admin-password">
              {t("Password")}
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={fieldClassName}
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {t("Sign in")}
          </Button>
        </form>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-1.5 text-sm text-muted-strong transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("Back to the site")}
        </Link>
      </Card>
    </div>
  );
}

function SidebarNav({ groups, active }: { groups: { label?: string; entries: NavEntry[] }[]; active: AdminSection }) {
  return (
    <nav className="space-y-6">
      {groups.map((group, index) => (
        <div key={group.label ?? index} className="space-y-1">
          {group.label ? (
            <Eyebrow tone="panel" className="px-3 pb-1 text-[0.65rem]">
              {group.label}
            </Eyebrow>
          ) : null}
          {group.entries.map((entry) => {
            const isActive = entry.section === active;
            return (
              <Link
                key={entry.section}
                href={adminHref({ section: entry.section })}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
                  isActive
                    ? "bg-amber-100/10 text-amber-50 ring-1 ring-ring/30"
                    : "text-panel-muted-foreground hover:bg-panel-border/60 hover:text-panel-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-xl transition",
                    isActive
                      ? "bg-amber-200/15 text-amber-200"
                      : "bg-panel text-muted-subtle group-hover:text-panel-muted-foreground"
                  )}
                >
                  <entry.icon className="h-4 w-4" />
                </span>
                <span className="flex-1 font-medium">{entry.label}</span>
                {typeof entry.count === "number" ? (
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      isActive ? "text-amber-200/80" : "text-muted-subtle"
                    )}
                  >
                    {entry.count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** On phones and tablets the sections become a row of tabs under the header. */
function TabNav({ entries, active }: { entries: NavEntry[]; active: AdminSection }) {
  const activeRef = React.useRef<HTMLAnchorElement>(null);
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:px-6 lg:hidden [&::-webkit-scrollbar]:hidden">
      {entries.map((entry) => {
        const isActive = entry.section === active;
        return (
          <Link
            key={entry.section}
            ref={isActive ? activeRef : undefined}
            href={adminHref({ section: entry.section })}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-sm font-medium transition",
              isActive
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <entry.icon className={cn("h-4 w-4", isActive ? "text-brand" : "")} />
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Console({ onSignOut }: { onSignOut: (notice?: string) => void }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { section } = useAdminParams();
  const statsQuery = useQuery({
    queryKey: queryKeys.admin.stats(),
    queryFn: ({ signal }) => adminApi.stats({ signal })
  });
  const stats = statsQuery.data;

  // An expired admin token fails every read; send the admin back to sign in.
  const statsError = statsQuery.error;
  React.useEffect(() => {
    if (isApiError(statsError) && statsError.status === 401) {
      onSignOut("Your admin session has expired. Please sign in again.");
    }
  }, [onSignOut, statsError]);

  const groups: { label?: string; entries: NavEntry[] }[] = [
    { entries: [{ section: "overview", label: t("Overview"), icon: LayoutDashboard }] },
    {
      label: t("Moderation"),
      entries: [
        { section: "users", label: t("Users"), icon: Users, count: stats?.total_users },
        {
          section: "collections",
          label: t("Collections"),
          icon: FolderOpen,
          count: stats?.total_collections
        },
        { section: "items", label: t("Items"), icon: Package, count: stats?.total_items }
      ]
    },
    {
      label: t("Homepage"),
      entries: [
        { section: "featured", label: t("Featured"), icon: Crown },
        { section: "spotlight", label: t("Spotlight"), icon: Sparkles }
      ]
    }
  ];
  const Section = SECTIONS[section];

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="relative flex min-h-screen">
        <aside className="relative hidden h-screen w-72 shrink-0 flex-col overflow-y-auto overscroll-contain border-r border-panel-border/80 bg-panel-deep text-panel-foreground lg:sticky lg:top-0 lg:flex">
          <div className="pointer-events-none absolute -top-24 left-10 h-32 w-32 rounded-full bg-amber-300/20 blur-[90px]" />
          <div className="relative flex h-full flex-col gap-8 p-6">
            <Link href={adminHref({})} className="flex items-center gap-3">
              <Image src="/logo.png" alt="" width={44} height={44} className="rounded-full" />
              <div>
                <p className="font-display text-lg tracking-tight text-panel-foreground">
                  {t("Antique Catalogue")}
                </p>
                <Eyebrow tone="brand" className="tracking-[0.35em]">
                  {t("Admin Console")}
                </Eyebrow>
              </div>
            </Link>
            <SidebarNav groups={groups} active={section} />
            <Link
              href="/"
              className="mt-auto flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm text-panel-muted-foreground transition hover:bg-panel-border/60 hover:text-panel-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("Back to the site")}
            </Link>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-10">
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src="/logo.png"
                  alt=""
                  width={36}
                  height={36}
                  className="shrink-0 rounded-full lg:hidden"
                />
                <div className="min-w-0">
                  {/* Phones name the console; wider screens have room for more. */}
                  <Eyebrow tone="brand" spacing="wide" className="hidden truncate lg:block">
                    {t("Admin")}
                  </Eyebrow>
                  <p className="truncate font-display text-xl text-foreground">
                    <span className="lg:hidden">{t("Admin Console")}</span>
                    <span className="hidden lg:inline">{t("Catalogue administration")}</span>
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  className="h-10 w-10 rounded-full px-0"
                  onClick={() => void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all })}
                  aria-label={t("Refresh")}
                  title={t("Refresh")}
                >
                  <RefreshCcw className={cn("h-4 w-4", statsQuery.isFetching && "animate-spin")} />
                </Button>
                <ThemeToggle className="h-10 w-10 rounded-full" />
                <Button variant="secondary" className="rounded-full" onClick={() => onSignOut()}>
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">{t("Sign out")}</span>
                  <span className="sr-only sm:hidden">{t("Sign out")}</span>
                </Button>
              </div>
            </div>
            <TabNav entries={groups.flatMap((group) => group.entries)} active={section} />
          </header>

          <main className="flex-1 px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-10">
            <div className="mx-auto max-w-5xl">
              <Section key={section} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export function AdminConsole() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<"checking" | "signed-in" | "signed-out">("checking");
  const [notice, setNotice] = React.useState<string | null>(null);

  React.useEffect(() => {
    setStatus(getAdminToken() ? "signed-in" : "signed-out");
  }, []);

  const signOut = React.useCallback(
    (message?: string) => {
      adminApi.logout();
      // Drop every cached admin response so the next sign-in starts clean.
      queryClient.removeQueries({ queryKey: queryKeys.admin.all });
      setNotice(message ?? null);
      setStatus("signed-out");
    },
    [queryClient]
  );

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {t("Loading admin console...")}
      </div>
    );
  }

  if (status === "signed-out") {
    return (
      <AdminLogin
        notice={notice}
        onSignedIn={() => {
          setNotice(null);
          setStatus("signed-in");
        }}
      />
    );
  }

  return <Console onSignOut={signOut} />;
}
