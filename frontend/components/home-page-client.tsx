"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  imageApi,
  type CollectionResponse,
  type FeaturedItemResponse
} from "@/lib/api";
import { cn } from "@/lib/utils";

const features = [
  {
    title: "Schema-first collecting",
    description:
      "Design a metadata schema per collection, then generate consistent item records in minutes."
  },
  {
    title: "Camera-ready uploads",
    description:
      "Capture and organize photos from desktop or mobile without leaving the catalog."
  },
  {
    title: "Share what matters",
    description:
      "Publish public collections with curated context while keeping private archives secure."
  }
];

const highlights = [
  "Field-level validation keeps data clean",
  "Search, filter, and sort across every item",
  "Image variants for fast browsing on any device",
  "Designed for historians, curators, and dealers"
];

const highlightCardClass =
  "border-amber-400 ring-2 ring-amber-300/70 shadow-[0_0_0_1px_rgba(251,191,36,0.85),0_18px_36px_-20px_rgba(217,119,6,0.75)]";

type HomePageClientProps = {
  featuredCollection: CollectionResponse | null;
  featuredCollectionError: boolean;
  featuredItems: FeaturedItemResponse[];
};

export function HomePageClient({
  featuredCollection,
  featuredCollectionError,
  featuredItems
}: HomePageClientProps) {
  const { isAuthenticated, logout, status: authStatus } = useAuth();
  const { t } = useI18n();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

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

  const showAuthenticatedCtas =
    authStatus === "authenticated" && isAuthenticated;
  const showFeaturedItems = featuredItems.length > 0;

  return (
    <main className="relative min-h-screen overflow-hidden bg-stone-50 text-stone-950">
      <div className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-amber-300/20 blur-[100px]" />
      <div className="pointer-events-none absolute top-[35%] left-[-8%] h-72 w-72 rounded-full bg-amber-200/25 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-15%] right-[-8%] h-80 w-80 rounded-full bg-stone-900/10 blur-[160px]" />
      <div className="relative z-10">
        <header className="px-6 py-6 lg:px-12">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.png"
                alt="Antique Catalogue"
                width={44}
                height={44}
                className="rounded-full"
              />
              <div>
                <p className="font-display text-lg tracking-tight">
                  {t("Antique Catalogue")}
                </p>
                <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
                  {t("Studio Archive")}
                </p>
              </div>
            </div>
            <nav className="hidden items-center gap-6 text-sm text-stone-600 md:flex">
              <Link href="/" className="font-medium text-stone-900">
                {t("Home")}
              </Link>
              <Link href="/explore" className="hover:text-stone-900">
                {t("Explore")}
              </Link>
              <Link href="/dashboard" className="hover:text-stone-900">
                {t("Dashboard")}
              </Link>
            </nav>
            <div className="flex items-center gap-3">
              {showAuthenticatedCtas ? (
                <Button
                  variant="secondary"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? t("Logging out...") : t("Log out")}
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    className="hidden sm:inline-flex"
                    asChild
                  >
                    <Link href="/login">{t("Log in")}</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/register">{t("Create account")}</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        <section>
          <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 pb-16 pt-10 lg:flex-row lg:items-center lg:px-12 lg:pt-20">
            <div className="flex-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
                {t("Collection intelligence")}
              </p>
              <h1 className="font-display mt-4 text-4xl leading-tight text-stone-900 sm:text-5xl lg:text-6xl">
                {t("Build living archives for objects that deserve a story.")}
              </h1>
              <p className="mt-6 max-w-xl text-base text-stone-600 sm:text-lg">
                {t(
                  "Antique Catalogue keeps provenance, condition, and imagery organized in one focused workspace. Create custom metadata schemas, upload photos from any device, and share curated collections with confidence."
                )}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button size="lg" asChild>
                  <Link href="/dashboard">{t("Go to dashboard")}</Link>
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <Link href="/explore">{t("Browse public collections")}</Link>
                </Button>
              </div>
              <div className="mt-10 grid gap-4 rounded-2xl border border-stone-200 bg-white/80 p-6 backdrop-blur">
                {highlights.map((item) => (
                  <div key={item} className="flex items-start gap-3 text-sm">
                    <span className="mt-1 h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-stone-700">{t(item)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
              <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-[0_20px_80px_-40px_rgba(15,23,42,0.4)]">
                <div className="flex items-center justify-between">
                  <p className="text-sm uppercase tracking-[0.3em] text-stone-400">
                    {t("Featured collection")}
                  </p>
                  {featuredCollection ? (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                      {t("Public")}
                    </span>
                  ) : null}
                </div>
                <h2 className="font-display mt-4 text-2xl text-stone-900">
                  {featuredCollection?.name ?? t("No featured collection yet")}
                </h2>
                {featuredCollection?.owner_username ? (
                  <p className="mt-2 text-xs text-stone-500">
                    {t("By")}{" "}
                    <Link
                      href={`/profile/${encodeURIComponent(featuredCollection.owner_username)}`}
                      className="font-medium text-amber-700 hover:text-amber-800"
                    >
                      @{featuredCollection.owner_username}
                    </Link>
                  </p>
                ) : null}
                <p className="mt-3 text-sm text-stone-600">
                  {featuredCollectionError
                    ? t("We couldn't load the featured collection.")
                    : featuredCollection?.description ??
                      t(
                        "Select a public collection to highlight on the homepage."
                      )}
                </p>
                <div className="mt-6 grid grid-cols-2 gap-4">
                  {(showFeaturedItems ? featuredItems : [0, 1, 2, 3]).map(
                    (item, index) => {
                      if (typeof item === "number") {
                        return (
                          <div
                            key={`placeholder-${item}`}
                            className="rounded-2xl border border-stone-100 bg-stone-50 p-4"
                          >
                            <div className="h-20 rounded-xl bg-gradient-to-br from-stone-200 via-stone-100 to-amber-100" />
                            <p className="mt-3 text-sm font-medium text-stone-800">
                              {featuredCollection
                                ? t("Featured item")
                                : t("Collection preview")}
                            </p>
                            <p className="text-xs text-stone-500">
                              {featuredCollection
                                ? t("Curated highlight")
                                : t("Select a collection to feature")}
                            </p>
                          </div>
                        );
                      }
                      const imageId = item.primary_image_id ?? null;
                      return (
                        <div
                          key={`${item.id}-${index}`}
                          className={cn(
                            "rounded-2xl border border-stone-100 bg-stone-50 p-4",
                            item.is_highlight ? highlightCardClass : null
                          )}
                        >
                          <div className="h-20 overflow-hidden rounded-xl">
                            {imageId ? (
                              <img
                                src={imageApi.url(imageId, "medium")}
                                alt={item.name}
                                className="block h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-full w-full bg-gradient-to-br from-stone-200 via-stone-100 to-amber-100" />
                            )}
                          </div>
                          <p className="mt-3 text-sm font-medium text-stone-800">
                            {item.name}
                          </p>
                          {item.owner_username ? (
                            <p className="mt-1 text-xs text-stone-500">
                              {t("By")}{" "}
                              <Link
                                href={`/profile/${encodeURIComponent(item.owner_username)}`}
                                className="font-medium text-amber-700 hover:text-amber-800"
                              >
                                @{item.owner_username}
                              </Link>
                            </p>
                          ) : null}
                          <p className="text-xs text-stone-500">
                            {item.notes
                              ? item.notes.slice(0, 50)
                              : t("Featured highlight")}
                          </p>
                        </div>
                      );
                    }
                  )}
                </div>
                <div className="mt-6 flex items-center justify-between rounded-2xl bg-stone-900 px-4 py-3 text-stone-100">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                      {t("Next intake")}
                    </p>
                    <p className="text-sm font-medium">
                      {featuredCollection
                        ? t("View the featured collection")
                        : t("Feature a public collection")}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" asChild>
                    <Link
                      href={
                        featuredCollection
                          ? `/explore/${featuredCollection.id}`
                          : "/explore"
                      }
                    >
                      {featuredCollection
                        ? t("View collection")
                        : t("Browse public")}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-12">
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg"
              >
                <h3 className="font-display text-xl text-stone-900">
                  {t(feature.title)}
                </h3>
                <p className="mt-3 text-sm text-stone-600">
                  {t(feature.description)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-stone-200 bg-stone-950">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 text-stone-100 lg:flex-row lg:items-center lg:justify-between lg:px-12">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-stone-400">
                {t("Ready to start")}
              </p>
              <h2 className="font-display mt-4 text-3xl">
                {t("Turn your archive into a living collection.")}
              </h2>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {showAuthenticatedCtas ? (
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? t("Logging out...") : t("Log out")}
                </Button>
              ) : (
                <>
                  <Button size="lg" variant="secondary" asChild>
                    <Link href="/register">{t("Create an account")}</Link>
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    className="text-stone-100"
                    asChild
                  >
                    <Link href="/login">{t("Sign in")}</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
