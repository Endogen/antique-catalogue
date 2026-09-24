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
import { isApiError } from "@/lib/api";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const createLoginSchema = (t: (key: string) => string) =>
  z.object({
    email: z
      .string()
      .min(1, t("Email is required"))
      .pipe(z.email(t("Enter a valid email address"))),
    password: z.string().min(8, t("Password must be at least 8 characters"))
  });

type LoginFormValues = z.infer<ReturnType<typeof createLoginSchema>>;

const highlights = [
  "Create structured collection schemas in minutes",
  "Capture item photos from any device",
  "Surface provenance, condition, and notes fast",
  "Publish public collections when ready"
];

const quickCards = [
  {
    title: "Capture",
    detail: "Upload from mobile or desktop."
  },
  {
    title: "Curate",
    detail: "Publish collections with confidence."
  }
];

const resolveRedirectPath = (raw: string | null) => {
  if (!raw) {
    return "/dashboard";
  }
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith("/") && !decoded.startsWith("//")) {
      return decoded;
    }
  } catch {
    // Ignore invalid redirect param.
  }
  return "/dashboard";
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, login } = useAuth();
  const { t } = useI18n();
  const [formError, setFormError] = React.useState<string | null>(null);

  const redirectPath = React.useMemo(
    () => resolveRedirectPath(searchParams.get("next")),
    [searchParams]
  );

  const loginSchema = React.useMemo(() => createLoginSchema(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  React.useEffect(() => {
    if (status === "authenticated") {
      router.replace(redirectPath);
    }
  }, [status, router, redirectPath]);

  const onSubmit = async (values: LoginFormValues) => {
    setFormError(null);
    try {
      await login(values);
    } catch (error) {
      setFormError(
        isApiError(error)
          ? error.detail
          : "We couldn't sign you in. Please try again."
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
            <span className="hidden sm:inline">{t("New here?")}</span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/register">{t("Create account")}</Link>
            </Button>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-border bg-card/90 p-6 shadow-sm sm:mt-10 sm:p-8">
          <Eyebrow tone="brand" spacing="wide">
            {t("Welcome back")}
          </Eyebrow>
          <SectionHeading as="h1" size="xl" className="mt-4">
            {t("Sign in to your archive.")}
          </SectionHeading>
          <p className="mt-3 text-sm text-muted-strong">
            {t("Keep your collections, schema, and imagery in one focused workspace.")}
          </p>

          {formError ? (
            <Alert
              role="alert"
              className="mt-6">
              {t(formError)}
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

            <div>
              <div className="flex items-center justify-between">
                <label
                  className="text-sm font-medium text-muted-strong"
                  htmlFor="password"
                >
                  {t("Password")}
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-brand hover:text-brand-strong"
                >
                  {t("Forgot password?")}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
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

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? t("Signing in...") : t("Sign in")}
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{t("Need to verify your email first?")}</span>
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
        <div className="rounded-3xl border border-panel-border/90 surface-panel p-8 text-panel-foreground shadow-sm">
          <Eyebrow tone="panel" spacing="wide">
            {t("Archive overview")}
          </Eyebrow>
          <SectionHeading tone="panel" size="xl" className="mt-4">
            {t("Keep provenance close at hand.")}
          </SectionHeading>
          <p className="mt-3 text-sm text-panel-muted-foreground">
            {t(
              "Your catalogue becomes a living reference for every acquisition, with structured fields and curated imagery."
            )}
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
                <span className="text-panel-muted-foreground">{t(item)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {quickCards.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm"
            >
              <Eyebrow tone="subtle">
                {t(item.title)}
              </Eyebrow>
              <p className="mt-2 text-sm text-muted-strong">{t(item.detail)}</p>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}

function LoginFallback() {
  const { t } = useI18n();
  return (
    <div className="col-span-full flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
      {t("Loading...")}
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </React.Suspense>
  );
}
