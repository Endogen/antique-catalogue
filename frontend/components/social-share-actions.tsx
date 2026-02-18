"use client";

import * as React from "react";
import { Copy, Share2 } from "lucide-react";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";

type SocialShareActionsProps = {
  path: string | null;
  title: string;
  text?: string | null;
  className?: string;
};

const buildShareText = (title: string, text?: string | null): string => {
  const summary = (text ?? "").trim();
  if (!summary) {
    return title;
  }
  const normalized = summary.replace(/\s+/g, " ");
  return normalized.length > 120 ? `${title} — ${normalized.slice(0, 117)}...` : `${title} — ${normalized}`;
};

export function SocialShareActions({
  path,
  title,
  text,
  className
}: SocialShareActionsProps) {
  const { t } = useI18n();
  const { toast } = useToast();

  const resolveShareUrl = React.useCallback(() => {
    if (!path || typeof window === "undefined") {
      return null;
    }
    try {
      return new URL(path, window.location.origin).toString();
    } catch {
      return null;
    }
  }, [path]);

  const handleCopyLink = React.useCallback(async () => {
    const url = resolveShareUrl();
    if (!url) {
      toast({
        tone: "error",
        message: t("Unable to generate a share link.")
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast({
        tone: "success",
        message: t("Link copied.")
      });
    } catch {
      toast({
        tone: "error",
        message: t("Unable to share right now.")
      });
    }
  }, [resolveShareUrl, t, toast]);

  const handleNativeShare = React.useCallback(async () => {
    const url = resolveShareUrl();
    if (!url) {
      toast({
        tone: "error",
        message: t("Unable to generate a share link.")
      });
      return;
    }

    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      void handleCopyLink();
      return;
    }

    try {
      await navigator.share({
        title,
        text: buildShareText(title, text),
        url
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      toast({
        tone: "error",
        message: t("Unable to share right now.")
      });
    }
  }, [handleCopyLink, resolveShareUrl, t, text, title, toast]);

  const disabled = !path;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button variant="outline" size="sm" onClick={() => void handleNativeShare()} disabled={disabled}>
        <Share2 className="h-4 w-4" />
        {t("Share")}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => void handleCopyLink()} disabled={disabled}>
        <Copy className="h-4 w-4" />
        {t("Copy link")}
      </Button>
    </div>
  );
}
