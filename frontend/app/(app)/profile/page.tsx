"use client";

import * as React from "react";
import Link from "next/link";
import {
  Award,
  ExternalLink,
  Folder,
  Loader2,
  Package,
  Save,
  Star
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  isApiError,
  profileApi,
  type PublicProfileResponse
} from "@/lib/api";

type ProfileState = {
  status: "loading" | "ready" | "error";
  data: PublicProfileResponse | null;
  error?: string;
};

export default function ProfilePage() {
  const { t, locale } = useI18n();
  const { refresh } = useAuth();
  const [profileState, setProfileState] = React.useState<ProfileState>({
    status: "loading",
    data: null
  });
  const [username, setUsername] = React.useState("");
  const [saveState, setSaveState] = React.useState<{
    status: "idle" | "saving" | "saved" | "error";
    message?: string;
  }>({ status: "idle" });

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
    setProfileState((prev) => ({
      ...prev,
      status: "loading",
      error: undefined
    }));
    try {
      const data = await profileApi.me();
      setProfileState({
        status: "ready",
        data
      });
      setUsername(data.username);
    } catch (error) {
      setProfileState((prev) => ({
        status: "error",
        data: prev.data,
        error: isApiError(error) ? error.detail : "We couldn't load your profile."
      }));
    }
  }, []);

  React.useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaveState({ status: "saving" });
    try {
      const data = await profileApi.updateMe({ username });
      setProfileState({
        status: "ready",
        data
      });
      setUsername(data.username);
      setSaveState({
        status: "saved",
        message: "Username updated."
      });
      await refresh();
    } catch (error) {
      setSaveState({
        status: "error",
        message: isApiError(error) ? error.detail : "We couldn't update your username."
      });
    }
  };

  const profile = profileState.data;

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.4em] text-amber-700">{t("Profile")}</p>
        <h1 className="font-display mt-4 text-3xl text-stone-900">
          {t("Your public profile")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-stone-600">
          {t("Manage how your public archive identity appears to everyone.")}
        </p>
        {profile?.username ? (
          <div className="mt-5">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/profile/${encodeURIComponent(profile.username)}`}>
                <ExternalLink className="h-4 w-4" />
                {t("View public profile")}
              </Link>
            </Button>
          </div>
        ) : null}
      </header>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
            {t("Username")}
          </p>
          <h2 className="font-display mt-3 text-2xl text-stone-900">
            {t("Choose your public username")}
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            {t("Use up to 12 characters with letters, numbers, underscores, or hyphens.")}
          </p>

          {profileState.status === "loading" && !profile ? (
            <p className="mt-6 text-sm text-stone-500">{t("Loading profile...")}</p>
          ) : profileState.status === "error" && !profile ? (
            <p className="mt-6 text-sm text-rose-600">
              {t(profileState.error ?? "We couldn't load your profile.")}
            </p>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleSave}>
              <div>
                <label className="text-sm font-medium text-stone-700" htmlFor="username">
                  {t("Public username")}
                </label>
                <input
                  id="username"
                  type="text"
                  maxLength={12}
                  autoComplete="off"
                  className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>

              {saveState.status === "error" && saveState.message ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {t(saveState.message)}
                </div>
              ) : null}
              {saveState.status === "saved" && saveState.message ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {t(saveState.message)}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={saveState.status === "saving"}>
                  {saveState.status === "saving" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {saveState.status === "saving" ? t("Saving...") : t("Save username")}
                </Button>
                <Button variant="outline" type="button" onClick={() => loadProfile()}>
                  {t("Refresh")}
                </Button>
              </div>
            </form>
          )}
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
            {t("Public stats")}
          </p>
          <div className="mt-5 rounded-2xl border border-stone-900 bg-stone-950 p-4 text-stone-100">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
              {t("Profile summary")}
            </p>
            <p className="mt-3 text-sm text-stone-300">
              {t("Member since {date}", {
                date: formatDate(profile?.created_at)
              })}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-stone-800 bg-stone-900/70 p-3">
                <p className="inline-flex items-center gap-2 text-xs text-stone-300">
                  <Folder className="h-3.5 w-3.5 text-amber-300" />
                  {t("Public collections")}
                </p>
                <p className="mt-2 text-xl font-semibold text-stone-100">
                  {profile?.public_collection_count ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-stone-800 bg-stone-900/70 p-3">
                <p className="inline-flex items-center gap-2 text-xs text-stone-300">
                  <Package className="h-3.5 w-3.5 text-amber-300" />
                  {t("Public items")}
                </p>
                <p className="mt-2 text-xl font-semibold text-stone-100">
                  {profile?.public_item_count ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-stone-800 bg-stone-900/70 p-3">
                <p className="inline-flex items-center gap-2 text-xs text-stone-300">
                  <Star className="h-3.5 w-3.5 text-amber-300" />
                  {t("Stars earned")}
                </p>
                <p className="mt-2 text-xl font-semibold text-stone-100">
                  {profile?.earned_star_count ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-stone-800 bg-stone-900/70 p-3">
                <p className="inline-flex items-center gap-2 text-xs text-stone-300">
                  <Award className="h-3.5 w-3.5 text-amber-300" />
                  {t("Star rank")}
                </p>
                <p className="mt-2 text-xl font-semibold text-stone-100">
                  #{profile?.star_rank ?? 1}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
