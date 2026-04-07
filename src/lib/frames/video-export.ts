import * as fabric from "fabric";
import type { FrameTemplate } from "@/types/frame-template";
import { renderFrameTemplate } from "./renderer";

/**
 * Export a video by:
 *   1. Pre-rendering the frame template overlay as a transparent PNG (main thread, needs fabric)
 *   2. Spawning a web worker that demuxes the source video, decodes frames,
 *      composites video + overlay on an OffscreenCanvas, re-encodes, and muxes
 *   3. Receiving the result blob from the worker
 *
 * Inputs accepted: MP4 / MOV (mp4box.js demuxer). WebM input not supported.
 * Outputs: MP4 (H.264) or WebM (VP9). Both via WebCodecs in the worker.
 */
export async function exportVideoWithFrame(
  template: FrameTemplate,
  videoUrl: string,
  texts: { heading?: string; subheading?: string },
  format: "webm" | "mp4" = "mp4",
  onProgress?: (pct: number) => void
): Promise<Blob> {
  // 1. Pre-render the frame overlay (no photos) as a transparent PNG.
  // We need fabric for this, which only works on the main thread.
  const overlayBlob = await renderOverlayBlob(template, texts);

  // 2. Find the photo zone for cover-fit positioning
  const photoZone = template.objects.find((o) => o.type === "photo-zone");
  if (!photoZone) throw new Error("Template has no photo zone for the video");
  const pz = {
    x: photoZone.x,
    y: photoZone.y,
    width: photoZone.width,
    height: photoZone.height,
  };

  // 3. Fetch the source video as a Blob (handles both blob: URLs and signed URLs)
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error("Failed to fetch source video");
  const videoBlob = await videoRes.blob();

  // 4. Spawn the worker
  const worker = new Worker(new URL("../../workers/video-export.worker.ts", import.meta.url), {
    type: "module",
  });

  return new Promise<Blob>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === "progress" && onProgress) onProgress(msg.pct);
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
      fps: 30,
    });
  });
}

/**
 * Pre-render the frame template's static overlay (no photos) as a PNG Blob.
 */
async function renderOverlayBlob(
  template: FrameTemplate,
  texts: { heading?: string; subheading?: string }
): Promise<Blob> {
  const offscreen = document.createElement("canvas");
  offscreen.style.position = "fixed";
  offscreen.style.left = "-99999px";
  document.body.appendChild(offscreen);
  let fc: fabric.Canvas | null = null;
  try {
    fc = await renderFrameTemplate(offscreen, template, {
      scale: 1,
      photos: [],
      texts,
      editorMode: false,
    });
    return await new Promise<Blob>((resolve, reject) => {
      offscreen.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("Failed to encode overlay PNG"));
      }, "image/png");
    });
  } finally {
    if (fc) fc.dispose();
    if (offscreen.parentNode) offscreen.parentNode.removeChild(offscreen);
  }
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
