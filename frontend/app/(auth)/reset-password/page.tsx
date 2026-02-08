"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { authApi, isApiError } from "@/lib/api";

const resetSchema = z
  .object({
    token: z.string().trim().min(1, "Reset token is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z
      .string()
      .min(1, "Confirm your password")
      .min(8, "Password must be at least 8 characters")
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match"
  });

type ResetFormValues = z.infer<typeof resetSchema>;

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
  const [formError, setFormError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

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
      <div className="col-span-full flex min-h-[60vh] items-center justify-center text-sm text-stone-500">
        Redirecting to your workspace...
      </div>
    );
  }

  const isReset = Boolean(successMessage);

  return (
    <>
      <div className="flex flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-stone-50">
              AC
            </div>
            <div>
              <p className="font-display text-lg tracking-tight">
                Antique Catalogue
              </p>
              <p className="text-xs uppercase tracking-[0.35em] text-stone-500">
                Studio Archive
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-3 text-sm text-stone-600">
            <span className="hidden sm:inline">Need a reset token?</span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/forgot-password">Request one</Link>
            </Button>
          </div>
        </header>

        <section className="mt-10 rounded-3xl border border-stone-200 bg-white/90 p-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
            Set new password
          </p>
          <h1 className="font-display mt-4 text-3xl text-stone-900">
            Update your credentials.
          </h1>
          <p className="mt-3 text-sm text-stone-600">
            Paste the reset token from your email and choose a new password to
            regain access to your archive.
          </p>

          {formError ? (
            <div
              role="alert"
              className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              {formError}
            </div>
          ) : null}

          {successMessage ? (
            <div
              role="status"
              className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
            >
              <p className="font-medium">{successMessage}</p>
              <p className="mt-2 text-xs text-emerald-700">
                You can now sign in with your updated password.
              </p>
            </div>
          ) : null}

          <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm font-medium text-stone-700" htmlFor="token">
                Reset token
              </label>
              <input
                id="token"
                type="text"
                autoComplete="one-time-code"
                disabled={isReset}
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-stone-100"
                aria-invalid={errors.token ? "true" : "false"}
                placeholder="Paste your reset token"
                {...register("token")}
              />
              {errors.token ? (
                <p className="mt-2 text-xs text-rose-600">
                  {errors.token.message}
                </p>
              ) : null}
            </div>

            <div>
              <label className="text-sm font-medium text-stone-700" htmlFor="password">
                New password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                disabled={isReset}
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-stone-100"
                aria-invalid={errors.password ? "true" : "false"}
                {...register("password")}
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
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                disabled={isReset}
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-stone-100"
                aria-invalid={errors.confirmPassword ? "true" : "false"}
                {...register("confirmPassword")}
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
              disabled={isSubmitting || isReset}
            >
              {isReset
                ? "Password updated"
                : isSubmitting
                ? "Updating password..."
                : "Reset password"}
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
            <span>Ready to return?</span>
            <Link
              href="/login"
              className="font-medium text-amber-700 hover:text-amber-800"
            >
              Sign in
            </Link>
          </div>
        </section>
      </div>

      <aside className="order-first lg:order-none">
        <div className="rounded-3xl border border-stone-200 bg-white/85 p-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-stone-500">
            Reset tips
          </p>
          <h2 className="font-display mt-4 text-3xl text-stone-900">
            Keep your archive secure.
          </h2>
          <p className="mt-3 text-sm text-stone-600">
            Password resets protect your catalogue and keep your private notes
            secure.
          </p>
          <div className="mt-6 space-y-4">
            {tips.map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4"
              >
                <p className="text-sm font-medium text-stone-900">{item.title}</p>
                <p className="mt-1 text-xs text-stone-500">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-3xl border border-stone-900/90 bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 p-6 text-stone-100 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
            Studio reminder
          </p>
          <p className="mt-3 text-sm text-stone-300">
            Reset tokens are single-use and expire quickly. Request another token
            anytime you need.
          </p>
        </div>
      </aside>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-sm text-stone-500">Loading...</div>}>
      <ResetPasswordContent />
    </React.Suspense>
  );
}
