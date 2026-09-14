"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  KeyRound,
  LogOut,
  Mail,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { useTheme, type ThemePreference } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { authApi, isApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Input, Select } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const DELETE_TOKEN = "DELETE";

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout, refresh } = useAuth();
  const { t, locale, availableLocales, setLocale } = useI18n();
  const { preference, setPreference } = useTheme();
  const [resetEmail, setResetEmail] = React.useState("");
  const [resetState, setResetState] = React.useState<{
    status: "idle" | "sending" | "sent" | "error";
    message?: string;
  }>({ status: "idle" });
  const [deletePhrase, setDeletePhrase] = React.useState("");
  const [deleteState, setDeleteState] = React.useState<{
    status: "idle" | "working" | "error";
    message?: string;
  }>({ status: "idle" });

  const formatDate = React.useCallback(
    (value?: string | null) => {
      if (!value) {
        return "—";
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

  React.useEffect(() => {
    if (user?.email && !resetEmail) {
      setResetEmail(user.email);
    }
  }, [user?.email, resetEmail]);

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setResetState({ status: "sending" });
    try {
      const email = resetEmail.trim();
      if (!email) {
        setResetState({
          status: "error",
          message: "Enter the email address for this account."
        });
        return;
      }
      await authApi.forgotPassword({ email });
      setResetState({
        status: "sent",
        message: "Password reset instructions are on the way."
      });
    } catch (error) {
      setResetState({
        status: "error",
        message: isApiError(error)
          ? error.detail
          : "We couldn't send the reset email."
      });
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteState({ status: "working" });
    try {
      await authApi.deleteAccount();
      await logout();
      router.replace("/");
    } catch (error) {
      setDeleteState({
        status: "error",
        message: isApiError(error)
          ? error.detail
          : "Account deletion failed. Please try again."
      });
    }
  };

  const confirmPhraseMatches = deletePhrase.trim().toUpperCase() === DELETE_TOKEN;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <Eyebrow tone="brand" spacing="wide">
            {t("Settings")}
          </Eyebrow>
          <SectionHeading as="h1" size="xl" className="mt-4">
            {t("Profile and security controls.")}
          </SectionHeading>
          <p className="mt-3 max-w-2xl text-sm text-muted-strong">
            {t(
              "Review account details, manage password access, and stay in control of your archive session."
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => refresh()}>
            <RefreshCcw className="h-4 w-4" />
            {t("Refresh profile")}
          </Button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <Eyebrow>
                {t("Account overview")}
              </Eyebrow>
              <SectionHeading className="mt-3">
                {t("Keep your archive identity current.")}
              </SectionHeading>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                user?.is_verified
                  ? "border-success-border bg-success-muted text-success"
                  : "border-brand-border bg-brand-muted text-brand"
              }`}
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              {user?.is_verified ? t("Verified") : t("Verification pending")}
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                <Mail className="h-4 w-4 text-brand" />
                {t("Email address")}
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                {user?.email ?? "—"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("Use this email to log in and receive notices.")}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-brand" />
                {t("Member since")}
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                {formatDate(user?.created_at)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("Account created in your studio archive.")}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-brand" />
                {t("Status")}
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                {user?.is_active ? t("Active") : t("Inactive")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("Contact support if your account is inactive.")}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
                <KeyRound className="h-4 w-4 text-brand" />
                {t("Account ID")}
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                {user ? `#${user.id}` : "—"}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("Keep this handy for support requests.")}
              </p>
            </div>
          </div>
        </Card>

        <div className="rounded-3xl border border-border surface-panel p-6 text-panel-foreground shadow-sm">
          <Eyebrow tone="subtle">
            {t("Security snapshot")}
          </Eyebrow>
          <SectionHeading as="h3" className="mt-4">
            {t("Stay protected across every session.")}
          </SectionHeading>
          <p className="mt-3 text-sm text-panel-muted-foreground">
            {t(
              "Rotate passwords regularly and verify your email to keep access under your control."
            )}
          </p>
          <div className="mt-6 space-y-3 text-sm text-panel-muted-foreground">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
              {t("Password reset links expire quickly for safety.")}
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
              {t("Verification status updates after email confirmation.")}
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
              {t("Delete actions remove collections, items, and images.")}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <Eyebrow>
            {t("Language preferences")}
          </Eyebrow>
          <SectionHeading className="mt-3">
            {t("Choose your display language.")}
          </SectionHeading>
          <p className="mt-3 text-sm text-muted-strong">
            {t(
              "We default to your browser language. Choose another to override it."
            )}
          </p>

          <div className="mt-6">
            <label
              className="text-sm font-medium text-muted-strong"
              htmlFor="language-select"
            >
              {t("Display language")}
            </label>
            <Select
              id="language-select"
              className="mt-2"
              value={locale}
              onChange={(event) => setLocale(event.target.value as typeof locale)}
            >
              {availableLocales.map((language) => (
                <option key={language} value={language}>
                  {language === "de" ? t("German") : t("English")}
                </option>
              ))}
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("Changes apply immediately and stay on this device.")}
            </p>
          </div>

          <div className="mt-6">
            <label
              className="text-sm font-medium text-muted-strong"
              htmlFor="theme-select"
            >
              {t("Appearance")}
            </label>
            <Select
              id="theme-select"
              className="mt-2"
              value={preference}
              onChange={(event) =>
                setPreference(event.target.value as ThemePreference)
              }
            >
              <option value="system">{t("Match system")}</option>
              <option value="light">{t("Light")}</option>
              <option value="dark">{t("Dark")}</option>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("Changes apply immediately and stay on this device.")}
            </p>
          </div>
        </Card>

        <Card>
          <Eyebrow>
            {t("Password access")}
          </Eyebrow>
          <SectionHeading className="mt-3">
            {t("Send a reset link.")}
          </SectionHeading>
          <p className="mt-3 text-sm text-muted-strong">
            {t("We will email a secure reset link to the address below.")}
          </p>

          <form className="mt-6 space-y-4" onSubmit={handlePasswordReset}>
            <div>
              <label className="text-sm font-medium text-muted-strong" htmlFor="reset-email">
                {t("Email address")}
              </label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                className="mt-2"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
              />
            </div>

            {resetState.status === "error" && resetState.message ? (
              <Alert
                role="alert">
                {t(resetState.message)}
              </Alert>
            ) : null}
            {resetState.status === "sent" && resetState.message ? (
              <Alert tone="success"
                role="status">
                {t(resetState.message)}
              </Alert>
            ) : null}

            <Button type="submit" disabled={resetState.status === "sending"}>
              {resetState.status === "sending"
                ? t("Sending...")
                : t("Send reset link")}
            </Button>
          </form>
        </Card>

      </section>

      <section className="rounded-3xl border border-destructive-border bg-destructive-muted/60 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Eyebrow className="text-destructive">
              {t("Danger zone")}
            </Eyebrow>
            <SectionHeading className="mt-3">
              {t("Permanently delete this account.")}
            </SectionHeading>
            <p className="mt-3 max-w-2xl text-sm text-destructive">
              {t(
                "This removes all collections, items, and images tied to your account. Type {token} to confirm.",
                { token: DELETE_TOKEN }
              )}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive-muted text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <div>
            <label className="text-sm font-medium text-destructive" htmlFor="delete-confirm">
              {t("Confirmation phrase")}
            </label>
            <input
              id="delete-confirm"
              type="text"
              className="mt-2 w-full rounded-xl border border-destructive-border bg-card px-4 py-3 text-sm text-foreground shadow-sm transition focus:border-destructive-border focus:outline-none focus:ring-2 focus:ring-destructive-border"
              value={deletePhrase}
              onChange={(event) => setDeletePhrase(event.target.value)}
              placeholder={t("Type {token} to confirm", { token: DELETE_TOKEN })}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="w-full border-destructive-border text-destructive hover:bg-destructive-muted"
              disabled={!confirmPhraseMatches || deleteState.status === "working"}
              onClick={handleDeleteAccount}
            >
              <Trash2 className="h-4 w-4" />
              {deleteState.status === "working"
                ? t("Deleting...")
                : t("Delete account")}
            </Button>
          </div>
        </div>

        {deleteState.status === "error" && deleteState.message ? (
          <Alert
            role="alert"
            className="mt-4 bg-card/80">
            {t(deleteState.message)}
          </Alert>
        ) : null}
      </section>
    </div>
  );
}
