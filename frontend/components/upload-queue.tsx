"use client";
import * as React from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, CloudUpload } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { discardUpload, listUploads, scheduleUpload, type UploadJob } from "@/lib/upload-queue";
import { cn } from "@/lib/utils";

/** This user's queued photos, kept in sync with the on-device queue. */
function useUploadJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = React.useState<UploadJob[]>([]);
  React.useEffect(() => {
    if (!user) return;
    let mounted = true;
    const read = async () => {
      try { const all = await listUploads(); if (mounted) setJobs(all.filter(job => job.owner === user.id)); }
      catch { /* Upload attempts surface unavailable storage. */ }
    };
    void read();
    window.addEventListener("upload-queue-change", read);
    return () => { mounted = false; window.removeEventListener("upload-queue-change", read); };
  }, [user]);
  return user ? jobs : [];
}

/** Resumes unfinished uploads on load and reconnect. Mount once per page. */
export function UploadQueueSync() {
  const { user } = useAuth();
  React.useEffect(() => {
    if (!user) return;
    let mounted = true;
    const resume = async () => {
      try {
        const all = await listUploads();
        for (const job of all.filter(job => job.owner === user.id && job.state !== "done")) {
          if (!mounted) return;
          await scheduleUpload(job.id).catch(() => undefined);
        }
      } catch { /* Storage failure is surfaced on selection. */ }
    };
    void resume();
    window.addEventListener("online", resume);
    return () => { mounted = false; window.removeEventListener("online", resume); };
  }, [user]);
  return null;
}

/**
 * Header control for the upload queue. Renders nothing while the queue is
 * empty, so it only takes space in the toolbar that hosts it when needed.
 */
export function UploadQueueButton({ className }: { className?: string }) {
  const { t } = useI18n();
  const jobs = useUploadJobs();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  if (!jobs.length) return null;
  const pending = jobs.filter(job => job.state !== "done").length;
  const failed = jobs.some(job => job.state === "error");
  const Icon = failed ? AlertCircle : pending ? CloudUpload : CheckCircle2;
  const label = `${t("Uploads")} (${pending})`;

  return <div ref={rootRef} className={cn("relative", className)}>
    <button
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-10 shrink-0 items-center justify-center gap-2 rounded-full border bg-card px-3 text-sm font-medium shadow-xs transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        failed ? "border-destructive-border text-destructive" : pending ? "border-brand-border text-brand" : "border-border text-success"
      )}
    >
      <Icon className={cn("h-4 w-4", pending && !failed && "animate-pulse")} aria-hidden="true" />
      <span className="hidden sm:inline">{t("Uploads")}</span>
      {pending ? <span className="tabular-nums">{pending}</span> : null}
    </button>
    {open && <div className="absolute right-0 top-full z-50 mt-2 max-h-[65vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-border bg-card p-4 text-left shadow-xl">
      <p className="mb-3 text-sm text-muted-strong">{t("Photos resume on this device after reconnecting or reopening the app.")}</p>
      {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
      {jobs.map(job => <div key={job.id} className="space-y-2 border-t py-3 text-sm">
        <p className="break-all font-medium">{job.filename}</p>
        <progress className="w-full accent-brand" value={job.received} max={job.size} aria-label={job.filename} />
        <p className="text-muted-strong">{job.state === "done" ? t("Uploaded") : `${Math.floor(job.received / job.size * 100)}%`}</p>
        {job.error && <p className="wrap-break-word text-xs text-destructive">{t(job.error)}</p>}
        <div className="flex gap-2">
          {job.result ? <Button size="sm" asChild><Link href={`/collections/${job.result.collection_id}/items/${job.result.item_id}`}>{t("View item")}</Link></Button>
            : <Button size="sm" disabled={job.state === "uploading"} onClick={() => { setError(null); void scheduleUpload(job.id).catch(e => setError(e.message)); }}>{t("Resume upload")}</Button>}
          <Button size="sm" variant="ghost" disabled={job.state === "uploading"} onClick={() => { setError(null); void discardUpload(job).catch(e => setError(e.detail || e.message)); }}>{t(job.state === "done" ? "Dismiss" : "Discard upload")}</Button>
        </div>
      </div>)}
    </div>}
  </div>;
}
