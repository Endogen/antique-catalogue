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
import { Button } from "@/components/ui/button";
import { authApi, isApiError } from "@/lib/api";

const DELETE_TOKEN = "DELETE";

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout, refresh } = useAuth();
  const { t, locale, availableLocales, setLocale } = useI18n();
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
          <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
            {t("Settings")}
          </p>
          <h1 className="font-display mt-4 text-3xl text-stone-900">
            {t("Profile and security controls.")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-stone-600">
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
        <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                {t("Account overview")}
              </p>
              <h2 className="font-display mt-3 text-2xl text-stone-900">
                {t("Keep your archive identity current.")}
              </h2>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                user?.is_verified
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              <BadgeCheck className="h-3.5 w-3.5" />
              {user?.is_verified ? t("Verified") : t("Verification pending")}
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-stone-500">
                <Mail className="h-4 w-4 text-amber-700" />
                {t("Email address")}
              </div>
              <p className="mt-3 text-sm font-medium text-stone-900">
                {user?.email ?? "—"}
              </p>
              <p className="mt-2 text-xs text-stone-500">
                {t("Use this email to log in and receive notices.")}
              </p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-stone-500">
                <CalendarDays className="h-4 w-4 text-amber-700" />
                {t("Member since")}
              </div>
              <p className="mt-3 text-sm font-medium text-stone-900">
                {formatDate(user?.created_at)}
              </p>
              <p className="mt-2 text-xs text-stone-500">
                {t("Account created in your studio archive.")}
              </p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-stone-500">
                <ShieldCheck className="h-4 w-4 text-amber-700" />
                {t("Status")}
              </div>
              <p className="mt-3 text-sm font-medium text-stone-900">
                {user?.is_active ? t("Active") : t("Inactive")}
              </p>
              <p className="mt-2 text-xs text-stone-500">
                {t("Contact support if your account is inactive.")}
              </p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-stone-500">
                <KeyRound className="h-4 w-4 text-amber-700" />
                {t("Account ID")}
              </div>
              <p className="mt-3 text-sm font-medium text-stone-900">
                {user ? `#${user.id}` : "—"}
              </p>
              <p className="mt-2 text-xs text-stone-500">
                {t("Keep this handy for support requests.")}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 p-6 text-stone-100 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
            {t("Security snapshot")}
          </p>
          <h3 className="font-display mt-4 text-2xl">
            {t("Stay protected across every session.")}
          </h3>
          <p className="mt-3 text-sm text-stone-300">
            {t(
              "Rotate passwords regularly and verify your email to keep access under your control."
            )}
          </p>
          <div className="mt-6 space-y-3 text-sm text-stone-200">
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
        <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
            {t("Language preferences")}
          </p>
          <h2 className="font-display mt-3 text-2xl text-stone-900">
            {t("Choose your display language.")}
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            {t(
              "We default to your browser language. Choose another to override it."
            )}
          </p>

          <div className="mt-6">
            <label
              className="text-sm font-medium text-stone-700"
              htmlFor="language-select"
            >
              {t("Display language")}
            </label>
            <select
              id="language-select"
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
              value={locale}
              onChange={(event) => setLocale(event.target.value as typeof locale)}
            >
              {availableLocales.map((language) => (
                <option key={language} value={language}>
                  {language === "de" ? t("German") : t("English")}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-stone-500">
              {t("Changes apply immediately and stay on this device.")}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
            {t("Password access")}
          </p>
          <h2 className="font-display mt-3 text-2xl text-stone-900">
            {t("Send a reset link.")}
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            {t("We will email a secure reset link to the address below.")}
          </p>

          <form className="mt-6 space-y-4" onSubmit={handlePasswordReset}>
            <div>
              <label className="text-sm font-medium text-stone-700" htmlFor="reset-email">
                {t("Email address")}
              </label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                value={resetEmail}
                onChange={(event) => setResetEmail(event.target.value)}
              />
            </div>

            {resetState.status === "error" && resetState.message ? (
              <div
                role="alert"
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                {t(resetState.message)}
              </div>
            ) : null}
            {resetState.status === "sent" && resetState.message ? (
              <div
                role="status"
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              >
                {t(resetState.message)}
              </div>
            ) : null}

            <Button type="submit" disabled={resetState.status === "sending"}>
              {resetState.status === "sending"
                ? t("Sending...")
                : t("Send reset link")}
            </Button>
          </form>
        </div>

      </section>

      <section className="rounded-3xl border border-rose-200 bg-rose-50/60 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-rose-600">
              {t("Danger zone")}
            </p>
            <h2 className="font-display mt-3 text-2xl text-stone-900">
              {t("Permanently delete this account.")}
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-rose-700">
              {t(
                "This removes all collections, items, and images tied to your account. Type {token} to confirm.",
                { token: DELETE_TOKEN }
              )}
            </p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
            <ShieldAlert className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <div>
            <label className="text-sm font-medium text-rose-700" htmlFor="delete-confirm">
              {t("Confirmation phrase")}
            </label>
            <input
              id="delete-confirm"
              type="text"
              className="mt-2 w-full rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
              value={deletePhrase}
              onChange={(event) => setDeletePhrase(event.target.value)}
              placeholder={t("Type {token} to confirm", { token: DELETE_TOKEN })}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              className="w-full border-rose-200 text-rose-700 hover:bg-rose-100"
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
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-rose-200 bg-white/80 px-4 py-3 text-sm text-rose-700"
          >
            {t(deleteState.message)}
          </div>
        ) : null}
      </section>
    </div>
  );
}
