"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Award, Folder, Star } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { isApiError, profileApi, type PublicProfileResponse } from "@/lib/api";

type LoadState = {
  status: "loading" | "ready" | "error";
  data: PublicProfileResponse | null;
  error?: string;
};

export default function PublicProfilePage() {
  const params = useParams();
  const usernameParam = Array.isArray(params?.username)
    ? params.username[0]
    : params?.username;
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [state, setState] = React.useState<LoadState>({
    status: "loading",
    data: null
  });

  const formatDate = React.useCallback(
    (value: string | null | undefined) => {
      if (!value) {
        return "-";
      }
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return value;
      }
      return new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        year: "numeric"
      }).format(parsed);
    },
    [locale]
  );

  const loadProfile = React.useCallback(async () => {
    if (!usernameParam) {
      setState({
        status: "error",
        data: null,
        error: "Profile not found"
      });
      return;
    }
    setState((prev) => ({
      ...prev,
      status: "loading",
      error: undefined
    }));
    try {
      const data = await profileApi.getPublic(usernameParam);
      setState({
        status: "ready",
        data
      });
    } catch (error) {
      setState((prev) => ({
        status: "error",
        data: prev.data,
        error: isApiError(error) ? error.detail : "Profile not found"
      }));
    }
  }, [usernameParam]);

  React.useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const isOwnProfile = state.data?.username === user?.username;

  return (
    <main className="min-h-screen bg-stone-50 text-stone-950">
      <header className="border-b border-stone-200/80 bg-stone-50/80 px-6 py-6 backdrop-blur lg:px-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Antique Catalogue"
              width={44}
              height={44}
              className="rounded-full"
            />
            <div>
              <p className="font-display text-lg tracking-tight">{t("Antique Catalogue")}</p>
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
                {t("Studio Archive")}
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/explore">
                <ArrowLeft className="h-4 w-4" />
                {t("Back to explore")}
              </Link>
            </Button>
            {isOwnProfile ? (
              <Button variant="secondary" size="sm" asChild>
                <Link href="/profile">{t("Edit profile")}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10 lg:px-12">
        {state.status === "loading" ? (
          <div className="rounded-3xl border border-dashed border-stone-200 bg-white/80 p-8 text-sm text-stone-500">
            {t("Loading profile...")}
          </div>
        ) : state.status === "error" || !state.data ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-8">
            <p className="text-sm font-medium text-rose-700">{t("Profile not found")}</p>
            <p className="mt-2 text-sm text-rose-600">
              {t(state.error ?? "Profile not found")}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.4em] text-amber-700">{t("Profile")}</p>
              <h1 className="font-display mt-4 text-3xl text-stone-900">
                @{state.data.username}
              </h1>
              <p className="mt-3 text-sm text-stone-600">
                {t("Member since {date}", { date: formatDate(state.data.created_at) })}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm">
                <p className="text-xs text-stone-500">{t("Public collections")}</p>
                <p className="mt-2 text-2xl font-semibold text-stone-900">
                  {state.data.public_collection_count}
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm">
                <p className="text-xs text-stone-500">{t("Public items")}</p>
                <p className="mt-2 text-2xl font-semibold text-stone-900">
                  {state.data.public_item_count}
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm">
                <p className="text-xs text-stone-500">{t("Stars earned")}</p>
                <p className="mt-2 text-2xl font-semibold text-stone-900">
                  {state.data.earned_star_count}
                </p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm">
                <p className="text-xs text-stone-500">{t("Star rank")}</p>
                <p className="mt-2 text-2xl font-semibold text-stone-900">
                  #{state.data.star_rank}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-stone-900 bg-stone-950 p-5 text-stone-100">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                {t("Public summary")}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-stone-300">
                <span className="inline-flex items-center gap-2">
                  <Folder className="h-4 w-4 text-amber-300" />
                  {state.data.public_collection_count}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-300" />
                  {state.data.earned_star_count}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-300" />
                  #{state.data.star_rank}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
