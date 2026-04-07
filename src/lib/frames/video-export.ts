import * as fabric from "fabric";
import type { FrameTemplate } from "@/types/frame-template";
import { renderFrameTemplate } from "./renderer";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";

/**
 * Export a video by playing the user's video into a canvas, compositing
 * the frame template overlay, and capturing.
 *
 * Returns a video blob (WebM via MediaRecorder, or MP4 via WebCodecs+mp4-muxer).
 */
export async function exportVideoWithFrame(
  template: FrameTemplate,
  videoUrl: string,
  texts: { heading?: string; subheading?: string },
  format: "webm" | "mp4" = "webm",
  onProgress?: (pct: number) => void
): Promise<Blob> {
  // 1. Set up the source video element. It MUST be in the DOM and ready.
  const video = document.createElement("video");
  video.src = videoUrl;
  video.crossOrigin = "anonymous";
  video.muted = true; // muted is required for autoplay-without-gesture rules
  video.playsInline = true;
  video.preload = "auto";
  video.style.position = "fixed";
  video.style.left = "-99999px";
  video.style.top = "0";
  video.style.width = "1px";
  video.style.height = "1px";
  document.body.appendChild(video);

  try {
    // Wait for enough data to play through
    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        video.removeEventListener("canplaythrough", onReady);
        video.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        video.removeEventListener("canplaythrough", onReady);
        video.removeEventListener("error", onError);
        reject(new Error("Failed to load video"));
      };
      video.addEventListener("canplaythrough", onReady);
      video.addEventListener("error", onError);
      // If already loaded
      if (video.readyState >= 4) {
        video.removeEventListener("canplaythrough", onReady);
        video.removeEventListener("error", onError);
        resolve();
      }
    });

    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) {
      throw new Error("Could not determine video duration");
    }

    // 2. Pre-render the frame overlay (everything EXCEPT the photo zones)
    const overlayCanvas = document.createElement("canvas");
    overlayCanvas.style.position = "fixed";
    overlayCanvas.style.left = "-99999px";
    document.body.appendChild(overlayCanvas);
    let overlayFabric: fabric.Canvas | null = null;
    let overlayDataUrl: string;
    try {
      overlayFabric = await renderFrameTemplate(overlayCanvas, template, {
        scale: 1,
        photos: [],
        texts,
        editorMode: false,
      });
      overlayDataUrl = overlayCanvas.toDataURL("image/png");
    } finally {
      if (overlayFabric) overlayFabric.dispose();
      if (overlayCanvas.parentNode) overlayCanvas.parentNode.removeChild(overlayCanvas);
    }

    const overlayImg = new Image();
    overlayImg.src = overlayDataUrl;
    await new Promise<void>((resolve, reject) => {
      overlayImg.onload = () => resolve();
      overlayImg.onerror = () => reject(new Error("Overlay load failed"));
    });

    // 3. Find the first photo zone in the template
    const photoZone = template.objects.find((o) => o.type === "photo-zone");
    if (!photoZone) throw new Error("Template has no photo zone for the video");
    const pz = photoZone as { x: number; y: number; width: number; height: number };

    // 4. Create the export canvas at template dimensions
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = template.width;
    exportCanvas.height = template.height;
    const ctx = exportCanvas.getContext("2d", { alpha: false })!;

    function drawFrame() {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

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

      ctx.drawImage(overlayImg, 0, 0, exportCanvas.width, exportCanvas.height);
    }

    if (format === "mp4") {
      return await encodeMp4(exportCanvas, video, drawFrame, duration, onProgress);
    } else {
      return await encodeWebm(exportCanvas, video, drawFrame, duration, onProgress);
    }
  } finally {
    if (video.parentNode) video.parentNode.removeChild(video);
  }
}

/**
 * WebM via MediaRecorder + canvas captureStream.
 */
async function encodeWebm(
  exportCanvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  drawFrame: () => void,
  duration: number,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  // captureStream needs at least one paint before it'll deliver frames
  drawFrame();

  const fps = 30;
  const canvasStream = (exportCanvas as HTMLCanvasElement & {
    captureStream: (fps?: number) => MediaStream;
  }).captureStream(fps);

  // Pick a supported codec
  const mimeCandidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
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

  return new Promise<Blob>((resolve, reject) => {
    let stopped = false;

    recorder.onstop = () => {
      stopped = true;
      resolve(new Blob(chunks, { type: mimeType }));
    };
    recorder.onerror = (e) => {
      stopped = true;
      reject(e);
    };

    function loop() {
      if (stopped) return;
      drawFrame();
      if (onProgress && duration > 0) {
        onProgress(Math.min(1, video.currentTime / duration));
      }
      requestAnimationFrame(loop);
    }

    video.onended = () => {
      // Give recorder a moment to flush
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 200);
    };

    video.currentTime = 0;
    video
      .play()
      .then(() => {
        recorder.start(100); // emit chunks every 100ms
        loop();
      })
      .catch(reject);
  });
}

/**
 * MP4 via WebCodecs VideoEncoder + mp4-muxer. Modern browsers only.
 */
async function encodeMp4(
  exportCanvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  drawFrame: () => void,
  duration: number,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  if (typeof VideoEncoder === "undefined") {
    throw new Error("MP4 export requires WebCodecs API (Chrome/Edge/Safari 16.4+)");
  }

  const fps = 30;
  // H.264 encoders require even width/height — round down to nearest even
  const width = Math.floor(exportCanvas.width / 2) * 2;
  const height = Math.floor(exportCanvas.height / 2) * 2;

  // If we had to round, resize the canvas to match
  if (width !== exportCanvas.width || height !== exportCanvas.height) {
    exportCanvas.width = width;
    exportCanvas.height = height;
  }

  // Probe codec support — try multiple H.264 profiles and pick the first
  // supported one. Different browsers/hardware support different profiles.
  const codecCandidates = [
    "avc1.42001f", // Baseline 3.1
    "avc1.42E01F", // Constrained Baseline 3.1
    "avc1.42001E", // Baseline 3.0
    "avc1.4D001F", // Main 3.1
    "avc1.640028", // High 4.0
    "avc1.640033", // High 5.1
  ];

  let workingCodec: string | null = null;
  let lastError: string | null = null;
  for (const codec of codecCandidates) {
    try {
      const result = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate: 8_000_000,
        framerate: fps,
      });
      if (result.supported) {
        workingCodec = result.config?.codec || codec;
        break;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  if (!workingCodec) {
    throw new Error(
      `No supported H.264 codec found at ${width}x${height}. ` +
      `Try a different aspect ratio. ${lastError ? "Last error: " + lastError : ""}`
    );
  }

  // mp4-muxer setup
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: "avc",
      width,
      height,
      frameRate: fps,
    },
    fastStart: "in-memory",
  });

  // VideoEncoder setup
  let encoderError: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      console.error("VideoEncoder error:", e);
      encoderError = e;
    },
  });

  encoder.configure({
    codec: workingCodec,
    width,
    height,
    bitrate: 8_000_000,
    framerate: fps,
  });

  // Verify encoder reached configured state
  if (encoder.state !== "configured") {
    throw new Error(
      `VideoEncoder failed to configure (state: ${encoder.state}). Codec: ${workingCodec}, ${width}x${height}`
    );
  }

  // Play the video and encode frames
  return new Promise<Blob>((resolve, reject) => {
    let stopped = false;
    let frameIndex = 0;
    const frameDurationUs = Math.round(1_000_000 / fps);

    async function loop() {
      if (stopped) return;
      if (encoderError) {
        stopped = true;
        reject(encoderError instanceof Error ? encoderError : new Error(String(encoderError)));
        return;
      }
      if (encoder.state !== "configured") {
        stopped = true;
        reject(new Error(`VideoEncoder state is ${encoder.state}, not configured`));
        return;
      }
      try {
        drawFrame();
        const timestamp = frameIndex * frameDurationUs;
        const vf = new VideoFrame(exportCanvas, {
          timestamp,
          duration: frameDurationUs,
        });
        const keyFrame = frameIndex % (fps * 2) === 0;
        encoder.encode(vf, { keyFrame });
        vf.close();
        frameIndex++;
        if (onProgress && duration > 0) {
          onProgress(Math.min(1, video.currentTime / duration));
        }
      } catch (e) {
        stopped = true;
        reject(e);
        return;
      }
      requestAnimationFrame(loop);
    }

    video.onended = async () => {
      stopped = true;
      try {
        await encoder.flush();
        encoder.close();
        muxer.finalize();
        const target = muxer.target as ArrayBufferTarget;
        const blob = new Blob([target.buffer], { type: "video/mp4" });
        resolve(blob);
      } catch (e) {
        reject(e);
      }
    };

    video.currentTime = 0;
    video
      .play()
      .then(() => {
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
  return /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(url);
}
