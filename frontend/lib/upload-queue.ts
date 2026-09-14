"use client";

import { apiRequest, authApi, getAccessToken } from "@/lib/api";
import type { ItemImageResponse, SpeedCaptureNewResponse } from "@/lib/api";

export type UploadTarget = { mode: "item" | "capture-new" | "capture-add"; item_id?: number; collection_id?: number };
export type UploadResult = ItemImageResponse & SpeedCaptureNewResponse & { mode: UploadTarget["mode"] };
export type UploadJob = {
  id: string; owner: number; target: UploadTarget; file: Blob; filename: string; size: number;
  received: number; state: "queued" | "uploading" | "error" | "done"; error?: string; result?: UploadResult;
};
type Receipt = { received: number; chunk_size: number; result: UploadResult | null };
const active = new Map<string, Promise<UploadResult>>();
const changed = () => window.dispatchEvent(new Event("upload-queue-change"));

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("antique-upload-queue", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("uploads", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Could not save the photo on this device. Check browser storage and retry."));
  });
}
async function access<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("uploads", mode);
    const request = operation(transaction.objectStore("uploads"));
    transaction.oncomplete = () => { db.close(); resolve(request.result); };
    transaction.onabort = transaction.onerror = () => { db.close(); reject(new Error("Could not save the photo on this device. Check browser storage and retry.")); };
  });
}
export const listUploads = () => access("readonly", store => store.getAll()) as Promise<UploadJob[]>;
const get = (id: string) => access("readonly", store => store.get(id)) as Promise<UploadJob | undefined>;
async function save(job: UploadJob) { await access("readwrite", store => store.put(job)); changed(); }

export async function discardUpload(job: UploadJob) {
  if (active.has(job.id)) throw new Error("Wait for the current attempt to finish.");
  if (job.state !== "done") {
    try { await apiRequest(`/uploads/${job.id}`, { method: "DELETE" }); }
    catch (error) { if ((error as { status?: number }).status !== 404) throw error; }
  }
  await access("readwrite", store => store.delete(job.id)); changed();
}

export function resumeUpload(id: string): Promise<UploadResult> {
  const running = active.get(id);
  if (running) return running;
  const execute = async () => {
    const job = await get(id);
    if (!job) throw new Error("Upload not found on this device.");
    if (job.result) return job.result;
    try {
      if ((await authApi.me()).id !== job.owner) throw new Error("Sign in to the account that queued this photo.");
      job.state = "uploading"; job.error = undefined; await save(job);
      let receipt = await apiRequest<Receipt>("/uploads", { method: "POST", body: {
        id: job.id, target: job.target, filename: job.filename, size: job.size,
      } });
      job.received = receipt.received; await save(job);
      while (!receipt.result && job.received < job.size) {
        receipt = await apiRequest<Receipt>(`/uploads/${job.id}?offset=${job.received}`, {
          method: "PUT", headers: { "Content-Type": "application/octet-stream" },
          body: job.file.slice(job.received, job.received + receipt.chunk_size),
        });
        job.received = receipt.received; await save(job);
      }
      if (!receipt.result) receipt = await apiRequest<Receipt>(`/uploads/${job.id}/complete`, { method: "POST" });
      if (!receipt.result) throw new Error("Upload did not complete. Please retry.");
      job.result = receipt.result; job.state = "done"; job.file = new Blob(); await save(job);
      window.dispatchEvent(new CustomEvent("photo-uploaded", { detail: job.result }));
      return job.result;
    } catch (error) {
      job.state = "error";
      job.error = (error as { detail?: string }).detail || (error instanceof TypeError ? "Connection interrupted. Resume when you are back online." : error instanceof Error ? error.message : "Connection interrupted. Resume from Uploads.");
      await save(job);
      throw new Error("Photo saved on this device. Open Uploads to resume.");
    }
  };
  // Coordinate tabs as well as callers in this tab; server receipts are the final safeguard.
  const promise: Promise<UploadResult> = (async () => {
    if (navigator.locks) return await navigator.locks.request(`antique-upload-${id}`, execute);
    return execute();
  })().finally(() => { active.delete(id); });
  active.set(id, promise);
  return promise;
}

export async function uploadPhoto(target: UploadTarget, file: File): Promise<UploadResult> {
  if (!file.size || file.size > 10 * 1024 * 1024 || (file.type && !file.type.startsWith("image/"))) {
    throw new Error("Choose an image up to 10MB.");
  }
  // Decode only to partition local storage; the server validates every transfer.
  let owner: number;
  try { owner = Number(JSON.parse(atob(getAccessToken()!.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub); }
  catch { throw new Error("Sign in before selecting photos."); }
  if (!Number.isSafeInteger(owner) || owner < 1) throw new Error("Sign in before selecting photos.");
  const jobs = await listUploads();
  if (jobs.filter(job => job.state !== "done").length >= 20) throw new Error("Finish or discard pending uploads first.");
  const job: UploadJob = { id: crypto.randomUUID(), owner, target, file, filename: file.name,
    size: file.size, received: 0, state: "queued" };
  await save(job);
  // Persistent storage is best effort; browsers may still evict data under storage pressure.
  void navigator.storage?.persist?.().catch(() => false);
  return resumeUpload(job.id);
}
