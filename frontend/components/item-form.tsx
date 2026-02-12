"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import type { FieldDefinitionResponse, FieldOptions } from "@/lib/api";

const itemSchema = z.object({
  name: z
    .string()
    .min(1, "Item name is required")
    .max(160, "Keep the name under 160 characters"),
  notes: z
    .string()
    .max(2000, "Keep the notes under 2000 characters")
    .optional()
    .or(z.literal("")),
  metadata: z.record(z.unknown()).optional(),
  is_highlight: z.boolean().optional()
});

type ItemFormInput = z.infer<typeof itemSchema>;

export type ItemFormValues = {
  name: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  is_highlight: boolean;
};

type ItemFormProps = {
  fields: FieldDefinitionResponse[];
  initialValues?: Partial<ItemFormValues>;
  onSubmit: (values: ItemFormValues) => Promise<void>;
  submitLabel: string;
  submitPendingLabel?: string;
  secondaryAction?: React.ReactNode;
  formError?: string | null;
  render?: (sections: {
    formError: React.ReactNode | null;
    baseFields: React.ReactNode;
    metadataFields: React.ReactNode;
    actions: React.ReactNode;
  }) => React.ReactNode;
};

type MetadataError = {
  fieldId: string;
  message: string;
};

type MetadataValidationResult = {
  payload: Record<string, unknown> | null;
  errors: MetadataError[];
};

const fieldTypeLabels: Record<string, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  timestamp: "Timestamp",
  checkbox: "Checkbox",
  select: "Select"
};

const sortFields = (items: FieldDefinitionResponse[]) =>
  [...items].sort((a, b) => a.position - b.position || a.id - b.id);

const normalizeOptions = (values: string[]) => {
  const map = new Map<string, string>();
  values.forEach((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (!map.has(key)) {
      map.set(key, trimmed);
    }
  });
  return Array.from(map.values());
};

const extractOptions = (options?: FieldOptions | null) => {
  if (!options?.options || !Array.isArray(options.options)) {
    return [];
  }
  return normalizeOptions(options.options.filter((value) => typeof value === "string"));
};

const isEmptyValue = (value: unknown) =>
  value === null ||
  value === undefined ||
  (typeof value === "string" && value.trim() === "");

const normalizeDateInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : trimmed;
};

const normalizeDateTimeInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = trimmed.replace(" ", "T");
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  return match ? match[1] : normalized;
};

const buildMetadataDefaults = (
  fields: FieldDefinitionResponse[],
  metadata?: Record<string, unknown> | null
) => {
  const defaults: Record<string, unknown> = {};
  fields.forEach((field) => {
    const key = String(field.id);
    const raw = metadata ? metadata[field.name] : undefined;

    if (raw === undefined || raw === null) {
      defaults[key] = field.field_type === "checkbox" ? false : "";
      return;
    }

    if (field.field_type === "number") {
      if (typeof raw === "number" && !Number.isNaN(raw)) {
        defaults[key] = raw;
        return;
      }
      if (typeof raw === "string") {
        const parsed = Number(raw);
        defaults[key] = Number.isNaN(parsed) ? "" : parsed;
        return;
      }
      defaults[key] = "";
      return;
    }

    if (field.field_type === "checkbox") {
      if (typeof raw === "boolean") {
        defaults[key] = raw;
        return;
      }
      if (typeof raw === "string") {
        defaults[key] = raw.toLowerCase() === "true";
        return;
      }
      defaults[key] = false;
      return;
    }

    if (field.field_type === "date" && typeof raw === "string") {
      defaults[key] = normalizeDateInput(raw);
      return;
    }

    if (field.field_type === "timestamp" && typeof raw === "string") {
      defaults[key] = normalizeDateTimeInput(raw);
      return;
    }

    if (typeof raw === "string") {
      defaults[key] = raw;
      return;
    }

    defaults[key] = String(raw);
  });

  return defaults;
};

const validateMetadata = (
  fields: FieldDefinitionResponse[],
  metadataValues?: Record<string, unknown>
): MetadataValidationResult => {
  const errors: MetadataError[] = [];
  const normalized: Record<string, unknown> = {};
  const values = metadataValues ?? {};

  fields.forEach((field) => {
    const key = String(field.id);
    const rawValue = values[key];

    if (isEmptyValue(rawValue)) {
      if (field.is_required) {
        errors.push({ fieldId: key, message: "Field is required" });
      }
      return;
    }

    if (field.field_type === "text") {
      if (typeof rawValue !== "string") {
        errors.push({ fieldId: key, message: "Value must be a string" });
        return;
      }
      const trimmed = rawValue.trim();
      if (field.is_required && !trimmed) {
        errors.push({ fieldId: key, message: "Field is required" });
        return;
      }
      if (trimmed) {
        normalized[field.name] = trimmed;
      }
      return;
    }

    if (field.field_type === "number") {
      const numericValue =
        typeof rawValue === "number"
          ? rawValue
          : typeof rawValue === "string"
            ? Number(rawValue)
            : NaN;
      if (Number.isNaN(numericValue)) {
        errors.push({ fieldId: key, message: "Value must be a number" });
        return;
      }
      normalized[field.name] = numericValue;
      return;
    }

    if (field.field_type === "date") {
      if (typeof rawValue !== "string") {
        errors.push({ fieldId: key, message: "Value must be a date (YYYY-MM-DD)" });
        return;
      }
      const trimmed = rawValue.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        errors.push({ fieldId: key, message: "Value must be a date (YYYY-MM-DD)" });
        return;
      }
      const parsed = new Date(`${trimmed}T00:00:00Z`);
      if (Number.isNaN(parsed.getTime())) {
        errors.push({ fieldId: key, message: "Value must be a date (YYYY-MM-DD)" });
        return;
      }
      normalized[field.name] = trimmed;
      return;
    }

    if (field.field_type === "timestamp") {
      if (typeof rawValue !== "string") {
        errors.push({ fieldId: key, message: "Value must be a timestamp (ISO 8601)" });
        return;
      }
      const trimmed = rawValue.trim();
      if (!trimmed || (!trimmed.includes("T") && !trimmed.includes(" "))) {
        errors.push({ fieldId: key, message: "Value must be a timestamp (ISO 8601)" });
        return;
      }
      const adjusted = trimmed.endsWith("Z")
        ? `${trimmed.slice(0, -1)}+00:00`
        : trimmed;
      const parsed = new Date(adjusted);
      if (Number.isNaN(parsed.getTime())) {
        errors.push({ fieldId: key, message: "Value must be a timestamp (ISO 8601)" });
        return;
      }
      normalized[field.name] = trimmed;
      return;
    }

    if (field.field_type === "checkbox") {
      if (typeof rawValue !== "boolean") {
        errors.push({ fieldId: key, message: "Value must be true or false" });
        return;
      }
      normalized[field.name] = rawValue;
      return;
    }

    if (field.field_type === "select") {
      if (typeof rawValue !== "string") {
        errors.push({ fieldId: key, message: "Value must be a string" });
        return;
      }
      const trimmed = rawValue.trim();
      const options = extractOptions(field.options);
      if (!options.length) {
        errors.push({ fieldId: key, message: "Select field is missing options" });
        return;
      }
      if (!trimmed || !options.includes(trimmed)) {
        errors.push({
          fieldId: key,
          message: `Value must be one of: ${options.join(", ")}`
        });
        return;
      }
      normalized[field.name] = trimmed;
      return;
    }

    errors.push({ fieldId: key, message: "Unsupported field type" });
  });

  if (!Object.keys(normalized).length) {
    return { payload: null, errors };
  }

  return { payload: normalized, errors };
};

export function ItemForm({
  fields,
  initialValues,
  onSubmit,
  submitLabel,
  submitPendingLabel,
  secondaryAction,
  formError,
  render
}: ItemFormProps) {
  const sortedFields = React.useMemo(() => sortFields(fields), [fields]);

  const defaults = React.useMemo<ItemFormInput>(
    () => ({
      name: initialValues?.name ?? "",
      notes: initialValues?.notes ?? "",
      metadata: buildMetadataDefaults(sortedFields, initialValues?.metadata),
      is_highlight: initialValues?.is_highlight ?? false
    }),
    [
      initialValues?.is_highlight,
      initialValues?.metadata,
      initialValues?.name,
      initialValues?.notes,
      sortedFields
    ]
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError,
    clearErrors
  } = useForm<ItemFormInput>({
    resolver: zodResolver(itemSchema),
    defaultValues: defaults
  });

  React.useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  const registerMetadataField = React.useCallback(
    (fieldId: string, options?: Parameters<typeof register>[1]) => {
      const base = register(`metadata.${fieldId}` as const, options);
      return {
        ...base,
        onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
          base.onChange(event);
          clearErrors(`metadata.${fieldId}` as const);
        }
      };
    },
    [clearErrors, register]
  );

  const handleFormSubmit = async (values: ItemFormInput) => {
    clearErrors("metadata");
    const normalizedName = values.name.trim();
    const normalizedNotes = values.notes?.trim() ? values.notes.trim() : null;

    const { payload, errors: metadataErrors } = validateMetadata(
      sortedFields,
      values.metadata
    );

    if (metadataErrors.length) {
      metadataErrors.forEach((error) => {
        setError(`metadata.${error.fieldId}` as const, {
          type: "manual",
          message: error.message
        });
      });
      return;
    }

    await onSubmit({
      name: normalizedName,
      notes: normalizedNotes,
      metadata: payload,
      is_highlight: Boolean(values.is_highlight)
    });
  };

  const metadataErrors = errors.metadata as
    | Record<string, { message?: string }>
    | undefined;

  const formErrorNode = formError ? (
    <div
      role="alert"
      className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
    >
      {formError}
    </div>
  ) : null;

  const baseFields = (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-stone-700" htmlFor="name">
          Item name
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
        <label className="text-sm font-medium text-stone-700" htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          rows={4}
          className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
          {...register("notes")}
        />
        {errors.notes ? (
          <p className="mt-2 text-xs text-rose-600">{errors.notes.message}</p>
        ) : (
          <p className="mt-2 text-xs text-stone-500">
            Optional context, provenance, or acquisition details.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-amber-200/70 bg-amber-50/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <label
              className="text-sm font-medium text-stone-800"
              htmlFor="is_highlight"
            >
              Highlight item
            </label>
            <p className="mt-1 text-xs text-stone-600">
              Adds a warm glow to featured items across the catalogue.
            </p>
          </div>
          <input
            id="is_highlight"
            type="checkbox"
            className="mt-1 h-5 w-5 rounded border-amber-300 text-amber-600 focus:ring-amber-200"
            {...register("is_highlight")}
          />
        </div>
      </div>
    </div>
  );

  const metadataFields = (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
          Metadata
        </p>
        <h3 className="font-display mt-3 text-2xl text-stone-900">
          Capture collection-specific fields.
        </h3>
        <p className="mt-2 text-sm text-stone-600">
          Complete the schema-driven attributes for this item.
        </p>
      </div>

      {sortedFields.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-500">
          No schema fields yet. Define fields in collection settings to capture
          metadata.
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedFields.map((field) => {
            const fieldId = String(field.id);
            const errorMessage = metadataErrors?.[fieldId]?.message;
            const options =
              field.field_type === "select"
                ? extractOptions(field.options)
                : [];

            if (field.field_type === "checkbox") {
              return (
                <div
                  key={field.id}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-stone-200 bg-white/80 p-4"
                >
                  <div>
                    <label
                      className="text-sm font-medium text-stone-700"
                      htmlFor={`metadata-${field.id}`}
                    >
                      {field.name}
                    </label>
                    <p className="mt-1 text-xs text-stone-500">
                      {fieldTypeLabels[field.field_type] ?? field.field_type}
                      {field.is_required ? " · Required" : " · Optional"}
                    </p>
                    {errorMessage ? (
                      <p className="mt-2 text-xs text-rose-600">
                        {errorMessage}
                      </p>
                    ) : null}
                  </div>
                  <input
                    id={`metadata-${field.id}`}
                    type="checkbox"
                    className="mt-1 h-5 w-5 rounded border-stone-300 text-amber-600 focus:ring-amber-200"
                    aria-invalid={errorMessage ? "true" : "false"}
                    {...registerMetadataField(fieldId)}
                  />
                </div>
              );
            }

            return (
              <div
                key={field.id}
                className="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white/80 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label
                    className="text-sm font-medium text-stone-700"
                    htmlFor={`metadata-${field.id}`}
                  >
                    {field.name}
                  </label>
                  <span className="text-xs uppercase tracking-[0.2em] text-stone-400">
                    {fieldTypeLabels[field.field_type] ?? field.field_type}
                    {field.is_required ? " · Required" : " · Optional"}
                  </span>
                </div>

                {field.field_type === "select" ? (
                  <select
                    id={`metadata-${field.id}`}
                    className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 shadow-sm focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    aria-invalid={errorMessage ? "true" : "false"}
                    {...registerMetadataField(fieldId)}
                    disabled={!options.length}
                  >
                    <option value="">Select a value</option>
                    {options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={`metadata-${field.id}`}
                    type={
                      field.field_type === "number"
                        ? "number"
                        : field.field_type === "date"
                          ? "date"
                          : field.field_type === "timestamp"
                            ? "datetime-local"
                            : "text"
                    }
                    step={field.field_type === "number" ? "any" : undefined}
                    className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    aria-invalid={errorMessage ? "true" : "false"}
                    placeholder={
                      field.field_type === "date"
                        ? "YYYY-MM-DD"
                        : field.field_type === "timestamp"
                          ? "YYYY-MM-DDThh:mm"
                          : "Enter value"
                    }
                    {...registerMetadataField(fieldId, {
                      setValueAs:
                        field.field_type === "number"
                          ? (value) =>
                              value === "" || value === null
                                ? undefined
                                : Number(value)
                          : undefined
                    })}
                  />
                )}

                {errorMessage ? (
                  <p className="text-xs text-rose-600">{errorMessage}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-3">
      {secondaryAction}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? submitPendingLabel ?? "Saving..." : submitLabel}
      </Button>
    </div>
  );

  return (
    <form className="space-y-8" onSubmit={handleSubmit(handleFormSubmit)}>
      {render ? (
        render({
          formError: formErrorNode,
          baseFields,
          metadataFields,
          actions
        })
      ) : (
        <>
          {formErrorNode}
          {baseFields}
          {metadataFields}
          {actions}
        </>
      )}
    </form>
  );
}
