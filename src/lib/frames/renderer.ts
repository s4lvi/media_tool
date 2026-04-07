import * as fabric from "fabric";
import type {
  FrameTemplate,
  FrameObject,
  PhotoZone,
  TextZone,
  AssetObject,
  ShapeObject,
  GradientObject,
} from "@/types/frame-template";
import { expandGradientStops } from "./gradient-curve";
import { resolveAssetPath } from "./asset-resolver";

export interface RenderOptions {
  scale?: number;
  photos?: string[]; // user uploads (optional in editor mode)
  texts?: { heading?: string; subheading?: string };
  editorMode?: boolean; // editor: show placeholders even without photos
}

export async function renderFrameTemplate(
  canvasEl: HTMLCanvasElement,
  template: FrameTemplate,
  opts: RenderOptions = {}
): Promise<fabric.Canvas> {
  const scale = opts.scale ?? 1;
  const canvas = new fabric.Canvas(canvasEl, {
    width: template.width * scale,
    height: template.height * scale,
    backgroundColor: "#ffffff",
    selection: false,
    interactive: false,
  });

  // Sort by zIndex (default 0)
  const sorted = [...template.objects].sort(
    (a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)
  );

  for (const obj of sorted) {
    try {
      await renderObject(canvas, obj, opts, scale);
    } catch (e) {
      console.warn("Failed to render frame object:", obj.type, e);
    }
  }

  canvas.renderAll();
  return canvas;
}

async function renderObject(
  canvas: fabric.Canvas,
  obj: FrameObject,
  opts: RenderOptions,
  scale: number
): Promise<void> {
  const x = obj.x * scale;
  const y = obj.y * scale;
  const w = obj.width * scale;
  const h = obj.height * scale;

  switch (obj.type) {
    case "photo-zone":
      await renderPhotoZone(canvas, obj, opts, x, y, w, h, scale);
      break;
    case "text-zone":
      renderTextZone(canvas, obj, opts, x, y, w, h, scale);
      break;
    case "asset":
      await renderAsset(canvas, obj, x, y, w, h, scale);
      break;
    case "shape":
      renderShape(canvas, obj, x, y, w, h);
      break;
    case "gradient":
      renderGradient(canvas, obj, x, y, w, h);
      break;
  }
}

async function renderPhotoZone(
  canvas: fabric.Canvas,
  obj: PhotoZone,
  opts: RenderOptions,
  x: number, y: number, w: number, h: number,
  scale: number
) {
  const photoUrl = opts.photos?.[obj.photoIndex ?? 0];

  if (!photoUrl) {
    if (opts.editorMode) {
      // Show placeholder rectangle
      const rect = new fabric.Rect({
        left: x, top: y, width: w, height: h,
        fill: "rgba(100,150,200,0.2)",
        stroke: "rgba(100,150,200,0.6)",
        strokeDashArray: [10 * scale, 5 * scale],
        strokeWidth: 2 * scale,
        opacity: obj.opacity ?? 1,
        angle: obj.rotation ?? 0,
        originX: "left", originY: "top",
        selectable: false, evented: false,
      });
      canvas.add(rect);

      const label = new fabric.Textbox(`Photo ${(obj.photoIndex ?? 0) + 1}`, {
        left: x + w / 2,
        top: y + h / 2,
        width: w * 0.7,
        fontSize: Math.max(14 * scale, 14),
        fontFamily: "Arial",
        fill: "rgba(100,150,200,0.9)",
        textAlign: "center",
        originX: "center", originY: "center",
        selectable: false, evented: false,
      });
      canvas.add(label);
    }
    return;
  }

  let img = await loadImage(photoUrl);

  // Pre-scale large images before filtering to avoid browser canvas size limits
  // (filters on huge images can produce a clamped canvas leaving black space)
  const rawW = img.naturalWidth;
  const rawH = img.naturalHeight;
  const maxDim = 4096;
  if (obj.filters && (rawW > maxDim || rawH > maxDim)) {
    const downscale = maxDim / Math.max(rawW, rawH);
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = Math.round(rawW * downscale);
    tmpCanvas.height = Math.round(rawH * downscale);
    tmpCanvas.getContext("2d")!.drawImage(img, 0, 0, tmpCanvas.width, tmpCanvas.height);
    img = await loadImage(tmpCanvas.toDataURL("image/jpeg", 0.92));
  }

  const fabricImg = new fabric.FabricImage(img, {
    selectable: false, evented: false,
    opacity: obj.opacity ?? 1,
  });

  // Use natural HTML image dimensions, not fabric's internal width/height
  // (which can be modified after applyFilters)
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  if (obj.blendMode) {
    fabricImg.set("globalCompositeOperation", obj.blendMode);
  }

  // Apply filters
  if (obj.filters) {
    const f: InstanceType<typeof fabric.filters.Grayscale>[] = [];
    if (obj.filters.grayscale) f.push(new fabric.filters.Grayscale());
    if (obj.filters.brightness !== undefined) {
      f.push(new fabric.filters.Brightness({ brightness: obj.filters.brightness }) as never);
    }
    if (obj.filters.contrast !== undefined) {
      f.push(new fabric.filters.Contrast({ contrast: obj.filters.contrast }) as never);
    }
    if (f.length > 0) {
      fabricImg.filters = f;
      fabricImg.applyFilters();
    }
  }

  const sx = w / origW;
  const sy = h / origH;
  const s = obj.scaleMode === "contain" ? Math.min(sx, sy) : Math.max(sx, sy);
  fabricImg.scale(s);

  const sw = origW * s;
  const sh = origH * s;
  fabricImg.set({
    left: x + (w - sw) / 2,
    top: y + (h - sh) / 2,
    angle: obj.rotation ?? 0,
  });

  if (obj.scaleMode === "cover") {
    fabricImg.set({
      clipPath: new fabric.Rect({
        left: x, top: y, width: w, height: h,
        absolutePositioned: true,
      }),
    });
  }

  canvas.add(fabricImg);
}

function renderTextZone(
  canvas: fabric.Canvas,
  obj: TextZone,
  opts: RenderOptions,
  x: number, y: number, w: number, h: number,
  scale: number
) {
  let text = obj.defaultText || "";
  if (opts.texts) {
    if (obj.placeholder === "heading") text = opts.texts.heading || text;
    if (obj.placeholder === "subheading") text = opts.texts.subheading || text;
  }
  if (!text && opts.editorMode) {
    text = obj.placeholder === "heading" ? "[Heading]" : obj.placeholder === "subheading" ? "[Subheading]" : "[Text]";
  }
  if (obj.uppercase) text = text.toUpperCase();

  const fontSize = obj.fontSize * scale;

  // Auto-shrink for long text
  let finalSize = fontSize;
  if (text.length > 30) finalSize *= 0.8;
  if (text.length > 50) finalSize *= 0.75;

  const textbox = new fabric.Textbox(text, {
    left: x + w / 2,
    top: y + h / 2,
    width: w,
    fontSize: finalSize,
    fontFamily: obj.fontFamily,
    fontWeight: obj.fontWeight,
    fill: obj.color,
    textAlign: obj.textAlign,
    originX: "center", originY: "center",
    angle: obj.rotation ?? 0,
    opacity: obj.opacity ?? 1,
    selectable: false, evented: false,
  });

  if (obj.shadow) {
    textbox.set({
      shadow: new fabric.Shadow({
        color: "rgba(0,0,0,0.85)",
        blur: fontSize * 0.18,
        offsetX: 0,
        offsetY: fontSize * 0.04,
      }),
      stroke: "rgba(0,0,0,0.3)",
      strokeWidth: Math.max(1, fontSize * 0.02),
    });
  }

  canvas.add(textbox);
}

async function renderAsset(
  canvas: fabric.Canvas,
  obj: AssetObject,
  x: number, y: number, w: number, h: number,
  scale: number
) {
  const resolvedPath = await resolveAssetPath(obj.assetPath);
  const img = await loadImage(resolvedPath);
  const fabricImg = new fabric.FabricImage(img, {
    selectable: false, evented: false,
    opacity: obj.opacity ?? 1,
  });

  const origW = img.naturalWidth;
  const origH = img.naturalHeight;

  if (obj.blendMode) {
    fabricImg.set("globalCompositeOperation", obj.blendMode);
  }

  const sx = w / origW;
  const sy = h / origH;
  const s = obj.scaleMode === "contain" ? Math.min(sx, sy) : Math.max(sx, sy);
  fabricImg.scale(s);

  const sw = origW * s;
  const sh = origH * s;
  fabricImg.set({
    left: x + (w - sw) / 2,
    top: y + (h - sh) / 2,
    angle: obj.rotation ?? 0,
  });

  // Backing rect
  if (obj.backing) {
    const isDark = obj.backing === "dark";
    const pad = Math.max(4, w * 0.06);
    const backing = new fabric.Rect({
      left: (x + (w - sw) / 2) - pad,
      top: (y + (h - sh) / 2) - pad,
      width: sw + pad * 2,
      height: sh + pad * 2,
      fill: isDark ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)",
      rx: pad * 0.4, ry: pad * 0.4,
      angle: obj.rotation ?? 0,
      selectable: false, evented: false,
    });
    canvas.add(backing);
  }

  canvas.add(fabricImg);
}

function renderShape(
  canvas: fabric.Canvas,
  obj: ShapeObject,
  x: number, y: number, w: number, h: number
) {
  const shape = obj.shape === "circle"
    ? new fabric.Circle({
        left: x, top: y,
        radius: w / 2,
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth ?? 0,
        opacity: obj.opacity ?? 1,
        angle: obj.rotation ?? 0,
        originX: "left", originY: "top",
        selectable: false, evented: false,
      })
    : new fabric.Rect({
        left: x, top: y, width: w, height: h,
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth ?? 0,
        rx: obj.borderRadius ?? 0,
        ry: obj.borderRadius ?? 0,
        opacity: obj.opacity ?? 1,
        angle: obj.rotation ?? 0,
        originX: "left", originY: "top",
        selectable: false, evented: false,
      });

  if (obj.blendMode) {
    shape.set("globalCompositeOperation", obj.blendMode);
  }
  canvas.add(shape);
}

function renderGradient(
  canvas: fabric.Canvas,
  obj: GradientObject,
  x: number, y: number, w: number, h: number
) {
  // Compute gradient endpoints from angle
  const angleRad = ((obj.angle - 90) * Math.PI) / 180;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.max(w, h);
  const dx = Math.cos(angleRad) * r;
  const dy = Math.sin(angleRad) * r;

  const expandedStops = expandGradientStops(obj.stops[0], obj.stops[obj.stops.length - 1], obj.curve || "linear");
  const gradient = obj.gradientType === "linear"
    ? new fabric.Gradient({
        type: "linear" as const,
        coords: { x1: cx - dx / 2, y1: cy - dy / 2, x2: cx + dx / 2, y2: cy + dy / 2 },
        colorStops: expandedStops.map((s) => ({ offset: s.offset, color: s.color })),
      })
    : new fabric.Gradient({
        type: "radial" as const,
        coords: { x1: cx, y1: cy, r1: 0, x2: cx, y2: cy, r2: Math.max(w, h) / 2 },
        colorStops: expandedStops.map((s) => ({ offset: s.offset, color: s.color })),
      });

  const rect = new fabric.Rect({
    left: x, top: y, width: w, height: h,
    fill: gradient,
    opacity: obj.opacity ?? 1,
    angle: obj.rotation ?? 0,
    originX: "left", originY: "top",
    selectable: false, evented: false,
  });

  if (obj.blendMode) {
    rect.set("globalCompositeOperation", obj.blendMode);
  }
  canvas.add(rect);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load: ${src}`));
    img.src = src;
  });
}

export function frameToDataUrl(
  canvas: fabric.Canvas,
  format: "png" | "jpeg" = "jpeg",
  quality: number = 0.9
): string {
  return canvas.toDataURL({ format, quality, multiplier: 1 });
}
