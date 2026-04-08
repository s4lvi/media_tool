import * as fabric from "fabric";
import type { FrameTemplate, FrameObject } from "@/types/frame-template";
import { renderFrameTemplate } from "./renderer";

/**
 * Export a video by:
 *  1. Pre-rendering the frame template overlay (no photos) as a transparent
 *     PNG using a render-twice-and-diff approach so the photo zone area is
 *     truly transparent regardless of zIndex/render order
 *  2. Spawning a web worker that demuxes the source video with mp4box,
 *     decodes via WebCodecs hardware decoder, composites onto OffscreenCanvas,
 *     re-encodes via WebCodecs hardware encoder, and muxes to MP4 or WebM
 */
export async function exportVideoWithFrame(
  template: FrameTemplate,
  videoUrl: string,
  texts: { heading?: string; subheading?: string },
  format: "webm" | "mp4" = "mp4",
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const tw = Math.floor(template.width / 2) * 2;
  const th = Math.floor(template.height / 2) * 2;

  const photoZone = template.objects.find((o) => o.type === "photo-zone");
  if (!photoZone) throw new Error("Template has no photo zone for the video");
  const pz = {
    x: photoZone.x,
    y: photoZone.y,
    width: photoZone.width,
    height: photoZone.height,
  };

  onProgress?.(0.05);
  const overlayBlob = await renderOverlayBlob(template, texts, tw, th);
  onProgress?.(0.2);

  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error("Failed to fetch source video");
  const videoBlob = await videoRes.blob();
  onProgress?.(0.3);

  const worker = new Worker(new URL("../../workers/video-export.worker.ts", import.meta.url), {
    type: "module",
  });

  return new Promise<Blob>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === "progress" && onProgress) {
        onProgress(0.3 + msg.pct * 0.7);
      }
      if (msg.type === "done") {
        worker.terminate();
        resolve(msg.blob);
      }
      if (msg.type === "error") {
        worker.terminate();
        reject(new Error(msg.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error("Worker error: " + (e.message || "unknown")));
    };

    worker.postMessage({
      type: "export",
      videoBlob,
      overlayBlob,
      photoZone: pz,
      templateWidth: template.width,
      templateHeight: template.height,
      outputFormat: format,
    });
  });
}

async function renderOverlayBlob(
  template: FrameTemplate,
  texts: { heading?: string; subheading?: string },
  width: number,
  height: number
): Promise<Blob> {
  const photoZones = template.objects.filter((o) => o.type === "photo-zone");
  if (photoZones.length === 0) {
    return renderOverlayPass(template, texts, width, height);
  }

  // Diff approach: render twice with different solid-color photos and treat
  // pixels that differ as the visible photo-zone area (transparent in output).
  const numZones = Math.max(...photoZones.map((p) => (p as { photoIndex?: number }).photoIndex ?? 0)) + 1;
  const magenta = makeSolidDataUrl(255, 0, 255);
  const green = makeSolidDataUrl(0, 255, 0);
  const magentaPhotos = Array(numZones).fill(magenta);
  const greenPhotos = Array(numZones).fill(green);

  const [canvasA, canvasB] = await Promise.all([
    renderToOffscreen(template, texts, width, height, magentaPhotos),
    renderToOffscreen(template, texts, width, height, greenPhotos),
  ]);

  const ctxA = canvasA.getContext("2d")!;
  const ctxB = canvasB.getContext("2d")!;
  const dataA = ctxA.getImageData(0, 0, width, height);
  const dataB = ctxB.getImageData(0, 0, width, height);
  const a = dataA.data;
  const b = dataB.data;
  for (let i = 0; i < a.length; i += 4) {
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) {
      a[i + 3] = 0;
    }
  }
  ctxA.putImageData(dataA, 0, 0);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvasA.toBlob((bl) => (bl ? resolve(bl) : reject(new Error("overlay encode failed"))), "image/png");
  });
  if (canvasA.parentNode) canvasA.parentNode.removeChild(canvasA);
  if (canvasB.parentNode) canvasB.parentNode.removeChild(canvasB);
  return blob;
}

async function renderOverlayPass(
  template: FrameTemplate,
  texts: { heading?: string; subheading?: string },
  width: number,
  height: number
): Promise<Blob> {
  const c = await renderToOffscreen(template, texts, width, height, []);
  const blob = await new Promise<Blob>((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("overlay encode failed"))), "image/png");
  });
  if (c.parentNode) c.parentNode.removeChild(c);
  return blob;
}

function makeSolidDataUrl(r: number, g: number, b: number): string {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 4;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, 4, 4);
  return c.toDataURL("image/png");
}

async function renderToOffscreen(
  template: FrameTemplate,
  texts: { heading?: string; subheading?: string },
  width: number,
  height: number,
  photos: string[]
): Promise<HTMLCanvasElement> {
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
  offscreen.style.position = "fixed";
  offscreen.style.left = "-99999px";
  document.body.appendChild(offscreen);
  const fc: fabric.Canvas = await renderFrameTemplate(offscreen, template, {
    scale: 1,
    photos,
    texts,
    editorMode: false,
  });
  fc.dispose();
  return offscreen;
}

/**
 * Extract a still poster frame from a video URL as a PNG data URL.
 */
export async function extractVideoPoster(videoUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = videoUrl;
    const cleanup = () => {
      v.removeAttribute("src");
      v.load();
    };
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(0.1, (v.duration || 1) / 2);
    };
    v.onseeked = () => {
      try {
        const c = document.createElement("canvas");
        c.width = v.videoWidth;
        c.height = v.videoHeight;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(v, 0, 0);
        const url = c.toDataURL("image/png");
        cleanup();
        resolve(url);
      } catch (e) {
        cleanup();
        reject(e);
      }
    };
    v.onerror = () => {
      cleanup();
      reject(new Error("Failed to load video for poster extraction"));
    };
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/");
}

export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(url);
}

// FrameObject is exported only to allow type usage in renderer; suppress unused
export type _FrameObjectMarker = FrameObject;
