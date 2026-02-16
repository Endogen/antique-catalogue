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

const createRegisterSchema = (t: (key: string) => string) =>
  z
    .object({
      email: z
        .string()
        .min(1, t("Email is required"))
        .email(t("Enter a valid email address")),
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
    try {
      const response = await authApi.register({
        email: values.email,
        password: values.password
      });
      setSubmittedEmail(values.email);
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
      <div className="col-span-full flex min-h-[60vh] items-center justify-center text-sm text-stone-500">
        {t("Redirecting to your workspace...")}
      </div>
    );
  }

  const isLocked = Boolean(submittedEmail);

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
            <span className="hidden sm:inline">{t("Already have an account?")}</span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">{t("Sign in")}</Link>
            </Button>
          </div>
        </header>

        <section className="mt-10 rounded-3xl border border-stone-200 bg-white/90 p-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
            {t("Create your studio")}
          </p>
          <h1 className="font-display mt-4 text-3xl text-stone-900">
            {t("Start cataloguing in minutes.")}
          </h1>
          <p className="mt-3 text-sm text-stone-600">
            {t("Build a secure, searchable archive for every piece you collect.")}
          </p>

          {formError ? (
            <div
              role="alert"
              className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              {t(formError)}
            </div>
          ) : null}

          {successMessage ? (
            <div
              role="status"
              className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
            >
              <p className="font-medium">{t(successMessage)}</p>
              {submittedEmail ? (
                <p className="mt-2 text-xs text-emerald-700">
                  {t(
                    "We sent a verification token to {email}. Enter it on the verification page to activate your account.",
                    { email: submittedEmail }
                  )}
                </p>
              ) : null}
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
                disabled={isLocked}
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-stone-100"
                aria-invalid={errors.email ? "true" : "false"}
                {...formRegister("email")}
              />
              {errors.email ? (
                <p className="mt-2 text-xs text-rose-600">
                  {errors.email.message}
                </p>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-medium text-stone-700" htmlFor="password">
                {t("Password")}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                disabled={isLocked}
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-stone-100"
                aria-invalid={errors.password ? "true" : "false"}
                {...formRegister("password")}
              />
              {errors.password ? (
                <p className="mt-2 text-xs text-rose-600">
                  {errors.password.message}
                </p>
              ) : null}
            </div>

            <div>
              <label
                className="text-sm font-medium text-stone-700"
                htmlFor="confirmPassword"
              >
                {t("Confirm password")}
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                disabled={isLocked}
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-stone-100"
                aria-invalid={errors.confirmPassword ? "true" : "false"}
                {...formRegister("confirmPassword")}
              />
              {errors.confirmPassword ? (
                <p className="mt-2 text-xs text-rose-600">
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
              {isLocked
                ? t("Check your email")
                : isSubmitting
                ? t("Creating account...")
                : t("Create account")}
            </Button>
          </form>

          <p className="mt-6 text-xs text-stone-500">
            {t(
              "By creating an account you agree to receive verification emails from Antique Catalogue."
            )}
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
            <span>{t("Already verified?")}</span>
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
        <div className="rounded-3xl border border-stone-200 bg-white/80 p-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-stone-500">
            {t("How it works")}
          </p>
          <h2 className="font-display mt-4 text-3xl text-stone-900">
            {t("Your collection studio, built for detail.")}
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            {t(
              "Antique Catalogue blends structured metadata with imagery so every object is documented with context."
            )}
          </p>
          <div className="mt-6 space-y-4">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="flex items-start gap-4 rounded-2xl border border-stone-200 bg-stone-50/80 p-4"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-semibold text-amber-800">
                  0{index + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-900">
                    {t(step.title)}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">{t(step.detail)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-stone-900/90 bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 p-6 text-stone-100 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
            {t("Studio note")}
          </p>
          <p className="mt-3 text-sm text-stone-300">
            {t(
              "Mobile camera capture is built in. Photograph artifacts wherever you catalogue, then let the platform handle the rest."
            )}
          </p>
        </div>
      </aside>
    </>
  );
}
