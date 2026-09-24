"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Award,
  Camera,
  ExternalLink,
  Folder,
  Loader2,
  Package,
  Save,
  Star,
  Trash2,
  User
} from "lucide-react";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import {
  avatarUrl,
  isApiError,
  profileApi,
  type PublicProfileResponse
} from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { toLoadState } from "@/lib/query-state";
import { Card } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

export default function ProfilePage() {
  const { t, locale } = useI18n();
  const { refresh } = useAuth();
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: queryKeys.profile.me(),
    queryFn: ({ signal }) => profileApi.me({ signal })
  });
  const profileState = toLoadState<PublicProfileResponse | null>(
    profileQuery,
    "We couldn't load your profile.",
    null
  );
  const setProfileData = React.useCallback(
    (data: PublicProfileResponse) => {
      queryClient.setQueryData(queryKeys.profile.me(), data);
    },
    [queryClient]
  );
  const [username, setUsername] = React.useState("");
  const [saveState, setSaveState] = React.useState<{
    status: "idle" | "saving" | "saved" | "error";
    message?: string;
  }>({ status: "idle" });
  const [avatarState, setAvatarState] = React.useState<{
    status: "idle" | "uploading" | "deleting" | "error";
    message?: string;
  }>({ status: "idle" });
  const [avatarKey, setAvatarKey] = React.useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const { refetch: refetchProfile } = profileQuery;
  const loadProfile = React.useCallback(() => {
    void refetchProfile();
  }, [refetchProfile]);

  // Keep the editable field in step with whatever the server last returned.
  const loadedUsername = profileQuery.data?.username;
  React.useEffect(() => {
    if (loadedUsername) {
      setUsername(loadedUsername);
    }
  }, [loadedUsername]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaveState({ status: "saving" });
    try {
      const data = await profileApi.updateMe({ username });
      setProfileData(data);
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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarState({ status: "uploading" });
    try {
      const data = await profileApi.uploadAvatar(file);
      setProfileData(data);
      setAvatarKey((prev) => prev + 1);
      setAvatarState({ status: "idle" });
    } catch (error) {
      setAvatarState({
        status: "error",
        message: isApiError(error) ? error.detail : "We couldn't upload your avatar."
      });
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAvatarDelete = async () => {
    setAvatarState({ status: "deleting" });
    try {
      await profileApi.deleteAvatar();
      queryClient.setQueryData<PublicProfileResponse | undefined>(
        queryKeys.profile.me(),
        (previous) => (previous ? { ...previous, has_avatar: false } : previous)
      );
      setAvatarState({ status: "idle" });
    } catch (error) {
      setAvatarState({
        status: "error",
        message: isApiError(error) ? error.detail : "We couldn't remove your avatar."
      });
    }
  };

  const profile = profileState.data;

  return (
    <div className="space-y-8">
      <header className="rounded-3xl border border-border bg-card/90 p-6 shadow-xs">
        <Eyebrow tone="brand" spacing="wide">{t("Profile")}</Eyebrow>
        <SectionHeading as="h1" size="xl" className="mt-4">
          {t("Your public profile")}
        </SectionHeading>
        <p className="mt-3 max-w-2xl text-sm text-muted-strong">
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

      <section className="rounded-3xl border border-panel-border bg-panel-deep p-6 text-panel-foreground">
        <Eyebrow tone="panel">
          {t("Profile summary")}
        </Eyebrow>
        <p className="mt-3 text-sm text-panel-muted-foreground">
          {t("Member since {date}", {
            date: formatDate(profile?.created_at)
          })}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-panel-border bg-panel/70 p-3">
            <p className="inline-flex items-center gap-2 text-xs text-panel-muted-foreground">
              <Folder className="h-3.5 w-3.5 text-amber-300" />
              {t("Public collections")}
            </p>
            <p className="mt-2 text-xl font-semibold text-panel-foreground">
              {profile?.public_collection_count ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-panel-border bg-panel/70 p-3">
            <p className="inline-flex items-center gap-2 text-xs text-panel-muted-foreground">
              <Package className="h-3.5 w-3.5 text-amber-300" />
              {t("Public items")}
            </p>
            <p className="mt-2 text-xl font-semibold text-panel-foreground">
              {profile?.public_item_count ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-panel-border bg-panel/70 p-3">
            <p className="inline-flex items-center gap-2 text-xs text-panel-muted-foreground">
              <Star className="h-3.5 w-3.5 text-amber-300" />
              {t("Stars earned")}
            </p>
            <p className="mt-2 text-xl font-semibold text-panel-foreground">
              {profile?.earned_star_count ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-panel-border bg-panel/70 p-3">
            <p className="inline-flex items-center gap-2 text-xs text-panel-muted-foreground">
              <Award className="h-3.5 w-3.5 text-amber-300" />
              {t("Star rank")}
            </p>
            <p className="mt-2 text-xl font-semibold text-panel-foreground">
              #{profile?.star_rank ?? 1}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <Eyebrow>
            {t("Username")}
          </Eyebrow>
          <SectionHeading className="mt-3">
            {t("Choose your public username")}
          </SectionHeading>
          <p className="mt-2 text-sm text-muted-strong">
            {t("Use up to 12 characters with letters, numbers, underscores, or hyphens.")}
          </p>

          {profileState.status === "loading" && !profile ? (
            <p className="mt-6 text-sm text-muted-foreground">{t("Loading profile...")}</p>
          ) : profileState.status === "error" && !profile ? (
            <p className="mt-6 text-sm text-destructive">
              {t(profileState.error ?? "We couldn't load your profile.")}
            </p>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleSave}>
              <div>
                <label className="text-sm font-medium text-muted-strong" htmlFor="username">
                  {t("Public username")}
                </label>
                <Input
                  id="username"
                  type="text"
                  maxLength={12}
                  autoComplete="off"
                  className="mt-2"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>

              {saveState.status === "error" && saveState.message ? (
                <Alert>
                  {t(saveState.message)}
                </Alert>
              ) : null}
              {saveState.status === "saved" && saveState.message ? (
                <Alert tone="success">
                  {t(saveState.message)}
                </Alert>
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
        </Card>

        <Card>
          <Eyebrow>
            {t("Profile picture")}
          </Eyebrow>
          <SectionHeading className="mt-3">
            {t("Set your avatar")}
          </SectionHeading>
          <p className="mt-2 text-sm text-muted-strong">
            {t("Upload a photo that represents you. Max 5MB, JPEG or PNG.")}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-6">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-border bg-muted">
              {profile?.has_avatar ? (
                <Image
                  key={avatarKey}
                  src={avatarUrl(profile.id, "medium")}
                  alt={profile.username}
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <User className="h-10 w-10 text-panel-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarState.status === "uploading" || avatarState.status === "deleting"}
              >
                {avatarState.status === "uploading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {avatarState.status === "uploading"
                  ? t("Uploading...")
                  : t("Upload photo")}
              </Button>
              {profile?.has_avatar ? (
                <Button
                  variant="outline"
                  onClick={handleAvatarDelete}
                  disabled={avatarState.status === "uploading" || avatarState.status === "deleting"}
                  className="text-destructive hover:text-destructive"
                >
                  {avatarState.status === "deleting" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {avatarState.status === "deleting" ? t("Removing...") : t("Remove")}
                </Button>
              ) : null}
            </div>
          </div>

          {avatarState.status === "error" && avatarState.message ? (
            <Alert className="mt-4">
              {t(avatarState.message)}
            </Alert>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
