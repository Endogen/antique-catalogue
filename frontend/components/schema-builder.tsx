"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  PencilLine,
  Plus,
  RefreshCcw,
  Trash2,
  X
} from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fieldApi,
  isApiError,
  type FieldDefinitionResponse,
  type FieldOptions
} from "@/lib/api";

const fieldSchema = z.object({
  name: z
    .string()
    .min(1, "Field name is required")
    .max(120, "Keep the name under 120 characters"),
  field_type: z.enum([
    "text",
    "number",
    "date",
    "timestamp",
    "checkbox",
    "select"
  ]),
  is_required: z.boolean()
});

type FieldFormValues = z.infer<typeof fieldSchema>;
type FieldType = FieldFormValues["field_type"];

const fieldTypes: {
  value: FieldType;
  label: string;
  helper: string;
}[] = [
  { value: "text", label: "Text", helper: "Free-form text" },
  { value: "number", label: "Number", helper: "Integers or decimals" },
  { value: "date", label: "Date", helper: "YYYY-MM-DD format" },
  { value: "timestamp", label: "Timestamp", helper: "Date + time" },
  { value: "checkbox", label: "Checkbox", helper: "True or false" },
  { value: "select", label: "Select", helper: "Choose from options" }
];

const defaultValues: FieldFormValues = {
  name: "",
  field_type: "text",
  is_required: false
};

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

const getTypeMeta = (value: string) =>
  fieldTypes.find((fieldType) => fieldType.value === value) ?? fieldTypes[0];

const sortFields = (items: FieldDefinitionResponse[]) =>
  [...items].sort((a, b) => a.position - b.position || a.id - b.id);

const arrayMove = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  const result = [...items];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
};

type SchemaBuilderProps = {
  collectionId: number | string;
};

export function SchemaBuilder({ collectionId }: SchemaBuilderProps) {
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [fields, setFields] = React.useState<FieldDefinitionResponse[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [optionsError, setOptionsError] = React.useState<string | null>(null);
  const [optionInput, setOptionInput] = React.useState("");
  const [options, setOptions] = React.useState<string[]>([]);
  const [activeFieldId, setActiveFieldId] = React.useState<number | null>(null);
  const [draggingId, setDraggingId] = React.useState<number | null>(null);
  const [dragOverId, setDragOverId] = React.useState<number | null>(null);
  const [reorderError, setReorderError] = React.useState<string | null>(null);
  const [isReordering, setIsReordering] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState<number | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch
  } = useForm<FieldFormValues>({
    resolver: zodResolver(fieldSchema),
    defaultValues
  });

  const fieldType = watch("field_type");

  const activeField = React.useMemo(
    () => fields.find((field) => field.id === activeFieldId) ?? null,
    [fields, activeFieldId]
  );

  const loadFields = React.useCallback(async () => {
    if (!collectionId) {
      setStatus("error");
      setLoadError("Collection ID is missing.");
      return;
    }
    setStatus("loading");
    setLoadError(null);
    try {
      const data = await fieldApi.list(collectionId);
      setFields(sortFields(data));
      setStatus("ready");
    } catch (error) {
      setStatus("error");
      setLoadError(
        isApiError(error)
          ? error.detail
          : "We couldn't load the collection schema."
      );
    }
  }, [collectionId]);

  React.useEffect(() => {
    void loadFields();
  }, [loadFields]);

  React.useEffect(() => {
    if (activeField) {
      reset({
        name: activeField.name,
        field_type: activeField.field_type as FieldType,
        is_required: activeField.is_required
      });
      setOptions(extractOptions(activeField.options));
    } else {
      reset(defaultValues);
      setOptions([]);
    }
    setOptionInput("");
    setOptionsError(null);
    setFormError(null);
  }, [activeField, reset]);

  const addOptionsFromInput = React.useCallback(() => {
    const parsed = optionInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (parsed.length === 0) {
      setOptionsError("Enter at least one option.");
      return;
    }
    setOptions((prev) => normalizeOptions([...prev, ...parsed]));
    setOptionInput("");
    setOptionsError(null);
  }, [optionInput]);

  const handleOptionKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addOptionsFromInput();
    }
  };

  const submitField = async (values: FieldFormValues) => {
    setFormError(null);
    setActionMessage(null);
    setOptionsError(null);

    const normalizedName = values.name.trim();
    const normalizedOptions = normalizeOptions(options);
    if (values.field_type === "select" && normalizedOptions.length === 0) {
      setOptionsError("Add at least one option for select fields.");
      return;
    }

    const payload = {
      name: normalizedName,
      field_type: values.field_type,
      is_required: values.is_required,
      options:
        values.field_type === "select"
          ? { options: normalizedOptions }
          : null
    };

    try {
      if (activeFieldId) {
        const updated = await fieldApi.update(
          collectionId,
          activeFieldId,
          payload
        );
        setFields((prev) =>
          sortFields(
            prev.map((field) => (field.id === updated.id ? updated : field))
          )
        );
        setActionMessage("Field updated.");
      } else {
        const created = await fieldApi.create(collectionId, payload);
        setFields((prev) => sortFields([...prev, created]));
        setActionMessage("Field added.");
        reset(defaultValues);
        setOptions([]);
        setOptionInput("");
      }
    } catch (error) {
      setFormError(
        isApiError(error)
          ? error.detail
          : "We couldn't save the field. Please try again."
      );
    }
  };

  const handleDelete = async (fieldId: number) => {
    const field = fields.find((item) => item.id === fieldId);
    if (!field) {
      return;
    }
    const confirmed = window.confirm(
      `Delete the "${field.name}" field? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    setDeletePending(fieldId);
    setFormError(null);
    setActionMessage(null);
    try {
      await fieldApi.delete(collectionId, fieldId);
      setFields((prev) => prev.filter((item) => item.id !== fieldId));
      if (activeFieldId === fieldId) {
        setActiveFieldId(null);
      }
      setActionMessage("Field deleted.");
    } catch (error) {
      setFormError(
        isApiError(error)
          ? error.detail
          : "We couldn't delete the field. Please try again."
      );
    } finally {
      setDeletePending(null);
    }
  };

  const commitReorder = async (nextFields: FieldDefinitionResponse[]) => {
    setIsReordering(true);
    setReorderError(null);
    setActionMessage(null);
    try {
      const updated = await fieldApi.reorder(
        collectionId,
        nextFields.map((field) => field.id)
      );
      setFields(sortFields(updated));
      setActionMessage("Field order updated.");
    } catch (error) {
      setReorderError(
        isApiError(error)
          ? error.detail
          : "We couldn't reorder fields. Please try again."
      );
      throw error;
    } finally {
      setIsReordering(false);
    }
  };

  const moveField = async (fromIndex: number, toIndex: number) => {
    if (isReordering) {
      return;
    }
    if (toIndex < 0 || toIndex >= fields.length) {
      return;
    }
    const previous = fields;
    const next = arrayMove(previous, fromIndex, toIndex);
    setFields(next);
    try {
      await commitReorder(next);
    } catch {
      setFields(previous);
    }
  };

  const handleDragStart = (
    event: React.DragEvent<HTMLButtonElement>,
    fieldId: number
  ) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(fieldId));
    setDraggingId(fieldId);
  };

  const handleDragOver = (
    event: React.DragEvent<HTMLDivElement>,
    fieldId: number
  ) => {
    event.preventDefault();
    if (dragOverId !== fieldId) {
      setDragOverId(fieldId);
    }
  };

  const handleDrop = async (
    event: React.DragEvent<HTMLDivElement>,
    fieldId: number
  ) => {
    event.preventDefault();
    const sourceId =
      draggingId ?? Number(event.dataTransfer.getData("text/plain"));
    if (!sourceId || sourceId === fieldId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    const fromIndex = fields.findIndex((field) => field.id === sourceId);
    const toIndex = fields.findIndex((field) => field.id === fieldId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    await moveField(fromIndex, toIndex);
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleCancelEdit = () => {
    setActiveFieldId(null);
    setActionMessage(null);
    setFormError(null);
    setOptionsError(null);
  };

  return (
    <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
            Schema builder
          </p>
          <h2 className="font-display mt-3 text-2xl text-stone-900">
            Define the metadata you need.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-stone-600">
            Add, edit, and reorder fields to match how you catalog each item.
            Drag fields to reorder and mark required attributes.
          </p>
        </div>
        <Button variant="outline" onClick={() => loadFields()}>
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {status === "loading" ? (
        <div
          className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white/80 p-6 text-sm text-stone-500"
          aria-busy="true"
        >
          Loading schema fields...
        </div>
      ) : status === "error" ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/80 p-6">
          <p className="text-sm font-medium text-rose-700">
            We hit a snag loading your schema.
          </p>
          <p className="mt-2 text-sm text-rose-600">
            {loadError ?? "Please try again."}
          </p>
          <div className="mt-4">
            <Button variant="outline" onClick={() => loadFields()}>
              Try again
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                Fields
              </p>
              <span className="text-xs text-stone-400">
                {fields.length} total
              </span>
            </div>

            {reorderError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-700">
                {reorderError}
              </div>
            ) : null}

            {fields.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 bg-white/80 p-6 text-sm text-stone-500">
                No fields yet. Add your first field to define the schema.
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field, index) => {
                  const typeMeta = getTypeMeta(field.field_type);
                  const optionSummary = extractOptions(field.options).join(", ");
                  const isActive = field.id === activeFieldId;
                  return (
                    <div
                      key={field.id}
                      className={cn(
                        "rounded-2xl border bg-white/80 p-4 shadow-sm transition",
                        dragOverId === field.id
                          ? "border-amber-300 bg-amber-50/70"
                          : "border-stone-200"
                      )}
                      onDragOver={(event) => handleDragOver(event, field.id)}
                      onDrop={(event) => handleDrop(event, field.id)}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-xl border text-stone-500 transition",
                              draggingId === field.id
                                ? "border-amber-300 bg-amber-50 text-amber-700"
                                : "border-stone-200 bg-stone-50 hover:border-stone-300"
                            )}
                            draggable={!isReordering}
                            aria-label={`Drag to reorder ${field.name}`}
                            onDragStart={(event) =>
                              handleDragStart(event, field.id)
                            }
                            onDragEnd={handleDragEnd}
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-stone-900">
                                {field.name}
                              </p>
                              {field.is_required ? (
                                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-amber-700">
                                  Required
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-stone-500">
                              {typeMeta.label} · {typeMeta.helper}
                            </p>
                            {field.field_type === "select" && optionSummary ? (
                              <p className="mt-2 text-xs text-stone-500">
                                Options: {optionSummary}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant={isActive ? "secondary" : "ghost"}
                            onClick={() => setActiveFieldId(field.id)}
                          >
                            <PencilLine className="h-4 w-4" />
                            {isActive ? "Editing" : "Edit"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(field.id)}
                            disabled={deletePending === field.id}
                          >
                            <Trash2 className="h-4 w-4" />
                            {deletePending === field.id ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1">
                          Position {index + 1}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveField(index, index - 1)}
                          disabled={index === 0 || isReordering}
                        >
                          <ArrowUp className="h-4 w-4" />
                          Move up
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveField(index, index + 1)}
                          disabled={index === fields.length - 1 || isReordering}
                        >
                          <ArrowDown className="h-4 w-4" />
                          Move down
                        </Button>
                        {isReordering ? (
                          <span className="text-xs text-amber-700">
                            Saving order...
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
              {activeField ? "Edit field" : "New field"}
            </p>
            <h3 className="mt-3 text-lg font-semibold text-stone-900">
              {activeField ? "Adjust the field details." : "Add a new field."}
            </h3>
            <p className="mt-2 text-xs text-stone-500">
              Changes apply to new items immediately.
            </p>

            {actionMessage ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {actionMessage}
              </div>
            ) : null}

            {formError ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {formError}
              </div>
            ) : null}

            <form
              className="mt-4 space-y-4"
              onSubmit={handleSubmit(submitField)}
            >
              <div>
                <label className="text-xs font-medium text-stone-700" htmlFor="field-name">
                  Field name
                </label>
                <input
                  id="field-name"
                  type="text"
                  autoComplete="off"
                  className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  aria-invalid={errors.name ? "true" : "false"}
                  {...register("name")}
                />
                {errors.name ? (
                  <p className="mt-2 text-xs text-rose-600">
                    {errors.name.message}
                  </p>
                ) : null}
              </div>

              <div>
                <label
                  className="text-xs font-medium text-stone-700"
                  htmlFor="field-type"
                >
                  Field type
                </label>
                <select
                  id="field-type"
                  className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                  {...register("field_type")}
                >
                  {fieldTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-stone-500">
                  {getTypeMeta(fieldType).helper}
                </p>
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2 text-xs text-stone-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-amber-600"
                  {...register("is_required")}
                />
                Required field
              </label>

              {fieldType === "select" ? (
                <div className="space-y-3">
                  <div>
                    <label
                      className="text-xs font-medium text-stone-700"
                      htmlFor="field-options"
                    >
                      Options
                    </label>
                    <div className="mt-2 flex gap-2">
                      <input
                        id="field-options"
                        type="text"
                        value={optionInput}
                        onChange={(event) => setOptionInput(event.target.value)}
                        onKeyDown={handleOptionKeyDown}
                        placeholder="Add option values"
                        className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm transition focus:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-200"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addOptionsFromInput}
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </Button>
                    </div>
                    {optionsError ? (
                      <p className="mt-2 text-xs text-rose-600">
                        {optionsError}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-stone-500">
                        Separate options with commas or hit enter after each
                        value.
                      </p>
                    )}
                  </div>

                  {options.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {options.map((option) => (
                        <span
                          key={option}
                          className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs text-stone-600"
                        >
                          {option}
                          <button
                            type="button"
                            className="text-stone-400 transition hover:text-stone-600"
                            onClick={() =>
                              setOptions((prev) =>
                                prev.filter((value) => value !== option)
                              )
                            }
                            aria-label={`Remove ${option}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                {activeField ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCancelEdit}
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                ) : null}
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? activeField
                      ? "Updating..."
                      : "Adding..."
                    : activeField
                      ? "Update field"
                      : "Add field"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
