"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { authApi, isApiError } from "@/lib/api";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const createForgotSchema = (t: (key: string) => string) =>
  z.object({
    email: z
      .string()
      .min(1, t("Email is required"))
      .pipe(z.email(t("Enter a valid email address")))
  });

type ForgotFormValues = z.infer<ReturnType<typeof createForgotSchema>>;

const steps = [
  {
    title: "Request",
    detail: "Share the email tied to your studio account."
  },
  {
    title: "Retrieve",
    detail: "Use the reset token sent to your inbox."
  },
  {
    title: "Reset",
    detail: "Set a new password and return to sign in."
  }
];

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { status } = useAuth();
  const { t } = useI18n();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(null);

  const forgotSchema = React.useMemo(() => createForgotSchema(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: {
      email: ""
    }
  });

  React.useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  const onSubmit = async (values: ForgotFormValues) => {
    setFormError(null);
    setSuccessMessage(null);
    try {
      const response = await authApi.forgotPassword({
        email: values.email
      });
      setSubmittedEmail(values.email);
      setSuccessMessage(
        response.message ||
          "If the account exists, a reset email has been sent."
      );
    } catch (error) {
      setFormError(
        isApiError(error)
          ? error.detail
          : "We couldn't send a reset email. Please try again."
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

  const isLocked = Boolean(successMessage);

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
            <span className="hidden sm:inline">{t("Remembered your password?")}</span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">{t("Sign in")}</Link>
            </Button>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-border bg-card/90 p-6 shadow-sm sm:mt-10 sm:p-8">
          <Eyebrow tone="brand" spacing="wide">
            {t("Password reset")}
          </Eyebrow>
          <SectionHeading as="h1" size="xl" className="mt-4">
            {t("Retrieve your access.")}
          </SectionHeading>
          <p className="mt-3 text-sm text-muted-strong">
            {t(
              "Enter the email tied to your archive. We will send a reset token you can use to set a new password."
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
              {submittedEmail ? (
                <p className="mt-2 text-xs text-success">
                  {t(
                    "Reset token sent to {email}. Use it on the reset page to choose a new password.",
                    { email: submittedEmail }
                  )}
                </p>
              ) : null}
            </Alert>
          ) : null}

          <form method="post" className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm font-medium text-muted-strong" htmlFor="email">
                {t("Email address")}
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                disabled={isLocked}
                className="mt-2"
                aria-invalid={errors.email ? "true" : "false"}
                {...register("email")}
              />
              {errors.email ? (
                <p className="mt-2 text-xs text-destructive">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting || isLocked}
            >
              {isLocked
                ? t("Check your inbox")
                : isSubmitting
                ? t("Sending reset email...")
                : t("Send reset email")}
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{t("Already have a token?")}</span>
            <Link
              href="/reset-password"
              className="font-medium text-brand hover:text-brand-strong"
            >
              {t("Reset your password")}
            </Link>
          </div>
        </section>
      </div>

      <aside>
        <div className="rounded-3xl border border-panel-border/90 surface-panel p-8 text-panel-foreground shadow-sm">
          <Eyebrow tone="panel" spacing="wide">
            {t("Reset flow")}
          </Eyebrow>
          <SectionHeading tone="panel" size="xl" className="mt-4">
            {t("Regain control in minutes.")}
          </SectionHeading>
          <p className="mt-3 text-sm text-panel-muted-foreground">
            {t(
              "Keep your archive secure with a short reset workflow designed to get you back in quickly."
            )}
          </p>
          <ul className="mt-6 space-y-4 text-sm">
            {steps.map((step, index) => (
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

        <Card tone="subtle" className="mt-6">
          <Eyebrow>
            {t("Security note")}
          </Eyebrow>
          <p className="mt-3 text-sm text-muted-strong">
            {t(
              "For privacy, we always respond with the same message even if the address is not on file."
            )}
          </p>
        </Card>
      </aside>
    </>
  );
}
