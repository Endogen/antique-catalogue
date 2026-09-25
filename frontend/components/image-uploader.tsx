"use client";

import * as React from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  UploadCloud
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { type ItemImageResponse } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { enqueuePhotos, listUploads, scheduleUpload, validatePhoto } from "@/lib/upload-queue";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { createUuid } from "@/lib/uuid";
import { Eyebrow } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";

const formatFileSize = (bytes: number) => {
  if (bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / Math.pow(1024, exponent);
  const precision = value >= 10 || exponent === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[exponent]}`;
};

type UploadEntry = {
  id: string;
  filename: string;
  size: number;
  status: "saving" | "queued" | "uploading" | "success" | "error";
  error?: string;
  persisted?: boolean;
};

export type ImageUploaderProps = {
  itemId?: number | string | null;
  disabled?: boolean;
  onUploaded?: (image: ItemImageResponse) => void;
  /**
   * Fill a 4:3 area, matching the empty photo placeholder in view mode, while
   * the item has no photos yet.
   */
  expanded?: boolean;
};

export function ImageUploader({
  itemId,
  disabled = false,
  onUploaded,
  expanded = false
}: ImageUploaderProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [uploads, setUploads] = React.useState<UploadEntry[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const dragCounter = React.useRef(0);

  React.useEffect(() => {
    const completed = (event: Event) => {
      const image = (event as CustomEvent<ItemImageResponse>).detail;
      if (image.item_id === Number(itemId)) onUploaded?.(image);
    };
    window.addEventListener("photo-uploaded", completed);
    return () => window.removeEventListener("photo-uploaded", completed);
  }, [itemId, onUploaded]);

  const isReady = Boolean(itemId) && !disabled;

  React.useEffect(() => {
    let mounted = true;
    const read = async () => {
      try {
        const jobs = (await listUploads()).filter(job => job.owner === user?.id && job.target.item_id === Number(itemId));
        if (!mounted) return;
        setUploads(previous => {
          const saved = jobs.map(job => ({
            id: job.id, filename: job.filename, size: job.size, persisted: true,
            status: job.state === "done" ? "success" as const : job.state,
            error: job.state === "error" ? t("Photo saved on this device. Open Uploads to resume.") : undefined
          }));
          const ids = new Set(saved.map(job => job.id));
          return [...saved, ...previous.filter(entry => !ids.has(entry.id) && !entry.persisted && (entry.status === "saving" || entry.status === "error"))];
        });
      } catch { /* Selection surfaces storage errors. */ }
    };
    void read();
    window.addEventListener("upload-queue-change", read);
    return () => { mounted = false; window.removeEventListener("upload-queue-change", read); };
  }, [itemId, user?.id, t]);

  const handleFiles = React.useCallback(
    (files: FileList | File[]) => {
      if (!itemId || disabled) return;
      const selections = Array.from(files).map(file => ({ id: createUuid(), file, target: { mode: "item" as const, item_id: Number(itemId) } }));
      if (!selections.length) return;
      setGlobalError(null);
      const entries: UploadEntry[] = selections.map(({ id, file }) => {
        try {
          validatePhoto(file);
          return { id, filename: file.name, size: file.size, status: "saving" };
        } catch (error) {
          return { id, filename: file.name, size: file.size, status: "error", error: t((error as Error).message) };
        }
      });
      setUploads(previous => [...previous, ...entries]);
      const valid = selections.filter(selection => entries.find(entry => entry.id === selection.id)?.status === "saving");
      void enqueuePhotos(valid).then(ids => {
        for (const id of ids) void scheduleUpload(id).catch(() => {});
      }).catch((error: Error) => {
        setGlobalError(t(error.message));
        const ids = new Set(valid.map(selection => selection.id));
        setUploads(previous => previous.map(entry => ids.has(entry.id) ? { ...entry, status: "error", error: t(error.message) } : entry));
      });
    },
    [itemId, disabled, t]
  );

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    if (files) {
      handleFiles(files);
    }
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    if (event.dataTransfer.files?.length) {
      handleFiles(event.dataTransfer.files);
    }
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const hasUploads = uploads.length > 0;

  // Rendered inside the photos panel, so it brings no card or heading of its
  // own: the drop zone holds the actions, the queue reports progress.
  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-2xl border border-dashed px-4 py-6 text-center transition",
          expanded && "flex aspect-4/3 items-center justify-center",
          isReady ? "border-border bg-background/60" : "border-border bg-background/30",
          isDragging && "border-brand bg-brand-muted/70"
        )}
        onDrop={isReady ? handleDrop : undefined}
        onDragEnter={isReady ? handleDragEnter : undefined}
        onDragLeave={isReady ? handleDragLeave : undefined}
        onDragOver={isReady ? handleDragOver : undefined}
      >
        <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card text-brand shadow-xs">
            <UploadCloud className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("Drop images to upload")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("JPG, PNG, WebP, or HEIC. Photos are resized before uploading.")}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleInputChange}
            disabled={!isReady}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleInputChange}
            disabled={!isReady}
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={!isReady}
            >
              <ImagePlus className="h-4 w-4" />
              {t("Browse files")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => cameraInputRef.current?.click()}
              disabled={!isReady}
            >
              <Camera className="h-4 w-4" />
              {t("Use camera")}
            </Button>
          </div>
        </div>
      </div>

      {!isReady ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="h-4 w-4 text-brand" />
          {t("Finish loading the item to enable image uploads.")}
        </div>
      ) : null}

      {globalError ? (
        <Alert
          role="alert">
          {globalError}
        </Alert>
      ) : null}

      {hasUploads ? (
        <div className="rounded-2xl border border-border bg-background/60 p-4">
          <Eyebrow spacing="tight">
            {t("Upload queue")}
          </Eyebrow>
          <div className="mt-3 max-h-40 space-y-3 overflow-y-auto pr-2 text-sm">
            {uploads.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {entry.filename}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(entry.size)}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {entry.status === "uploading" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-brand" />
                      <span className="text-brand">{t("Uploading")}</span>
                    </>
                  ) : entry.status === "success" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-success" />
                      <span className="text-success">{t("Uploaded")}</span>
                    </>
                  ) : entry.status === "error" ? (
                    <>
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="text-destructive">
                        {entry.error ?? t("Upload failed")}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">{t(entry.status === "saving" ? "Saving on this device..." : "Queued")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
