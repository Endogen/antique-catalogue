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
import { VerificationResend } from "@/components/verification-resend";
import { authApi, isApiError } from "@/lib/api";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";

const createVerifySchema = (t: (key: string) => string) =>
  z.object({
    token: z.string().trim().min(1, t("Verification token is required"))
  });

type VerifyFormValues = z.infer<ReturnType<typeof createVerifySchema>>;

const nextSteps = [
  {
    title: "Locate",
    detail: "Check your inbox for the verification token."
  },
  {
    title: "Verify",
    detail: "Paste the token here to activate your account."
  },
  {
    title: "Sign in",
    detail: "Return to login once verification is complete."
  }
];

type SearchParamsLike = { get: (key: string) => string | null };

const getPrefillToken = (searchParams: SearchParamsLike) =>
  searchParams.get("token") ?? searchParams.get("t") ?? "";

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useAuth();
  const { t } = useI18n();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const verifySchema = React.useMemo(() => createVerifySchema(t), [t]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<VerifyFormValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: {
      token: getPrefillToken(searchParams)
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

  const onSubmit = async (values: VerifyFormValues) => {
    setFormError(null);
    setSuccessMessage(null);
    try {
      const response = await authApi.verifyEmail({
        token: values.token.trim()
      });
      setSuccessMessage(response.message || "Email verified successfully.");
    } catch (error) {
      setFormError(
        isApiError(error)
          ? error.detail
          : "We couldn't verify that token. Please try again."
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

  const isVerified = Boolean(successMessage);

  return (
    <>
      <div className="flex flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4">
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
            <span className="hidden sm:inline">{t("Already verified?")}</span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">{t("Sign in")}</Link>
            </Button>
          </div>
        </header>

        <section className="mt-10 rounded-3xl border border-border bg-card/90 p-8 shadow-sm">
          <Eyebrow tone="brand" spacing="wide">
            {t("Verify your email")}
          </Eyebrow>
          <SectionHeading as="h1" size="xl" className="mt-4">
            {t("Activate your archive.")}
          </SectionHeading>
          <p className="mt-3 text-sm text-muted-strong">
            {t(
              "Enter the verification token we sent to your inbox to complete setup."
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
                {t("You can now sign in and start building your collection archive.")}
              </p>
            </Alert>
          ) : null}

          <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm font-medium text-muted-strong" htmlFor="token">
                {t("Verification token")}
              </label>
              <Input
                id="token"
                type="text"
                autoComplete="one-time-code"
                disabled={isVerified}
                className="mt-2"
                aria-invalid={errors.token ? "true" : "false"}
                placeholder={t("Paste your token")}
                {...register("token")}
              />
              {errors.token ? (
                <p className="mt-2 text-xs text-destructive">
                  {errors.token.message}
                </p>
              ) : null}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting || isVerified}
            >
              {isVerified
                ? t("Email verified")
                : isSubmitting
                ? t("Verifying...")
                : t("Verify email")}
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{t("Need a fresh token?")}</span>
            <a
              href="#resend-verification"
              className="font-medium text-brand hover:text-brand-strong"
            >
              {t("Resend verification email")}
            </a>
          </div>
        </section>
      </div>

      <aside className="order-first lg:order-none">
        <div className="rounded-3xl border border-panel-border/90 surface-panel p-8 text-panel-foreground shadow-sm">
          <Eyebrow tone="subtle" spacing="wide">
            {t("Next steps")}
          </Eyebrow>
          <SectionHeading size="xl" className="mt-4">
            {t("Confirm your studio access.")}
          </SectionHeading>
          <p className="mt-3 text-sm text-panel-muted-foreground">
            {t(
              "Verification keeps your catalogue secure and ensures notifications land in the right place."
            )}
          </p>
          <ul className="mt-6 space-y-4 text-sm">
            {nextSteps.map((step, index) => (
              <li key={step.title} className="flex items-start gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-sm font-semibold text-foreground">
                  0{index + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-panel-foreground">
                    {t(step.title)}
                  </p>
                  <p className="mt-1 text-xs text-panel-muted-foreground">{t(step.detail)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <Card tone="subtle" id="resend-verification" className="mt-6">
          <Eyebrow>
            {t("Helpful tip")}
          </Eyebrow>
          <VerificationResend />
        </Card>
      </aside>
    </>
  );
}

export default function VerifyPage() {
  const { t } = useI18n();

  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
          {t("Loading...")}
        </div>
      }
    >
      <VerifyContent />
    </React.Suspense>
  );
}
