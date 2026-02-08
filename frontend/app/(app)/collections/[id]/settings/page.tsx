"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Globe2,
  Lock,
  RefreshCcw,
  Settings2
} from "lucide-react";

import {
  CollectionForm,
  type CollectionFormValues
} from "@/components/collection-form";
import { SchemaBuilder } from "@/components/schema-builder";
import { Button } from "@/components/ui/button";
import {
  collectionApi,
  isApiError,
  type CollectionResponse
} from "@/lib/api";

const formatDate = (value?: string | null) => {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(parsed);
};

const buildPayload = (values: CollectionFormValues) => ({
  name: values.name.trim(),
  description: values.description.trim() ? values.description.trim() : null,
  is_public: values.is_public
});

type LoadState = {
  status: "loading" | "ready" | "error";
  data?: CollectionResponse;
  error?: string;
};

export default function CollectionSettingsPage() {
  const params = useParams();
  const collectionId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [state, setState] = React.useState<LoadState>({
    status: "loading"
  });
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);

  const loadCollection = React.useCallback(async () => {
    if (!collectionId) {
      setState({
        status: "error",
        error: "Collection ID was not provided."
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      status: "loading",
      error: undefined
    }));

    try {
      const data = await collectionApi.get(collectionId);
      setState({
        status: "ready",
        data
      });
    } catch (error) {
      setState({
        status: "error",
        error: isApiError(error)
          ? error.detail
          : "We couldn't load this collection."
      });
    }
  }, [collectionId]);

  React.useEffect(() => {
    void loadCollection();
  }, [loadCollection]);

  const handleSubmit = async (values: CollectionFormValues) => {
    if (!collectionId) {
      return;
    }
    setFormError(null);
    setSaveMessage(null);
    try {
      const updated = await collectionApi.update(
        collectionId,
        buildPayload(values)
      );
      setState({
        status: "ready",
        data: updated
      });
      setSaveMessage("Changes saved successfully.");
    } catch (error) {
      setFormError(
        isApiError(error)
          ? error.detail
          : "We couldn't save changes. Please try again."
      );
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/collections">
              <ArrowLeft className="h-4 w-4" />
              Back to collections
            </Link>
          </Button>
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-amber-700">
              Collection settings
            </p>
            <h1 className="font-display mt-4 text-3xl text-stone-900">
              {state.status === "ready" && state.data
                ? state.data.name
                : "Review collection details"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-stone-600">
              Update the collection name, description, and public visibility.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => loadCollection()}>
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>

      {state.status === "loading" ? (
        <div
          className="rounded-3xl border border-dashed border-stone-200 bg-white/80 p-8 text-sm text-stone-500"
          aria-busy="true"
        >
          Loading collection settings...
        </div>
      ) : state.status === "error" ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50/80 p-6">
          <p className="text-sm font-medium text-rose-700">
            We hit a snag loading this collection.
          </p>
          <p className="mt-2 text-sm text-rose-600">
            {state.error ?? "Please try again."}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => loadCollection()}>
              Try again
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/collections">Back to collections</Link>
            </Button>
          </div>
        </div>
      ) : (
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                Collection details
              </p>
              <h2 className="font-display mt-3 text-2xl text-stone-900">
                Keep your catalogue organized.
              </h2>
              <p className="mt-3 text-sm text-stone-600">
                These details appear throughout your workspace and in the public
                directory if enabled.
              </p>

              {saveMessage ? (
                <div
                  role="status"
                  className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                >
                  {saveMessage}
                </div>
              ) : null}

              <div className="mt-6">
                <CollectionForm
                  initialValues={{
                    name: state.data?.name ?? "",
                    description: state.data?.description ?? "",
                    is_public: state.data?.is_public ?? false
                  }}
                  onSubmit={handleSubmit}
                  submitLabel="Save changes"
                  submitPendingLabel="Saving changes..."
                  secondaryAction={
                    <Button variant="ghost" type="button" asChild>
                      <Link href="/collections">Back to collections</Link>
                    </Button>
                  }
                  formError={formError}
                />
              </div>
            </div>

            <SchemaBuilder collectionId={collectionId ?? ""} />
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-stone-200 bg-white/80 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
                Collection snapshot
              </p>
              <h3 className="font-display mt-3 text-2xl text-stone-900">
                Quick details
              </h3>
              <div className="mt-6 space-y-4 text-sm text-stone-600">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">Created</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {formatDate(state.data?.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                    <Settings2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">Last updated</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {formatDate(state.data?.updated_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                    {state.data?.is_public ? (
                      <Globe2 className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-stone-900">Visibility</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {state.data?.is_public
                        ? "Public directory"
                        : "Private workspace"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-stone-900/90 bg-gradient-to-br from-stone-950 via-stone-900 to-stone-800 p-6 text-stone-100 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-stone-400">
                Next step
              </p>
              <p className="mt-3 text-sm text-stone-300">
                Define the metadata fields for this collection to begin adding
                items in the next step.
              </p>
            </div>
          </aside>
        </section>
      )}
    </div>
  );
}
