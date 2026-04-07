import * as fabric from "fabric";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { FrameTemplate } from "@/types/frame-template";
import { renderFrameTemplate } from "./renderer";

/**
 * Export a video by:
 *  1. Pre-rendering the frame template overlay (no photos) as a transparent PNG via fabric
 *  2. Loading ffmpeg.wasm
 *  3. Running a single filter graph that scales+crops the source video to the photo
 *     zone, places it on a black canvas of the template size, and overlays the PNG
 *  4. Returning the resulting blob
 */

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpegLoading = (async () => {
    const ffmpeg = new FFmpeg();
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return ffmpegLoading;
}

export async function exportVideoWithFrame(
  template: FrameTemplate,
  videoUrl: string,
  texts: { heading?: string; subheading?: string },
  format: "webm" | "mp4" = "mp4",
  onProgress?: (pct: number) => void
): Promise<Blob> {
  // Round to even — yuv420p requires it
  const tw = Math.floor(template.width / 2) * 2;
  const th = Math.floor(template.height / 2) * 2;

  const photoZone = template.objects.find((o) => o.type === "photo-zone");
  if (!photoZone) throw new Error("Template has no photo zone for the video");
  const pzw = Math.max(2, Math.floor(photoZone.width / 2) * 2);
  const pzh = Math.max(2, Math.floor(photoZone.height / 2) * 2);
  const pzx = Math.floor(photoZone.x);
  const pzy = Math.floor(photoZone.y);

  onProgress?.(0.05);

  // 1. Pre-render the overlay
  const overlayBlob = await renderOverlayBlob(template, texts, tw, th);
  onProgress?.(0.15);

  // 2. Fetch source video
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) throw new Error("Failed to fetch source video");
  const videoBlob = await videoRes.blob();
  onProgress?.(0.25);

  // 3. Load ffmpeg.wasm
  const ffmpeg = await getFFmpeg();
  onProgress?.(0.4);

  ffmpeg.on("log", ({ message }) => {
    console.log("[ffmpeg]", message);
  });
  ffmpeg.on("progress", ({ progress }) => {
    if (progress > 0 && progress <= 1) {
      onProgress?.(0.4 + progress * 0.55);
    }
  });

  // 4. Write inputs
  const inputName = "input." + (videoBlob.type.includes("quicktime") ? "mov" : "mp4");
  await ffmpeg.writeFile(inputName, await fetchFile(videoBlob));
  await ffmpeg.writeFile("overlay.png", await fetchFile(overlayBlob));

  // 5. Build filter graph: black canvas → scaled video at photo zone → PNG overlay on top
  const filter =
    `color=c=black:s=${tw}x${th}:r=30[bg];` +
    `[0:v]scale=${pzw}:${pzh}:force_original_aspect_ratio=increase,crop=${pzw}:${pzh},setsar=1[vid];` +
    `[bg][vid]overlay=${pzx}:${pzy}:shortest=1[withvid];` +
    `[withvid][1:v]overlay=0:0:format=auto[out]`;

  const outputName = format === "mp4" ? "output.mp4" : "output.webm";
  const codecArgs = format === "mp4"
    ? ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]
    : ["-c:v", "libvpx", "-b:v", "2M", "-pix_fmt", "yuv420p"];

  await ffmpeg.exec([
    "-i", inputName,
    "-i", "overlay.png",
    "-filter_complex", filter,
    "-map", "[out]",
    "-map", "0:a?",
    "-c:a", "aac",
    "-shortest",
    ...codecArgs,
    outputName,
  ]);

  const data = (await ffmpeg.readFile(outputName)) as Uint8Array;

  // Cleanup
  try { await ffmpeg.deleteFile(inputName); } catch {}
  try { await ffmpeg.deleteFile("overlay.png"); } catch {}
  try { await ffmpeg.deleteFile(outputName); } catch {}

  onProgress?.(1);
  return new Blob([data.buffer as ArrayBuffer], {
    type: format === "mp4" ? "video/mp4" : "video/webm",
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
    return renderOverlayPass(template, texts, width, height, () => true);
  }
  // Use the lowest photo zone zIndex as the split point
  const splitZ = Math.min(...photoZones.map((o) => o.zIndex ?? 0));
  const holes = photoZones.map((o) => ({
    x: o.x, y: o.y, width: o.width, height: o.height,
  }));

  // Background: objects below the split point, with holes punched at photo zones
  const bgBlob = await renderOverlayPass(
    template,
    texts,
    width,
    height,
    (obj) => obj.type !== "photo-zone" && (obj.zIndex ?? 0) < splitZ,
    holes
  );
  // Foreground: objects at or above the split point (but not the photo zones)
  const fgBlob = await renderOverlayPass(
    template,
    texts,
    width,
    height,
    (obj) => obj.type !== "photo-zone" && (obj.zIndex ?? 0) >= splitZ
  );
  // Composite fg over bg
  return composeBlobs(bgBlob, fgBlob, width, height);
}

async function composeBlobs(bg: Blob, fg: Blob, w: number, h: number): Promise<Blob> {
  const [bgBmp, fgBmp] = await Promise.all([createImageBitmap(bg), createImageBitmap(fg)]);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bgBmp, 0, 0, w, h);
  ctx.drawImage(fgBmp, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("compose failed"))), "image/png");
  });
}

async function renderOverlayPass(
  template: FrameTemplate,
  texts: { heading?: string; subheading?: string },
  width: number,
  height: number,
  filter: (obj: import("@/types/frame-template").FrameObject) => boolean,
  punchHoles: Array<{ x: number; y: number; width: number; height: number }> = []
): Promise<Blob> {
  const offscreen = document.createElement("canvas");
  offscreen.width = width;
  offscreen.height = height;
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
      backgroundColor: "transparent",
      objectFilter: filter,
    });
    if (punchHoles.length > 0) {
      const ctx = offscreen.getContext("2d");
      if (ctx) {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        for (const h of punchHoles) {
          ctx.fillStyle = "rgba(0,0,0,1)";
          ctx.fillRect(h.x, h.y, h.width, h.height);
        }
        ctx.restore();
      }
    }
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
