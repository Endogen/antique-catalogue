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

const createForgotSchema = (t: (key: string) => string) =>
  z.object({
    email: z
      .string()
      .min(1, t("Email is required"))
      .email(t("Enter a valid email address"))
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
      <div className="col-span-full flex min-h-[60vh] items-center justify-center text-sm text-stone-500">
        {t("Redirecting to your workspace...")}
      </div>
    );
  }

  const isLocked = Boolean(successMessage);

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
            <span className="hidden sm:inline">{t("Remembered your password?")}</span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">{t("Sign in")}</Link>
            </Button>
          </div>
        </header>

        <section className="mt-10 rounded-3xl border border-stone-200 bg-white/90 p-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
            {t("Password reset")}
          </p>
          <h1 className="font-display mt-4 text-3xl text-stone-900">
            {t("Retrieve your access.")}
          </h1>
          <p className="mt-3 text-sm text-stone-600">
            {t(
              "Enter the email tied to your archive. We will send a reset token you can use to set a new password."
            )}
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
                    "Reset token sent to {email}. Use it on the reset page to choose a new password.",
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
                {...register("email")}
              />
              {errors.email ? (
                <p className="mt-2 text-xs text-rose-600">
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

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
            <span>{t("Already have a token?")}</span>
            <Link
              href="/reset-password"
              className="font-medium text-amber-700 hover:text-amber-800"
            >
              {t("Reset your password")}
            </Link>
          </div>
        </section>
      </div>

      <aside className="order-first lg:order-none">
        <div className="rounded-3xl border border-stone-900/90 bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 p-8 text-stone-100 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-stone-400">
            {t("Reset flow")}
          </p>
          <h2 className="font-display mt-4 text-3xl">
            {t("Regain control in minutes.")}
          </h2>
          <p className="mt-3 text-sm text-stone-300">
            {t(
              "Keep your archive secure with a short reset workflow designed to get you back in quickly."
            )}
          </p>
          <ul className="mt-6 space-y-4 text-sm">
            {steps.map((step, index) => (
              <li key={step.title} className="flex items-start gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-sm font-semibold text-stone-900">
                  0{index + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-100">
                    {t(step.title)}
                  </p>
                  <p className="mt-1 text-xs text-stone-300">{t(step.detail)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 rounded-3xl border border-stone-200 bg-white/85 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
            {t("Security note")}
          </p>
          <p className="mt-3 text-sm text-stone-700">
            {t(
              "For privacy, we always respond with the same message even if the address is not on file."
            )}
          </p>
        </div>
      </aside>
    </>
  );
}
