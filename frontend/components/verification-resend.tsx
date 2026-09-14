"use client";

import * as React from "react";
import { authApi, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";

export function VerificationResend() {
  const { t } = useI18n();
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <form className="mt-3 space-y-3" onSubmit={async (event) => {
      event.preventDefault();
      setPending(true); setError(null); setMessage(null);
      try {
        const result = await authApi.resendVerification(email.trim());
        setMessage(result.message);
      } catch (error) {
        setError(isApiError(error) ? error.detail : "Could not send email. Please retry.");
      } finally { setPending(false); }
    }}>
      <p className="text-sm text-muted-strong">{t("Expired or missing verification email? Request a new one here.")}</p>
      <label className="block text-sm" htmlFor="resend-email">{t("Email")}</label>
      <input id="resend-email" className="h-10 w-full rounded-xl border border-border px-3" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
      <Button type="submit" disabled={pending}>{t(pending ? "Sending..." : "Resend verification email")}</Button>
      {message && <p role="status" className="text-sm text-success">{t(message)}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
    </form>
  );
}
