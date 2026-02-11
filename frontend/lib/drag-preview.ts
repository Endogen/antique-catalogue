import * as React from "react";

type DragPreviewOptions = {
  radius?: number;
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

export const setRoundedDragPreview = (
  event: React.DragEvent<HTMLElement>,
  options?: DragPreviewOptions
) => {
  if (!event.dataTransfer) {
    return;
  }

  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return;
  }

  const styles = window.getComputedStyle(target);
  const parsedRadius = Number.parseFloat(styles.borderRadius || "0");
  const fallbackRadius = Number.isNaN(parsedRadius) ? 0 : parsedRadius;
  const borderRadius = options?.radius ?? fallbackRadius;
  const parsedBorderWidth = Number.parseFloat(styles.borderWidth || "0");
  const borderWidth = Number.isNaN(parsedBorderWidth) ? 0 : parsedBorderWidth;
  const devicePixelRatio = window.devicePixelRatio || 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(rect.width * devicePixelRatio);
  canvas.height = Math.ceil(rect.height * devicePixelRatio);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.scale(devicePixelRatio, devicePixelRatio);

  drawRoundedRect(ctx, 0, 0, rect.width, rect.height, borderRadius);
  ctx.fillStyle = styles.backgroundColor || "transparent";
  ctx.fill();

  if (borderWidth > 0 && styles.borderStyle !== "none") {
    ctx.strokeStyle = styles.borderColor || "transparent";
    ctx.lineWidth = borderWidth;
    ctx.stroke();
  }

  const lineWidth = Math.max(1, Math.min(2.5, rect.width * 0.06));
  const center = rect.width / 2;
  const gap = rect.width * 0.12;
  const top = rect.height * 0.28;
  const bottom = rect.height * 0.72;

  ctx.beginPath();
  ctx.strokeStyle = styles.color || "#000";
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.moveTo(center - gap, top);
  ctx.lineTo(center - gap, bottom);
  ctx.moveTo(center + gap, top);
  ctx.lineTo(center + gap, bottom);
  ctx.stroke();

  event.dataTransfer.setDragImage(canvas, rect.width / 2, rect.height / 2);
};
