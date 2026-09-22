"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-provider";
import { apiFetch, apiRequest, isApiError } from "@/lib/api";

import { useFocusTrap } from "@/lib/use-focus-trap";

type Preview = { name: string; items: number; photos: number; drafts: number; private_fields: number; digest: string; fields: { name: string; is_private: boolean }[] };

export function CollectionArchive({ collectionId }: { collectionId?: string | number }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const requestId = React.useRef("");
  const dialog = useFocusTrap<HTMLElement>(open, () => { if (!busy) setOpen(false); });
  const message = (error: unknown) => isApiError(error) ? error.detail : error instanceof Error ? error.message : "Transfer failed. Please retry.";
  const exportArchive = async () => {
    setBusy(true); setError(null);
    try {
      const response = await apiFetch(`/collections/${collectionId}/export`);
      if (!response.ok) { const data = await response.json(); throw new Error(data.detail || "Export failed"); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `collection-${collectionId}.zip`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  };
  const inspect = async (file: File) => {
    setFile(file); setPreview(null); setError(null); requestId.current = crypto.randomUUID();
    if (file.size > 250 * 1024 * 1024) { setError("Archive exceeds 250MB"); return; }
    setBusy(true);
    try {
      const body = new FormData(); body.append("file", file);
      const result = await apiRequest<Preview>("/archives/preview", { method: "POST", body });
      setPreview(result); setName(result.name);
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  };
  const restore = async () => {
    if (!file || !preview) return;
    setBusy(true); setError(null);
    try {
      const body = new FormData(); body.append("file", file); body.append("digest", preview.digest);
      body.append("request_id", requestId.current); body.append("name", name.trim());
      const result = await apiRequest<{ collection_id: number }>("/archives/restore", { method: "POST", body });
      setOpen(false); router.push(`/collections/${result.collection_id}`); router.refresh();
    } catch (error) { setError(message(error)); } finally { setBusy(false); }
  };
  return <>
    <Button variant="outline" onClick={() => setOpen(true)}>{t(collectionId ? "Export collection" : "Restore collection")}</Button>
    {open && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/40 p-4">
      <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="archive-title" className="max-h-[85vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-3xl bg-card p-6 shadow-xl">
        <h2 id="archive-title" className="font-display text-2xl">{t(collectionId ? "Export collection" : "Restore collection")}</h2>
        {collectionId ? <>
          <p className="text-sm text-muted-strong">{t("This owner backup includes all photos, drafts, private fields, and preserved values. Keep it somewhere safe.")}</p>
          <Button disabled={busy} onClick={() => void exportArchive()}>{t(busy ? "Preparing backup..." : "Download backup ZIP")}</Button>
        </> : <>
          <p className="text-sm text-muted-strong">{t("Choose an Antique Catalogue backup ZIP, up to 250MB. Restore creates a new private collection and keeps existing collections unchanged.")}</p>
          <label className="block text-sm" htmlFor="archive-file">{t("Backup ZIP")}</label>
          <input id="archive-file" type="file" accept=".zip,application/zip" disabled={busy} className="w-full text-sm" onChange={event => { const chosen = event.target.files?.[0]; if (chosen) void inspect(chosen); }} />
          {busy && <p role="status">{t("Processing archive...")}</p>}
          {preview && <div className="space-y-3 rounded-xl bg-background p-4 text-sm">
            <p>{t("Items")}: {preview.items} · {t("Photos")}: {preview.photos} · {t("Drafts")}: {preview.drafts}</p>
            <p>{t("Private fields")}: {preview.private_fields}</p>
            <p className="break-words">{t("Fields")}: {preview.fields.map(field => field.name).join(", ") || "—"}</p>
            <label className="block" htmlFor="restore-name">{t("Collection name")}</label>
            <input id="restore-name" className="w-full rounded-xl border p-2" value={name} onChange={event => setName(event.target.value)} />
            <Button disabled={busy || !name.trim()} onClick={() => void restore()}>{t("Restore as private collection")}</Button>
          </div>}
        </>}
        {error && <p role="alert" className="break-words text-sm text-destructive">{t(error)}</p>}
        <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>{t("Close")}</Button>
      </section>
    </div>}
  </>;
}
