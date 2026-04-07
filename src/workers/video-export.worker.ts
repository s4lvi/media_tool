/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */

// Web worker that takes a source video Blob and a static overlay Blob,
// demuxes the video with mp4box.js, decodes each frame with WebCodecs,
// composites the video into the photo zone with the overlay on top via
// OffscreenCanvas, re-encodes with WebCodecs, and muxes the result into
// MP4 (mp4-muxer) or WebM (webm-muxer).

import * as MP4Box from "mp4box";

type MP4File = any;
type MP4Info = any;
type MP4Sample = any;
type MP4VideoTrack = any;
type MP4ArrayBuffer = ArrayBuffer & { fileStart: number };
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
  fps: number;
}

type WorkerOut =
  | { type: "progress"; pct: number }
  | { type: "done"; blob: Blob }
  | { type: "error"; message: string };

function postOut(msg: WorkerOut, transfer?: Transferable[]) {
  if (transfer && transfer.length > 0) self.postMessage(msg, transfer);
  else self.postMessage(msg);
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
  // Round template dimensions to even (encoders require it)
  const width = Math.floor(req.templateWidth / 2) * 2;
  const height = Math.floor(req.templateHeight / 2) * 2;

  // Decode the static overlay PNG once
  const overlayBitmap = await createImageBitmap(req.overlayBlob);

  // Set up the OffscreenCanvas for compositing
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;

  // 1. Demux the video with mp4box.js
  const { videoTrack, samples, description } = await demuxVideo(req.videoBlob);
  if (samples.length === 0) throw new Error("Video has no samples");

  const codec = videoTrack.codec;
  const codedWidth = videoTrack.video.width;
  const codedHeight = videoTrack.video.height;
  const totalSamples = samples.length;
  // mp4box timescale is per-track
  const timescale = videoTrack.timescale;
  // Source duration in seconds
  const sourceDurationSec = videoTrack.duration / timescale;

  // 2. Set up VideoEncoder for output
  const fps = req.fps || 30;
  const encoderConfig = await pickEncoderConfig(req.outputFormat, width, height, fps);
  if (!encoderConfig) {
    throw new Error(`No supported ${req.outputFormat.toUpperCase()} encoder for ${width}x${height}`);
  }

  // Set up muxer
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

  // 3. Set up VideoDecoder
  let decoderError: unknown = null;
  const decodedFrames: VideoFrame[] = [];
  let decodingDone = false;

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

  // 4. Feed samples into the decoder
  for (const sample of samples) {
    const chunk = new EncodedVideoChunk({
      type: sample.is_sync ? "key" : "delta",
      timestamp: (sample.cts * 1_000_000) / sample.timescale,
      duration: (sample.duration * 1_000_000) / sample.timescale,
      data: sample.data,
    });
    decoder.decode(chunk);
  }
  // Flush will finish decoding any pending samples
  await decoder.flush();
  decoder.close();
  decodingDone = true;

  if (decoderError) throw decoderError;

  // 5. For each decoded frame, composite + encode
  const photoZone = req.photoZone;
  let lastTimestampUs = -1;

  for (let i = 0; i < decodedFrames.length; i++) {
    if (encoderError) {
      throw encoderError instanceof Error ? encoderError : new Error(String(encoderError));
    }

    const frame = decodedFrames[i];
    // Clear and draw video frame into photo zone (cover-fit)
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, width, height);

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

    // Draw overlay on top
    ctx.drawImage(overlayBitmap, 0, 0, width, height);

    // Encode the composited frame
    let timestampUs = Math.round(frame.timestamp);
    if (timestampUs <= lastTimestampUs) {
      timestampUs = lastTimestampUs + 1000;
    }
    lastTimestampUs = timestampUs;

    // Back-pressure: wait for encoder queue to drain
    while (encoder.encodeQueueSize > 4) {
      await new Promise((r) => setTimeout(r, 10));
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
// Encoder config picker — try multiple codec strings
// ============================================================
async function pickEncoderConfig(
  format: "mp4" | "webm",
  width: number,
  height: number,
  fps: number
): Promise<VideoEncoderConfig | null> {
  const candidates: string[] = format === "mp4"
    ? [
        "avc1.42001f", // H.264 Baseline 3.1
        "avc1.42E01F", // Constrained Baseline 3.1
        "avc1.4D001F", // Main 3.1
        "avc1.640028", // High 4.0
      ]
    : [
        "vp09.00.10.08", // VP9 profile 0
        "vp09.00.41.08", // VP9 profile 0 level 4.1
        "vp8",
      ];

  for (const codec of candidates) {
    try {
      const result = await VideoEncoder.isConfigSupported({
        codec,
        width,
        height,
        bitrate: 8_000_000,
        framerate: fps,
      });
      if (result.supported && result.config) {
        return result.config;
      }
    } catch {
      // try next
    }
  }
  return null;
}

// ============================================================
// mp4box demuxer wrapper — returns all video samples + decoder description
// ============================================================
async function demuxVideo(blob: Blob): Promise<{
  videoTrack: MP4VideoTrack;
  samples: MP4Sample[];
  description: Uint8Array;
}> {
  return new Promise(async (resolve, reject) => {
    try {
      const file: MP4File = MP4Box.createFile();
      const collected: MP4Sample[] = [];
      let track: MP4VideoTrack | null = null;
      let description: Uint8Array | null = null;
      let extracted = false;

      file.onError = (e: string) => reject(new Error("mp4box: " + e));

      file.onReady = (info: MP4Info) => {
        const videoTracks = info.tracks.filter((t: any) => t.type === "video") as MP4VideoTrack[];
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
        // Extract all samples in big batches
        file.setExtractionOptions(track.id, null, { nbSamples: 1000 });
        file.start();
      };

      file.onSamples = (id: number, _user: unknown, samples: any[]) => {
        if (track && id === track.id) {
          collected.push(...samples);
          if (collected.length >= (track.nb_samples ?? 0) && !extracted) {
            extracted = true;
            file.flush();
            if (track && description) {
              resolve({ videoTrack: track, samples: collected, description });
            }
          }
        }
      };

      // Read blob in chunks and feed to mp4box
      const CHUNK = 1024 * 1024 * 4; // 4 MB
      let offset = 0;
      const total = blob.size;
      while (offset < total) {
        const slice = blob.slice(offset, offset + CHUNK);
        const buf = (await slice.arrayBuffer()) as MP4ArrayBuffer;
        buf.fileStart = offset;
        file.appendBuffer(buf);
        offset += CHUNK;
      }
      file.flush();

      // If we never received "extracted" by now, resolve with what we have
      // (some files report nb_samples differently)
      setTimeout(() => {
        if (!extracted && track && description) {
          extracted = true;
          resolve({ videoTrack: track, samples: collected, description });
        }
      }, 100);
    } catch (e) {
      reject(e);
    }
  });
}

// Extract the avcC / hvcC / vpcC box bytes for the VideoDecoder description
function getCodecDescription(file: MP4File, trackId: number): Uint8Array | null {
  const trakBox = (file as unknown as { moov: any }).moov.traks.find(
    (t: any) => t.tkhd.track_id === trackId
  );
  if (!trakBox) return null;
  const stsd = trakBox.mdia.minf.stbl.stsd;
  for (const entry of stsd.entries) {
    const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
    if (box) {
      const stream = new (MP4Box as unknown as { DataStream: new (b: undefined, o: number, e: number) => { buffer: ArrayBuffer; getPosition: () => number } }).DataStream(
        undefined,
        0,
        // BIG_ENDIAN
        1
      );
      box.write(stream);
      // The first 8 bytes are the box header (size + type), skip them
      return new Uint8Array(stream.buffer, 8);
    }
  }
  return null;
}
