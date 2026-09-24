"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { authApi, isApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const createResetSchema = (t: (key: string) => string) =>
  z
    .object({
      token: z.string().trim().min(1, t("Reset token is required")),
      password: z.string().min(8, t("Password must be at least 8 characters")),
      confirmPassword: z
        .string()
        .min(1, t("Confirm your password"))
        .min(8, t("Password must be at least 8 characters"))
    })
    .refine((values) => values.password === values.confirmPassword, {
      path: ["confirmPassword"],
      message: t("Passwords do not match")
    });

type ResetFormValues = z.infer<ReturnType<typeof createResetSchema>>;

type SearchParamsLike = { get: (key: string) => string | null };

const getPrefillToken = (searchParams: SearchParamsLike) =>
  searchParams.get("token") ?? searchParams.get("t") ?? "";

const tips = [
  {
    title: "Fresh token",
    detail: "Tokens expire quickly for security, request a new one if needed."
  },
  {
    title: "New password",
    detail: "Use at least 8 characters with a mix of letters and numbers."
  },
  {
    title: "Sign in",
    detail: "Return to login once your reset is complete."
  }
];

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useAuth();
  const { t } = useI18n();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const resetSchema = React.useMemo(() => createResetSchema(t), [t]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      token: getPrefillToken(searchParams),
      password: "",
      confirmPassword: ""
    }
  });

  React.useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  React.useEffect(() => {
    const token = getPrefillToken(searchParams);
    if (token) {
      setValue("token", token);
    }
  }, [searchParams, setValue]);

  const onSubmit = async (values: ResetFormValues) => {
    setFormError(null);
    setSuccessMessage(null);
    try {
      const response = await authApi.resetPassword({
        token: values.token.trim(),
        password: values.password
      });
      setSuccessMessage(response.message || "Password reset successful.");
    } catch (error) {
      setFormError(
        isApiError(error)
          ? error.detail
          : "We couldn't reset your password. Please try again."
      );
    }
  };

  if (status === "authenticated") {
    return (
      <div className="col-span-full flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        {t("Redirecting to your workspace...")}
      </div>
    );
  }

  const isReset = Boolean(successMessage);

  return (
    <>
      <div className="flex flex-col">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
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
              <Eyebrow className="tracking-[0.35em]">
                {t("Studio Archive")}
              </Eyebrow>
            </div>
          </Link>
          <div className="flex items-center gap-3 text-sm text-muted-strong">
            <span className="hidden sm:inline">{t("Need a reset token?")}</span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/forgot-password">{t("Request one")}</Link>
            </Button>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-border bg-card/90 p-6 shadow-sm sm:mt-10 sm:p-8">
          <Eyebrow tone="brand" spacing="wide">
            {t("Set new password")}
          </Eyebrow>
          <SectionHeading as="h1" size="xl" className="mt-4">
            {t("Update your credentials.")}
          </SectionHeading>
          <p className="mt-3 text-sm text-muted-strong">
            {t(
              "Paste the reset token from your email and choose a new password to regain access to your archive."
            )}
          </p>

          {formError ? (
            <Alert
              role="alert"
              className="mt-6">
              {t(formError)}
            </Alert>
          ) : null}

          {successMessage ? (
            <Alert tone="success"
              role="status"
              className="mt-6">
              <p className="font-medium">{t(successMessage)}</p>
              <p className="mt-2 text-xs text-success">
                {t("You can now sign in with your updated password.")}
              </p>
            </Alert>
          ) : null}

          <form method="post" className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm font-medium text-muted-strong" htmlFor="token">
                {t("Reset token")}
              </label>
              <Input
                id="token"
                type="text"
                autoComplete="one-time-code"
                disabled={isReset}
                className="mt-2"
                aria-invalid={errors.token ? "true" : "false"}
                placeholder={t("Paste your reset token")}
                {...register("token")}
              />
              {errors.token ? (
                <p className="mt-2 text-xs text-destructive">
                  {errors.token.message}
                </p>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-strong" htmlFor="password">
                {t("New password")}
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                disabled={isReset}
                className="mt-2"
                aria-invalid={errors.password ? "true" : "false"}
                {...register("password")}
              />
              {errors.password ? (
                <p className="mt-2 text-xs text-destructive">
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            <div>
              <label
                className="text-sm font-medium text-muted-strong"
                htmlFor="confirmPassword"
              >
                {t("Confirm password")}
              </label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                disabled={isReset}
                className="mt-2"
                aria-invalid={errors.confirmPassword ? "true" : "false"}
                {...register("confirmPassword")}
              />
              {errors.confirmPassword ? (
                <p className="mt-2 text-xs text-destructive">
                  {errors.confirmPassword.message}
                </p>
              ) : null}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting || isReset}
            >
              {isReset
                ? t("Password updated")
                : isSubmitting
                ? t("Updating password...")
                : t("Reset password")}
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{t("Ready to return?")}</span>
            <Link
              href="/login"
              className="font-medium text-brand hover:text-brand-strong"
            >
              {t("Sign in")}
            </Link>
          </div>
        </section>
      </div>

      <aside>
        <Card tone="subtle" padding="lg">
          <Eyebrow spacing="wide">
            {t("Reset tips")}
          </Eyebrow>
          <SectionHeading size="xl" className="mt-4">
            {t("Keep your archive secure.")}
          </SectionHeading>
          <p className="mt-3 text-sm text-muted-strong">
            {t("Password resets protect your catalogue and keep your private notes secure.")}
          </p>
          <div className="mt-6 space-y-4">
            {tips.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-border bg-background/80 p-4"
              >
                <p className="text-sm font-medium text-foreground">{t(item.title)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{t(item.detail)}</p>
              </div>
            ))}
          </div>
        </Card>

        <div className="mt-6 rounded-3xl border border-panel-border/90 surface-panel p-6 text-panel-foreground shadow-sm">
          <Eyebrow tone="panel">
            {t("Studio reminder")}
          </Eyebrow>
          <p className="mt-3 text-sm text-panel-muted-foreground">
            {t(
              "Reset tokens are single-use and expire quickly. Request another token anytime you need."
            )}
          </p>
        </div>
      </aside>
    </>
  );
}

export default function ResetPasswordPage() {
  const { t } = useI18n();

  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
          {t("Loading...")}
        </div>
      }
    >
      <ResetPasswordContent />
    </React.Suspense>
  );
}
