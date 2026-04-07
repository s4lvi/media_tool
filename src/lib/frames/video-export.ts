import * as fabric from "fabric";
import type { FrameTemplate } from "@/types/frame-template";
import { renderFrameTemplate } from "./renderer";

/**
 * Export a video by playing the user's video into a canvas, compositing
 * the frame template overlay, and capturing via MediaRecorder.
 *
 * Returns a WebM blob.
 */
export async function exportVideoWithFrame(
  template: FrameTemplate,
  videoUrl: string,
  texts: { heading?: string; subheading?: string },
  onProgress?: (pct: number) => void
): Promise<Blob> {
  // 1. Create the video element
  const video = document.createElement("video");
  video.src = videoUrl;
  video.crossOrigin = "anonymous";
  video.muted = false;
  video.playsInline = true;
  video.preload = "auto";
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Failed to load video"));
  });

  const duration = video.duration;
  if (!isFinite(duration) || duration <= 0) {
    throw new Error("Could not determine video duration");
  }

  // 2. Pre-render the frame overlay (everything EXCEPT the photo zones)
  // The photo zones will be filled by the video at draw time.
  const overlayCanvas = document.createElement("canvas");
  document.body.appendChild(overlayCanvas);
  overlayCanvas.style.position = "fixed";
  overlayCanvas.style.left = "-99999px";
  let overlayFabric: fabric.Canvas | null = null;
  try {
    // Render the template with NO photos. This produces a transparent canvas
    // with the frame decorations on top.
    overlayFabric = await renderFrameTemplate(overlayCanvas, template, {
      scale: 1,
      photos: [], // photo zones will be skipped (they get an editor placeholder
                  // only in editorMode, otherwise blank)
      texts,
      editorMode: false,
    });
  } catch (e) {
    if (overlayFabric) overlayFabric.dispose();
    if (overlayCanvas.parentNode) overlayCanvas.parentNode.removeChild(overlayCanvas);
    throw e;
  }

  // Convert overlay to an HTMLImageElement we can draw each frame
  const overlayDataUrl = overlayCanvas.toDataURL("image/png");
  overlayFabric.dispose();
  if (overlayCanvas.parentNode) overlayCanvas.parentNode.removeChild(overlayCanvas);

  const overlayImg = new Image();
  overlayImg.src = overlayDataUrl;
  await new Promise((r) => (overlayImg.onload = r));

  // 3. Find the first photo zone in the template — that's where the video goes
  const photoZone = template.objects.find((o) => o.type === "photo-zone");
  if (!photoZone) {
    throw new Error("Template has no photo zone for the video");
  }

  // 4. Create the export canvas at template dimensions
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = template.width;
  exportCanvas.height = template.height;
  const ctx = exportCanvas.getContext("2d", { alpha: false })!;

  // 5. Set up MediaRecorder capturing the canvas
  const fps = 30;
  // captureStream gives us a MediaStream we can mix audio into
  const canvasStream = (exportCanvas as HTMLCanvasElement & {
    captureStream: (fps: number) => MediaStream;
  }).captureStream(fps);

  // Try to get audio from the source video and add to the stream
  try {
    const videoStream = (video as HTMLVideoElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    }).captureStream?.() || (video as HTMLVideoElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    }).mozCaptureStream?.();
    if (videoStream) {
      const audioTracks = videoStream.getAudioTracks();
      audioTracks.forEach((t) => canvasStream.addTrack(t));
    }
  } catch {
    // Audio capture failed; export will be silent
  }

  // Pick a supported MIME type
  const mimeCandidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";

  const recorder = new MediaRecorder(canvasStream, {
    mimeType,
    videoBitsPerSecond: 8_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  // 6. Compute photo zone draw geometry once (cover-fit)
  const pz = photoZone as { x: number; y: number; width: number; height: number };
  function drawFrame() {
    // Clear
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Cover-fit the video into the photo zone
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw && vh) {
      const sx = pz.width / vw;
      const sy = pz.height / vh;
      const s = Math.max(sx, sy) * 1.005;
      const dw = vw * s;
      const dh = vh * s;
      const dx = pz.x + (pz.width - dw) / 2;
      const dy = pz.y + (pz.height - dh) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(pz.x, pz.y, pz.width, pz.height);
      ctx.clip();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(video, dx, dy, dw, dh);
      ctx.restore();
    }

    // Draw the static frame overlay on top
    ctx.drawImage(overlayImg, 0, 0, exportCanvas.width, exportCanvas.height);
  }

  // 7. Animation loop tied to requestAnimationFrame, runs while video plays
  let stopped = false;
  function loop() {
    if (stopped) return;
    drawFrame();
    if (onProgress && duration > 0) {
      onProgress(Math.min(1, video.currentTime / duration));
    }
    requestAnimationFrame(loop);
  }

  return new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => {
      stopped = true;
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };
    recorder.onerror = (e) => reject(e);

    video.onended = () => {
      // Give the recorder a moment to flush the last frame
      setTimeout(() => recorder.stop(), 100);
    };

    video.currentTime = 0;
    video
      .play()
      .then(() => {
        recorder.start();
        loop();
      })
      .catch(reject);
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
  // best-effort check
  return /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(url);
}
