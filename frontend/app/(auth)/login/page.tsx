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

const createLoginSchema = (t: (key: string) => string) =>
  z.object({
    email: z
      .string()
      .min(1, t("Email is required"))
      .email(t("Enter a valid email address")),
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
      <div className="col-span-full flex min-h-[60vh] items-center justify-center text-sm text-stone-500">
        {t("Redirecting to your workspace...")}
      </div>
    );
  }

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
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
                {t("Studio Archive")}
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3 text-sm text-stone-600">
            <span className="hidden sm:inline">{t("New here?")}</span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/register">{t("Create account")}</Link>
            </Button>
          </div>
        </header>

        <section className="mt-10 rounded-3xl border border-stone-200 bg-white/90 p-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
            {t("Welcome back")}
          </p>
          <h1 className="font-display mt-4 text-3xl text-stone-900">
            {t("Sign in to your archive.")}
          </h1>
          <p className="mt-3 text-sm text-stone-600">
            {t("Keep your collections, schema, and imagery in one focused workspace.")}
          </p>

          {formError ? (
            <div
              role="alert"
              className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              {t(formError)}
            </div>
          ) : null}

          <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm font-medium text-stone-700" htmlFor="email">
                {t("Email address")}
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                aria-invalid={errors.email ? "true" : "false"}
                {...register("email")}
              />
              {errors.email ? (
                <p className="mt-2 text-xs text-rose-600">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  className="text-sm font-medium text-stone-700"
                  htmlFor="password"
                >
                  {t("Password")}
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-amber-700 hover:text-amber-800"
                >
                  {t("Forgot password?")}
                </Link>
              </div>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                aria-invalid={errors.password ? "true" : "false"}
                {...register("password")}
              />
              {errors.password ? (
                <p className="mt-2 text-xs text-rose-600">
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

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
            <span>{t("Need to verify your email first?")}</span>
            <Link
              href="/verify"
              className="font-medium text-amber-700 hover:text-amber-800"
            >
              {t("Enter verification token")}
            </Link>
          </div>
        </section>
      </div>

      <aside className="order-first lg:order-none">
        <div className="rounded-3xl border border-stone-900/90 bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 p-8 text-stone-100 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-stone-400">
            {t("Archive overview")}
          </p>
          <h2 className="font-display mt-4 text-3xl">
            {t("Keep provenance close at hand.")}
          </h2>
          <p className="mt-3 text-sm text-stone-300">
            {t(
              "Your catalogue becomes a living reference for every acquisition, with structured fields and curated imagery."
            )}
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-amber-300" />
                <span className="text-stone-200">{t(item)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {quickCards.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-sm"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                {t(item.title)}
              </p>
              <p className="mt-2 text-sm text-stone-700">{t(item.detail)}</p>
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
    <div className="col-span-full flex min-h-[60vh] items-center justify-center text-sm text-stone-500">
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
