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

const verifySchema = z.object({
  token: z.string().trim().min(1, "Verification token is required")
});

type VerifyFormValues = z.infer<typeof verifySchema>;

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

export default function VerifyPage() {
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
      <div className="col-span-full flex min-h-[60vh] items-center justify-center text-sm text-stone-500">
        Redirecting to your workspace...
      </div>
    );
  }

  const isVerified = Boolean(successMessage);

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
            <span className="hidden sm:inline">Already verified?</span>
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </header>

        <section className="mt-10 rounded-3xl border border-stone-200 bg-white/90 p-8 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
            Verify your email
          </p>
          <h1 className="font-display mt-4 text-3xl text-stone-900">
            Activate your archive.
          </h1>
          <p className="mt-3 text-sm text-stone-600">
            Enter the verification token we sent to your inbox to complete setup.
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
                You can now sign in and start building your collection archive.
              </p>
            </div>
          ) : null}

          <form className="mt-6 space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label className="text-sm font-medium text-stone-700" htmlFor="token">
                Verification token
              </label>
              <input
                id="token"
                type="text"
                autoComplete="one-time-code"
                disabled={isVerified}
                className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-stone-100"
                aria-invalid={errors.token ? "true" : "false"}
                placeholder="Paste your token"
                {...register("token")}
              />
              {errors.token ? (
                <p className="mt-2 text-xs text-rose-600">
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
                ? "Email verified"
                : isSubmitting
                ? "Verifying..."
                : "Verify email"}
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
            <span>Need a fresh token?</span>
            <Link
              href="/register"
              className="font-medium text-amber-700 hover:text-amber-800"
            >
              Create a new account
            </Link>
          </div>
        </section>
      </div>

      <aside className="order-first lg:order-none">
        <div className="rounded-3xl border border-stone-900/90 bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 p-8 text-stone-100 shadow-sm">
          <p className="text-xs uppercase tracking-[0.4em] text-stone-400">
            Next steps
          </p>
          <h2 className="font-display mt-4 text-3xl">
            Confirm your studio access.
          </h2>
          <p className="mt-3 text-sm text-stone-300">
            Verification keeps your catalogue secure and ensures notifications land
            in the right place.
          </p>
          <ul className="mt-6 space-y-4 text-sm">
            {nextSteps.map((step, index) => (
              <li key={step.title} className="flex items-start gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-sm font-semibold text-stone-900">
                  0{index + 1}
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-100">
                    {step.title}
                  </p>
                  <p className="mt-1 text-xs text-stone-300">{step.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 rounded-3xl border border-stone-200 bg-white/85 p-6 shadow-sm">
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
            Helpful tip
          </p>
          <p className="mt-3 text-sm text-stone-700">
            Verification tokens are time-sensitive. If yours has expired, request a
            new one by registering again.
          </p>
        </div>
      </aside>
    </>
  );
}
