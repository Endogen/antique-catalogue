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
import { Card } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const createRegisterSchema = (t: (key: string) => string) =>
  z
    .object({
      email: z
        .string()
        .min(1, t("Email is required"))
        .pipe(z.email(t("Enter a valid email address"))),
      password: z.string().min(8, t("Password must be at least 8 characters")),
      confirmPassword: z
        .string()
        .min(1, t("Confirm your password"))
        .min(8, t("Password must be at least 8 characters"))
    })
    .refine((values) => values.password === values.confirmPassword, {
      path: ["confirmPassword"],
      error: t("Passwords do not match")
    });

type RegisterFormValues = z.infer<ReturnType<typeof createRegisterSchema>>;

const steps = [
  {
    title: "Design",
    detail: "Create collection-specific metadata schemas."
  },
  {
    title: "Document",
    detail: "Capture provenance, notes, and condition."
  },
  {
    title: "Share",
    detail: "Publish public collections when ready."
  }
];

export default function RegisterPage() {
  const router = useRouter();
  const { status } = useAuth();
  const { t } = useI18n();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(null);
  const [requiresVerification, setRequiresVerification] = React.useState(false);

  const registerSchema = React.useMemo(() => createRegisterSchema(t), [t]);

  const {
    register: formRegister,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: ""
    }
  });

  React.useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  const onSubmit = async (values: RegisterFormValues) => {
    setFormError(null);
    setSuccessMessage(null);
    setRequiresVerification(false);
    try {
      const response = await authApi.register({
        email: values.email,
        password: values.password
      });
      setSubmittedEmail(values.email);
      setRequiresVerification(response.message === "Verification email sent");
      setSuccessMessage(
        response.message || "Check your inbox for the verification link."
      );
    } catch (error) {
      setFormError(
        isApiError(error)
          ? error.detail
          : "We couldn't create your account. Please try again."
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

  const isLocked = Boolean(submittedEmail);

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
            <span className="hidden sm:inline">{t("Already have an account?")}</span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">{t("Sign in")}</Link>
            </Button>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-border bg-card/90 p-6 shadow-sm sm:mt-10 sm:p-8">
          <Eyebrow tone="brand" spacing="wide">
            {t("Create your studio")}
          </Eyebrow>
          <SectionHeading as="h1" size="xl" className="mt-4">
            {t("Start cataloguing in minutes.")}
          </SectionHeading>
          <p className="mt-3 text-sm text-muted-strong">
            {t("Build a secure, searchable archive for every piece you collect.")}
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
              {submittedEmail && requiresVerification ? (
                <p className="mt-2 text-xs text-success">
                  {t(
                    "We sent a verification token to {email}. Enter it on the verification page to activate your account.",
                    { email: submittedEmail }
                  )}
                </p>
              ) : null}
              {submittedEmail && !requiresVerification ? (
                <p className="mt-2 text-xs text-success">
                  {t("You can sign in now with the email and password you just created.")}
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
                {...formRegister("email")}
              />
              {errors.email ? (
                <p className="mt-2 text-xs text-destructive">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-medium text-muted-strong" htmlFor="password">
                {t("Password")}
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                disabled={isLocked}
                className="mt-2"
                aria-invalid={errors.password ? "true" : "false"}
                {...formRegister("password")}
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
                disabled={isLocked}
                className="mt-2"
                aria-invalid={errors.confirmPassword ? "true" : "false"}
                {...formRegister("confirmPassword")}
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
              disabled={isSubmitting || isLocked}
            >
              {isLocked && requiresVerification
                ? t("Check your email")
                : isLocked
                ? t("Account created")
                : isSubmitting
                ? t("Creating account...")
                : t("Create account")}
            </Button>
          </form>

          {submittedEmail && !requiresVerification ? (
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">{t("Sign in")}</Link>
              </Button>
            </div>
          ) : null}

          <p className="mt-6 text-xs text-muted-foreground">
            {t(
              "By creating an account you agree to receive verification emails from Antique Catalogue."
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{t("Already verified?")}</span>
            <Link
              href="/verify"
              className="font-medium text-brand hover:text-brand-strong"
            >
              {t("Enter verification token")}
            </Link>
          </div>
        </section>
      </div>

      <aside>
        <Card tone="subtle" padding="lg">
          <Eyebrow spacing="wide">
            {t("How it works")}
          </Eyebrow>
          <SectionHeading size="xl" className="mt-4">
            {t("Your collection studio, built for detail.")}
          </SectionHeading>
          <p className="mt-3 text-sm text-muted-strong">
            {t(
              "Antique Catalogue blends structured metadata with imagery so every object is documented with context."
            )}
          </p>
          <div className="mt-6 space-y-4">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="flex items-start gap-4 rounded-2xl border border-border bg-background/80 p-4"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-muted text-sm font-semibold text-brand-strong">
                  0{index + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t(step.title)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{t(step.detail)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="mt-6 rounded-3xl border border-panel-border/90 surface-panel p-6 text-panel-foreground shadow-sm">
          <Eyebrow tone="panel">
            {t("Studio note")}
          </Eyebrow>
          <p className="mt-3 text-sm text-panel-muted-foreground">
            {t(
              "Mobile camera capture is built in. Photograph artifacts wherever you catalogue, then let the platform handle the rest."
            )}
          </p>
        </div>
      </aside>
    </>
  );
}
