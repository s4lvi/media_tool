/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */

// Web worker that demuxes the source video with mp4box.js, decodes with
// hardware-accelerated VideoDecoder, composites video frames into the photo
// zone with the overlay PNG via OffscreenCanvas, encodes with VideoEncoder,
// and muxes the result into MP4 (mp4-muxer) or WebM (webm-muxer).

import * as MP4Box from "mp4box";
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4ArrayBufferTarget } from "mp4-muxer";
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmArrayBufferTarget } from "webm-muxer";

declare const self: DedicatedWorkerGlobalScope;

interface ExportRequest {
  type: "export";
  videoBlob: Blob;
  overlayBlob: Blob;
  photoZone: { x: number; y: number; width: number; height: number };
  templateWidth: number;
  templateHeight: number;
  outputFormat: "mp4" | "webm";
}

type WorkerOut =
  | { type: "progress"; pct: number }
  | { type: "done"; blob: Blob }
  | { type: "error"; message: string };

function postOut(msg: WorkerOut) {
  self.postMessage(msg);
}

self.onmessage = async (e: MessageEvent<ExportRequest>) => {
  const req = e.data;
  if (req?.type !== "export") return;
  try {
    const blob = await runExport(req);
    postOut({ type: "done", blob });
  } catch (err) {
    postOut({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};

async function runExport(req: ExportRequest): Promise<Blob> {
  const width = Math.floor(req.templateWidth / 2) * 2;
  const height = Math.floor(req.templateHeight / 2) * 2;

  const overlayBitmap = await createImageBitmap(req.overlayBlob);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;

  // 1. Demux
  const { videoTrack, samples, description } = await demuxVideo(req.videoBlob);
  if (samples.length === 0) throw new Error("Video has no samples");

  const codec = videoTrack.codec;
  const codedWidth = videoTrack.video.width;
  const codedHeight = videoTrack.video.height;
  const totalSamples = samples.length;
  const sourceFps =
    videoTrack.nb_samples > 0 && videoTrack.duration > 0
      ? (videoTrack.nb_samples * videoTrack.timescale) / videoTrack.duration
      : 30;
  const fps = Math.round(sourceFps);

  // 2. Set up encoder
  const encoderConfig = await pickEncoderConfig(req.outputFormat, width, height, fps);
  if (!encoderConfig) {
    throw new Error(`No supported ${req.outputFormat.toUpperCase()} encoder for ${width}x${height}`);
  }

  let muxer: any;
  if (req.outputFormat === "mp4") {
    muxer = new Mp4Muxer({
      target: new Mp4ArrayBufferTarget(),
      video: { codec: "avc", width, height, frameRate: fps },
      fastStart: "in-memory",
    });
  } else {
    muxer = new WebmMuxer({
      target: new WebmArrayBufferTarget(),
      video: { codec: "V_VP9", width, height, frameRate: fps },
    });
  }

  let encoderError: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      encoderError = e;
    },
  });
  encoder.configure(encoderConfig);

  // 3. Set up decoder
  let decoderError: unknown = null;
  const decodedFrames: VideoFrame[] = [];

  const decoder = new VideoDecoder({
    output: (frame) => {
      decodedFrames.push(frame);
    },
    error: (e) => {
      decoderError = e;
    },
  });

  decoder.configure({
    codec,
    codedWidth,
    codedHeight,
    description,
  });

  // 4. Feed samples
  for (const sample of samples) {
    const chunk = new EncodedVideoChunk({
      type: sample.is_sync ? "key" : "delta",
      timestamp: (sample.cts * 1_000_000) / sample.timescale,
      duration: (sample.duration * 1_000_000) / sample.timescale,
      data: sample.data,
    });
    decoder.decode(chunk);
  }
  await decoder.flush();
  decoder.close();
  if (decoderError) throw decoderError;

  // Sort by presentation timestamp (decoder may output in decode order)
  decodedFrames.sort((a, b) => a.timestamp - b.timestamp);

  // 5. Composite + encode
  const photoZone = req.photoZone;
  let lastTimestampUs = -1;

  for (let i = 0; i < decodedFrames.length; i++) {
    if (encoderError) {
      throw encoderError instanceof Error ? encoderError : new Error(String(encoderError));
    }

    const frame = decodedFrames[i];
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

    // Cover-fit video frame into photo zone
    const vw = frame.displayWidth;
    const vh = frame.displayHeight;
    const sx = photoZone.width / vw;
    const sy = photoZone.height / vh;
    const s = Math.max(sx, sy) * 1.005;
    const dw = vw * s;
    const dh = vh * s;
    const dx = photoZone.x + (photoZone.width - dw) / 2;
    const dy = photoZone.y + (photoZone.height - dh) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoZone.x, photoZone.y, photoZone.width, photoZone.height);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(frame, dx, dy, dw, dh);
    ctx.restore();

    // Overlay PNG on top
    ctx.drawImage(overlayBitmap, 0, 0, width, height);

    let timestampUs = Math.round(frame.timestamp);
    if (timestampUs <= lastTimestampUs) {
      timestampUs = lastTimestampUs + 1000;
    }
    lastTimestampUs = timestampUs;

    while (encoder.encodeQueueSize > 4) {
      await new Promise((r) => setTimeout(r, 5));
      if (encoderError) throw encoderError instanceof Error ? encoderError : new Error(String(encoderError));
    }

    const compositedFrame = new VideoFrame(canvas, {
      timestamp: timestampUs,
      duration: frame.duration ?? Math.round(1_000_000 / fps),
    });
    const keyFrame = i % (fps * 2) === 0;
    encoder.encode(compositedFrame, { keyFrame });
    compositedFrame.close();
    frame.close();

    if (i % 5 === 0) {
      postOut({ type: "progress", pct: Math.min(0.95, i / totalSamples) });
    }
  }

  await encoder.flush();
  encoder.close();
  muxer.finalize();

  const buf: ArrayBuffer = (muxer.target as { buffer: ArrayBuffer }).buffer;
  const mime = req.outputFormat === "mp4" ? "video/mp4" : "video/webm";
  postOut({ type: "progress", pct: 1 });
  return new Blob([buf], { type: mime });
}

// ============================================================
// Encoder config picker
// ============================================================
async function pickEncoderConfig(
  format: "mp4" | "webm",
  width: number,
  height: number,
  fps: number
): Promise<VideoEncoderConfig | null> {
  const candidates: string[] = format === "mp4"
    ? ["avc1.42001f", "avc1.42E01F", "avc1.4D001F", "avc1.640028"]
    : ["vp09.00.10.08", "vp09.00.41.08", "vp8"];

  for (const codec of candidates) {
    try {
      const result = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate: 8_000_000,
        framerate: fps,
      });
      if (result.supported && result.config) return result.config;
    } catch {
      // try next
    }
  }
  return null;
}

// ============================================================
// mp4box demuxer
// ============================================================
async function demuxVideo(blob: Blob): Promise<{
  videoTrack: any;
  samples: any[];
  description: Uint8Array;
}> {
  return new Promise(async (resolve, reject) => {
    try {
      const file: any = (MP4Box as any).createFile();
      const collected: any[] = [];
      let track: any = null;
      let description: Uint8Array | null = null;
      let extracted = false;

      file.onError = (e: string) => reject(new Error("mp4box: " + e));

      file.onReady = (info: any) => {
        const videoTracks = info.tracks.filter((t: any) => t.type === "video");
        if (videoTracks.length === 0) {
          reject(new Error("No video track found"));
          return;
        }
        track = videoTracks[0];
        description = getCodecDescription(file, track.id);
        if (!description) {
          reject(new Error("Could not extract codec description"));
          return;
        }
        file.setExtractionOptions(track.id, null, { nbSamples: 1000 });
        file.start();
      };

      file.onSamples = (id: number, _user: unknown, samples: any[]) => {
        if (track && id === track.id) {
          collected.push(...samples);
          const expected = track.nb_samples ?? 0;
          if (
            expected > 0 &&
            collected.length >= expected &&
            !extracted &&
            description
          ) {
            extracted = true;
            file.flush();
            resolve({ videoTrack: track, samples: collected, description });
          }
        }
      };

      const CHUNK = 1024 * 1024 * 4;
      let offset = 0;
      const total = blob.size;
      while (offset < total) {
        const slice = blob.slice(offset, offset + CHUNK);
        const buf = (await slice.arrayBuffer()) as ArrayBuffer & { fileStart: number };
        buf.fileStart = offset;
        file.appendBuffer(buf);
        offset += CHUNK;
      }
      file.flush();

      // Give mp4box time to process any remaining samples, then resolve with
      // whatever was collected. Poll every 100ms for up to 5s so we don't
      // miss samples on slow/large files, but resolve as soon as we have
      // enough to proceed.
      let lastCount = -1;
      let stableCycles = 0;
      const poll = () => {
        if (extracted) return;
        if (collected.length === lastCount) {
          stableCycles++;
        } else {
          stableCycles = 0;
          lastCount = collected.length;
        }
        if (stableCycles >= 3 && collected.length > 0 && description) {
          extracted = true;
          resolve({ videoTrack: track, samples: collected, description });
          return;
        }
        if (stableCycles >= 20) {
          if (collected.length > 0 && description) {
            extracted = true;
            resolve({ videoTrack: track, samples: collected, description });
          } else {
            reject(new Error("Video has no samples (mp4box could not decode)"));
          }
          return;
        }
        setTimeout(poll, 100);
      };
      setTimeout(poll, 100);
    } catch (e) {
      reject(e);
    }
  });
}

function getCodecDescription(file: any, trackId: number): Uint8Array | null {
  const trakBox = file.moov.traks.find((t: any) => t.tkhd.track_id === trackId);
  if (!trakBox) return null;
  const stsd = trakBox.mdia.minf.stbl.stsd;
  for (const entry of stsd.entries) {
    const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
    if (box) {
      const stream = new (MP4Box as any).DataStream(undefined, 0, 1);
      box.write(stream);
      return new Uint8Array(stream.buffer, 8);
    }
  }
  return null;
}
