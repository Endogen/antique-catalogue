"use client";
import * as React from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { discardUpload, listUploads, resumeUpload, type UploadJob } from "@/lib/upload-queue";

export function UploadQueue() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [jobs, setJobs] = React.useState<UploadJob[]>([]);
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!user) return;
    let mounted = true;
    const read = async () => {
      try { const all = await listUploads(); if (mounted) setJobs(all.filter(job => job.owner === user.id)); }
      catch { /* Upload attempts surface unavailable storage. */ }
    };
    const resume = async () => {
      try {
        const all = await listUploads();
        for (const job of all.filter(job => job.owner === user.id && job.state !== "done")) {
          if (!mounted) return;
          await resumeUpload(job.id).catch(() => undefined);
        }
      } catch { /* Storage failure is surfaced on selection. */ }
    };
    void read(); void resume();
    window.addEventListener("upload-queue-change", read);
    window.addEventListener("online", resume);
    return () => { mounted = false; window.removeEventListener("upload-queue-change", read); window.removeEventListener("online", resume); };
  }, [user]);
  if (!user || !jobs.length) return null;
  return <aside className="fixed right-3 top-20 z-[70] max-w-[calc(100vw-1.5rem)]" aria-label={t("Uploads")}>
    <Button variant="outline" className="float-right bg-card shadow" onClick={() => setOpen(!open)} aria-expanded={open}>
      {t("Uploads")} ({jobs.filter(job => job.state !== "done").length})
    </Button>
    {open && <div className="clear-both mt-2 max-h-[65vh] w-80 overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-xl">
      <p className="mb-3 text-sm text-muted-strong">{t("Photos resume on this device after reconnecting or reopening the app.")}</p>
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      {jobs.map(job => <div key={job.id} className="space-y-2 border-t py-3 text-sm">
        <p className="break-all font-medium">{job.filename}</p>
        <progress className="w-full accent-brand" value={job.received} max={job.size} aria-label={job.filename} />
        <p>{job.state === "done" ? t("Uploaded") : `${Math.floor(job.received / job.size * 100)}%`}</p>
        {job.error && <p className="break-words text-xs text-destructive">{t(job.error)}</p>}
        <div className="flex gap-2">
          {job.result ? <Button size="sm" asChild><Link href={`/collections/${job.result.collection_id}/items/${job.result.item_id}`}>{t("View item")}</Link></Button>
            : <Button size="sm" disabled={job.state === "uploading"} onClick={() => { setError(null); void resumeUpload(job.id).catch(e => setError(e.message)); }}>{t("Resume upload")}</Button>}
          <Button size="sm" variant="ghost" disabled={job.state === "uploading"} onClick={() => { setError(null); void discardUpload(job).catch(e => setError(e.detail || e.message)); }}>{t(job.state === "done" ? "Dismiss" : "Discard upload")}</Button>
        </div>
      </div>)}
    </div>}
  </aside>;
}
