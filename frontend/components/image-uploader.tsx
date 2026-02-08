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
import { cn } from "@/lib/utils";

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
  const [uploads, setUploads] = React.useState<UploadEntry[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const cameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const dragCounter = React.useRef(0);

  const isReady = Boolean(itemId) && !disabled;

  const updateUpload = React.useCallback((id: string, patch: Partial<UploadEntry>) => {
    setUploads((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    );
  }, []);

  const uploadEntries = React.useCallback(
    async (entries: UploadEntry[]) => {
      if (!itemId) {
        setGlobalError("Upload is unavailable until the item finishes loading.");
        return;
      }

      for (const entry of entries) {
        updateUpload(entry.id, { status: "uploading", error: undefined });
        try {
          const image = await imageApi.upload(itemId, entry.file);
          updateUpload(entry.id, { status: "success" });
          onUploaded?.(image);
        } catch (error) {
          updateUpload(entry.id, {
            status: "error",
            error: isApiError(error)
              ? error.detail
              : "We couldn't upload this image."
          });
        }
      }
    },
    [itemId, onUploaded, updateUpload]
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
            error: "Unsupported file type"
          };
        }

        if (file.size > MAX_IMAGE_BYTES) {
          return {
            ...entry,
            status: "error",
            error: "File exceeds the 10MB limit"
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
    [uploadEntries]
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
    <div className="rounded-3xl border border-stone-200 bg-white/90 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-stone-500">
            Images
          </p>
          <h3 className="font-display mt-3 text-2xl text-stone-900">
            Upload imagery
          </h3>
          <p className="mt-3 max-w-xl text-sm text-stone-600">
            Drag photos here, browse files, or capture new images straight from
            your device camera.
          </p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <ImagePlus className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div
          className={cn(
            "rounded-2xl border border-dashed px-6 py-8 text-center transition",
            isReady
              ? "border-stone-200 bg-stone-50/70"
              : "border-stone-200 bg-stone-50/40",
            isDragging ? "border-amber-400 bg-amber-50/70" : ""
          )}
          onDrop={isReady ? handleDrop : undefined}
          onDragEnter={isReady ? handleDragEnter : undefined}
          onDragLeave={isReady ? handleDragLeave : undefined}
          onDragOver={isReady ? handleDragOver : undefined}
        >
          <div className="mx-auto flex max-w-xs flex-col items-center gap-3 text-sm text-stone-600">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-stone-900">Drop images to upload</p>
              <p className="mt-1 text-xs text-stone-500">
                JPG, PNG, WebP, or HEIC. Up to 10MB each.
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
            Browse files
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => cameraInputRef.current?.click()}
            disabled={!isReady}
          >
            <Camera className="h-4 w-4" />
            Use camera
          </Button>
        </div>

        {!isReady ? (
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Finish loading the item to enable image uploads.
          </div>
        ) : null}

        {globalError ? (
          <div
            role="alert"
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {globalError}
          </div>
        ) : null}

        {hasUploads ? (
          <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-stone-500">
              Upload queue
            </p>
            <div className="mt-3 max-h-40 space-y-3 overflow-y-auto pr-2 text-sm">
              {uploads.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-stone-900">
                      {entry.file.name}
                    </p>
                    <p className="text-xs text-stone-500">
                      {formatFileSize(entry.file.size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {entry.status === "uploading" ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                        <span className="text-amber-700">Uploading</span>
                      </>
                    ) : entry.status === "success" ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span className="text-emerald-700">Uploaded</span>
                      </>
                    ) : entry.status === "error" ? (
                      <>
                        <AlertTriangle className="h-4 w-4 text-rose-600" />
                        <span className="text-rose-600">
                          {entry.error ?? "Upload failed"}
                        </span>
                      </>
                    ) : (
                      <span className="text-stone-500">Queued</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
