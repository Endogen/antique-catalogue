"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Globe2, Lock } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const collectionSchema = z.object({
  name: z
    .string()
    .min(1, "Collection name is required")
    .max(120, "Keep the name under 120 characters"),
  description: z
    .string()
    .max(500, "Keep the description under 500 characters"),
  is_public: z.boolean()
});

export type CollectionFormValues = z.infer<typeof collectionSchema>;

type CollectionFormProps = {
  initialValues?: Partial<CollectionFormValues>;
  onSubmit: (values: CollectionFormValues) => Promise<void>;
  submitLabel: string;
  submitPendingLabel?: string;
  secondaryAction?: React.ReactNode;
  formError?: string | null;
};

export function CollectionForm({
  initialValues,
  onSubmit,
  submitLabel,
  submitPendingLabel,
  secondaryAction,
  formError
}: CollectionFormProps) {
  const defaults = React.useMemo<CollectionFormValues>(
    () => ({
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      is_public: initialValues?.is_public ?? false
    }),
    [initialValues?.description, initialValues?.is_public, initialValues?.name]
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch
  } = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionSchema),
    defaultValues: defaults
  });

  React.useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  const isPublic = watch("is_public");

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {formError ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {formError}
        </div>
      ) : null}

      <div>
        <label className="text-sm font-medium text-stone-700" htmlFor="name">
          Collection name
        </label>
        <input
          id="name"
          type="text"
          autoComplete="off"
          className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
          aria-invalid={errors.name ? "true" : "false"}
          {...register("name")}
        />
        {errors.name ? (
          <p className="mt-2 text-xs text-rose-600">{errors.name.message}</p>
        ) : null}
      </div>

      <div>
        <label
          className="text-sm font-medium text-stone-700"
          htmlFor="description"
        >
          Description
        </label>
        <textarea
          id="description"
          rows={4}
          className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
          {...register("description")}
        />
        {errors.description ? (
          <p className="mt-2 text-xs text-rose-600">
            {errors.description.message}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-stone-500">
          Share the theme, era, or provenance you will capture.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-stone-700">Visibility</p>
            <p className="mt-1 text-xs text-stone-500">
              Choose whether this collection appears in the public directory.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className={cn(
              "rounded-2xl border p-4 text-left text-sm transition",
              !isPublic
                ? "border-amber-200 bg-amber-50/80 text-stone-900"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
            )}
            onClick={() => setValue("is_public", false, { shouldDirty: true })}
          >
            <div className="flex items-center gap-2 font-medium">
              <Lock className="h-4 w-4 text-amber-600" />
              Private
            </div>
            <p className="mt-2 text-xs text-stone-500">
              Only you can view and edit items.
            </p>
          </button>
          <button
            type="button"
            className={cn(
              "rounded-2xl border p-4 text-left text-sm transition",
              isPublic
                ? "border-emerald-200 bg-emerald-50/80 text-stone-900"
                : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"
            )}
            onClick={() => setValue("is_public", true, { shouldDirty: true })}
          >
            <div className="flex items-center gap-2 font-medium">
              <Globe2 className="h-4 w-4 text-emerald-600" />
              Public
            </div>
            <p className="mt-2 text-xs text-stone-500">
              Share read-only access with the public.
            </p>
          </button>
        </div>
        <input type="hidden" {...register("is_public")} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {secondaryAction}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? submitPendingLabel ?? "Saving..."
            : submitLabel}
        </Button>
      </div>
    </form>
  );
}
