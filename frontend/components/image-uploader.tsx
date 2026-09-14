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
import {
  imageApi,
  isApiError,
  type ItemImageResponse
} from "@/lib/api";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { Alert } from "@/components/ui/alert";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

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

const buildUploadId = (file: File, index: number) =>
  `${file.name}-${file.size}-${file.lastModified}-${index}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const isSupportedImage = (file: File) => {
  if (!file.type) {
    return true;
  }
  return file.type.startsWith("image/");
};

type UploadStatus = "queued" | "uploading" | "success" | "error";

type UploadEntry = {
  id: string;
  file: File;
  status: UploadStatus;
  error?: string;
};

export type ImageUploaderProps = {
  itemId?: number | string | null;
  disabled?: boolean;
  onUploaded?: (image: ItemImageResponse) => void;
};

export function ImageUploader({
  itemId,
  disabled = false,
  onUploaded
}: ImageUploaderProps) {
  const { t } = useI18n();
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

  const updateUpload = React.useCallback((id: string, patch: Partial<UploadEntry>) => {
    setUploads((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    );
  }, []);

  const uploadEntries = React.useCallback(
    async (entries: UploadEntry[]) => {
      if (!itemId) {
        setGlobalError(t("Upload is unavailable until the item finishes loading."));
        return;
      }

      for (const entry of entries) {
        updateUpload(entry.id, { status: "uploading", error: undefined });
        try {
          await imageApi.upload(itemId, entry.file);
          updateUpload(entry.id, { status: "success" });
        } catch (error) {
          updateUpload(entry.id, {
            status: "error",
            error: isApiError(error)
              ? t(error.detail)
              : t(error instanceof Error ? error.message : "We couldn't upload this image.")
          });
        }
      }
    },
    [itemId, t, updateUpload]
  );

  const handleFiles = React.useCallback(
    (files: FileList | File[]) => {
      const fileList = Array.from(files);
      if (!fileList.length) {
        return;
      }

      setGlobalError(null);

      const entries: UploadEntry[] = fileList.map((file, index) => {
        const entry: UploadEntry = {
          id: buildUploadId(file, index),
          file,
          status: "queued"
        };

        if (!isSupportedImage(file)) {
          return {
            ...entry,
            status: "error",
            error: t("Unsupported file type")
          };
        }

        if (file.size > MAX_IMAGE_BYTES) {
          return {
            ...entry,
            status: "error",
            error: t("File exceeds the 10MB limit")
          };
        }

        return entry;
      });

      setUploads((prev) => [...entries, ...prev]);

      const validEntries = entries.filter((entry) => entry.status === "queued");
      if (validEntries.length > 0) {
        void uploadEntries(validEntries);
      }
    },
    [t, uploadEntries]
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

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>
            {t("Images")}
          </Eyebrow>
          <SectionHeading as="h3" className="mt-3">
            {t("Upload imagery")}
          </SectionHeading>
          <p className="mt-3 max-w-xl text-sm text-muted-strong">
            {t(
              "Drag photos here, browse files, or capture new images straight from your device camera."
            )}
          </p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-muted text-brand">
          <ImagePlus className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div
          className={cn(
            "rounded-2xl border border-dashed px-6 py-8 text-center transition",
            isReady
              ? "border-border bg-background/70"
              : "border-border bg-background/40",
            isDragging ? "border-brand bg-brand-muted/70" : ""
          )}
          onDrop={isReady ? handleDrop : undefined}
          onDragEnter={isReady ? handleDragEnter : undefined}
          onDragLeave={isReady ? handleDragLeave : undefined}
          onDragOver={isReady ? handleDragOver : undefined}
        >
          <div className="mx-auto flex max-w-xs flex-col items-center gap-3 text-sm text-muted-strong">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-brand shadow-sm">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                {t("Drop images to upload")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("JPG, PNG, WebP, or HEIC. Up to 10MB each.")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
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
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isReady}
          >
            {t("Browse files")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => cameraInputRef.current?.click()}
            disabled={!isReady}
          >
            <Camera className="h-4 w-4" />
            {t("Use camera")}
          </Button>
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
                  <div>
                    <p className="font-medium text-foreground">
                      {entry.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(entry.file.size)}
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
                      <span className="text-muted-foreground">{t("Queued")}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
