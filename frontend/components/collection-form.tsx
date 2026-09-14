"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Globe2, Lock } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

const createCollectionSchema = (t: (key: string) => string) =>
  z.object({
    name: z
      .string()
      .min(1, t("Collection name is required"))
      .max(120, t("Keep the name under 120 characters")),
    description: z
      .string()
      .max(500, t("Keep the description under 500 characters")),
    is_public: z.boolean()
  });

export type CollectionFormValues = z.infer<ReturnType<typeof createCollectionSchema>>;

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
  const { t } = useI18n();
  const collectionSchema = React.useMemo(() => createCollectionSchema(t), [t]);
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
    control
  } = useForm<CollectionFormValues>({
    resolver: zodResolver(collectionSchema),
    defaultValues: defaults
  });

  React.useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  const isPublic = useWatch({ control, name: "is_public" });

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {formError ? (
        <Alert
          role="alert">
          {t(formError)}
        </Alert>
      ) : null}

      <div>
        <label className="text-sm font-medium text-muted-strong" htmlFor="name">
          {t("Collection name")}
        </label>
        <Input
          id="name"
          type="text"
          autoComplete="off"
          className="mt-2"
          aria-invalid={errors.name ? "true" : "false"}
          {...register("name")}
        />
        {errors.name ? (
          <p className="mt-2 text-xs text-destructive">{errors.name.message}</p>
        ) : null}
      </div>

      <div>
        <label
          className="text-sm font-medium text-muted-strong"
          htmlFor="description"
        >
          {t("Description")}
        </label>
        <Textarea
          id="description"
          rows={4}
          className="mt-2"
          {...register("description")}
        />
        {errors.description ? (
          <p className="mt-2 text-xs text-destructive">
            {errors.description.message}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          {t("Share the theme, era, or provenance you will capture.")}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-strong">
              {t("Visibility")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("Choose whether this collection appears in the public directory.")}
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            className={cn(
              "rounded-2xl border p-4 text-left text-sm transition",
              !isPublic
                ? "border-brand-border bg-brand-muted/80 text-foreground"
                : "border-border bg-card text-muted-strong hover:border-muted-subtle"
            )}
            onClick={() => setValue("is_public", false, { shouldDirty: true })}
          >
            <div className="flex items-center gap-2 font-medium">
              <Lock className="h-4 w-4 text-brand" />
              {t("Private")}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("Only you can view and edit items.")}
            </p>
          </button>
          <button
            type="button"
            className={cn(
              "rounded-2xl border p-4 text-left text-sm transition",
              isPublic
                ? "border-success-border bg-success-muted/80 text-foreground"
                : "border-border bg-card text-muted-strong hover:border-muted-subtle"
            )}
            onClick={() => setValue("is_public", true, { shouldDirty: true })}
          >
            <div className="flex items-center gap-2 font-medium">
              <Globe2 className="h-4 w-4 text-success" />
              {t("Public")}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("Share read-only access with the public.")}
            </p>
          </button>
        </div>
        <input type="hidden" {...register("is_public")} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {secondaryAction}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? submitPendingLabel ?? t("Saving...")
            : submitLabel}
        </Button>
      </div>
    </form>
  );
}
