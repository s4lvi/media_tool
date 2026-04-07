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

/**
 * Editor-mode rendering: each frame object becomes a SELECTABLE fabric object
 * with metadata stored in `data` for round-tripping back to FrameObject JSON.
 */

export interface EditorObjectData {
  frameObject: FrameObject;
}

export async function loadFrameIntoEditor(
  canvas: fabric.Canvas,
  template: FrameTemplate
): Promise<void> {
  canvas.clear();
  canvas.backgroundColor = "#ffffff";

  for (const obj of template.objects) {
    const fabricObj = await createEditorObject(obj);
    if (fabricObj) {
      canvas.add(fabricObj);
    }
  }
  canvas.renderAll();
}

export async function createEditorObject(obj: FrameObject): Promise<fabric.Object | null> {
  switch (obj.type) {
    case "photo-zone":
      return createPhotoZoneEditorObj(obj);
    case "text-zone":
      return createTextZoneEditorObj(obj);
    case "asset":
      return await createAssetEditorObj(obj);
    case "shape":
      return createShapeEditorObj(obj);
    case "gradient":
      return createGradientEditorObj(obj);
  }
}

function createPhotoZoneEditorObj(obj: PhotoZone): fabric.Object {
  const rect = new fabric.Rect({
    left: obj.x,
    top: obj.y,
    width: obj.width,
    height: obj.height,
    fill: "rgba(100,150,200,0.25)",
    stroke: "rgba(100,150,200,0.9)",
    strokeDashArray: [10, 5],
    strokeWidth: 3,
    opacity: obj.opacity ?? 1,
    angle: obj.rotation ?? 0,
    originX: "left",
    originY: "top",
  });
  rect.set("data", { frameObject: obj });
  return rect;
}

function createTextZoneEditorObj(obj: TextZone): fabric.Object {
  const text = obj.defaultText || (obj.placeholder === "heading" ? "[Heading]" : obj.placeholder === "subheading" ? "[Subheading]" : "[Text]");
  const tb = new fabric.Textbox(text, {
    left: obj.x,
    top: obj.y,
    width: obj.width,
    fontSize: obj.fontSize,
    fontFamily: obj.fontFamily,
    fontWeight: obj.fontWeight,
    fill: obj.color,
    textAlign: obj.textAlign,
    angle: obj.rotation ?? 0,
    opacity: obj.opacity ?? 1,
    originX: "left",
    originY: "top",
  });
  tb.set("data", { frameObject: obj });
  return tb;
}

async function createAssetEditorObj(obj: AssetObject): Promise<fabric.Object | null> {
  try {
    const resolvedPath = await resolveAssetPath(obj.assetPath);
    const img = await loadImage(resolvedPath);
    const fimg = new fabric.FabricImage(img, {
      left: obj.x,
      top: obj.y,
      angle: obj.rotation ?? 0,
      opacity: obj.opacity ?? 1,
      originX: "left",
      originY: "top",
    });
    // Scale to fit obj.width/height
    const sx = obj.width / img.naturalWidth;
    const sy = obj.height / img.naturalHeight;
    const s = obj.scaleMode === "contain" ? Math.min(sx, sy) : Math.max(sx, sy);
    fimg.scale(s);
    fimg.set("data", { frameObject: obj });
    return fimg;
  } catch {
    return null;
  }
}

function createShapeEditorObj(obj: ShapeObject): fabric.Object {
  const shape = obj.shape === "circle"
    ? new fabric.Circle({
        left: obj.x,
        top: obj.y,
        radius: obj.width / 2,
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth ?? 0,
        opacity: obj.opacity ?? 1,
        angle: obj.rotation ?? 0,
        originX: "left",
        originY: "top",
      })
    : new fabric.Rect({
        left: obj.x,
        top: obj.y,
        width: obj.width,
        height: obj.height,
        fill: obj.fill,
        stroke: obj.stroke,
        strokeWidth: obj.strokeWidth ?? 0,
        rx: obj.borderRadius ?? 0,
        ry: obj.borderRadius ?? 0,
        opacity: obj.opacity ?? 1,
        angle: obj.rotation ?? 0,
        originX: "left",
        originY: "top",
      });
  shape.set("data", { frameObject: obj });
  return shape;
}

function createGradientEditorObj(obj: GradientObject): fabric.Object {
  const angleRad = ((obj.angle - 90) * Math.PI) / 180;
  const cx = obj.width / 2;
  const cy = obj.height / 2;
  const r = Math.max(obj.width, obj.height);
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
        coords: { x1: cx, y1: cy, r1: 0, x2: cx, y2: cy, r2: Math.max(obj.width, obj.height) / 2 },
        colorStops: expandedStops.map((s) => ({ offset: s.offset, color: s.color })),
      });

  const rect = new fabric.Rect({
    left: obj.x,
    top: obj.y,
    width: obj.width,
    height: obj.height,
    fill: gradient,
    opacity: obj.opacity ?? 1,
    angle: obj.rotation ?? 0,
    originX: "left",
    originY: "top",
  });
  rect.set("data", { frameObject: obj });
  return rect;
}

/**
 * Round-trip: extract FrameObject[] from canvas, applying any user transforms.
 * Each type pulls back its own editable properties.
 */
export function extractFrameObjects(canvas: fabric.Canvas): FrameObject[] {
  const objects: FrameObject[] = [];
  canvas.getObjects().forEach((fobj) => {
    const data = (fobj as unknown as { data?: EditorObjectData }).data;
    if (!data?.frameObject) return;
    const base = data.frameObject;
    const extracted = extractByType(fobj, base);
    if (extracted) objects.push(extracted);
  });
  return objects;
}

function extractByType(fobj: fabric.Object, base: FrameObject): FrameObject | null {
  // Common transform state
  const left = fobj.left ?? base.x;
  const top = fobj.top ?? base.y;
  const angle = fobj.angle ?? 0;
  const opacity = fobj.opacity ?? 1;
  const scaleX = fobj.scaleX ?? 1;
  const scaleY = fobj.scaleY ?? 1;

  switch (base.type) {
    case "photo-zone":
    case "shape": {
      // For rect/photo: width/height are the unscaled dims, multiply by scale
      if (fobj instanceof fabric.Circle) {
        // Circle: radius * 2 = visual diameter
        const r = (fobj.radius ?? 0) * scaleX;
        const updated: FrameObject = {
          ...base,
          x: left, y: top,
          width: r * 2, height: r * 2,
          rotation: angle, opacity,
        };
        return updated;
      }
      const w = (fobj.width ?? base.width) * scaleX;
      const h = (fobj.height ?? base.height) * scaleY;
      // For shape: also pull current fill back
      if (base.type === "shape") {
        return {
          ...base,
          x: left, y: top,
          width: w, height: h,
          rotation: angle, opacity,
          fill: typeof fobj.fill === "string" ? fobj.fill : base.fill,
        };
      }
      return {
        ...base,
        x: left, y: top,
        width: w, height: h,
        rotation: angle, opacity,
      };
    }

    case "text-zone": {
      if (!(fobj instanceof fabric.Textbox)) return base;
      // Textbox: width is wrap width (resizable independently of scaleX)
      // Actual visual width = width * scaleX, font scales with scaleX too
      const wrapWidth = fobj.width ?? base.width;
      // Convert scale into width/fontSize so saved values are 1.0 scale
      const effectiveWidth = wrapWidth * scaleX;
      const effectiveFontSize = (fobj.fontSize ?? base.fontSize) * scaleX;
      const fillColor = typeof fobj.fill === "string" ? fobj.fill : base.color;
      return {
        ...base,
        x: left, y: top,
        width: effectiveWidth,
        height: (fobj.height ?? base.height) * scaleY,
        rotation: angle, opacity,
        defaultText: fobj.text ?? base.defaultText,
        fontSize: effectiveFontSize,
        fontFamily: fobj.fontFamily ?? base.fontFamily,
        fontWeight: String(fobj.fontWeight ?? base.fontWeight),
        textAlign: (fobj.textAlign as "left" | "center" | "right") ?? base.textAlign,
        color: fillColor,
      };
    }

    case "asset": {
      if (!(fobj instanceof fabric.FabricImage)) return base;
      // For images: fabric.width/height are natural dims, scaleX/Y is display scale
      // We persist the displayed size in canvas coords
      const naturalW = fobj.width ?? 1;
      const naturalH = fobj.height ?? 1;
      const displayedW = naturalW * scaleX;
      const displayedH = naturalH * scaleY;
      return {
        ...base,
        x: left, y: top,
        width: displayedW,
        height: displayedH,
        rotation: angle, opacity,
      };
    }

    case "gradient": {
      const w = (fobj.width ?? base.width) * scaleX;
      const h = (fobj.height ?? base.height) * scaleY;
      // Gradient stops/curve are mutated in place by the properties panel
      return {
        ...base,
        x: left, y: top,
        width: w, height: h,
        rotation: angle, opacity,
      };
    }
  }
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

// Helpers to create new objects with sensible defaults
export function newPhotoZone(width: number, height: number): PhotoZone {
  return {
    id: crypto.randomUUID(),
    type: "photo-zone",
    photoIndex: 0,
    scaleMode: "cover",
    x: width * 0.1,
    y: height * 0.1,
    width: width * 0.8,
    height: height * 0.5,
    rotation: 0,
    opacity: 1,
  };
}

export function newTextZone(width: number, height: number, placeholder: "heading" | "subheading" = "heading"): TextZone {
  return {
    id: crypto.randomUUID(),
    type: "text-zone",
    placeholder,
    defaultText: placeholder === "heading" ? "Heading" : "Subheading",
    fontSize: placeholder === "heading" ? 64 : 32,
    fontFamily: "Arial",
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    uppercase: placeholder === "heading",
    shadow: true,
    x: width * 0.1,
    y: height * 0.7,
    width: width * 0.8,
    height: height * 0.15,
    rotation: 0,
    opacity: 1,
  };
}

export function newAsset(width: number, height: number, assetPath: string): AssetObject {
  return {
    id: crypto.randomUUID(),
    type: "asset",
    assetPath,
    scaleMode: "contain",
    x: width * 0.05,
    y: height * 0.05,
    width: width * 0.2,
    height: width * 0.2,
    rotation: 0,
    opacity: 1,
  };
}

export function newShape(width: number, height: number): ShapeObject {
  return {
    id: crypto.randomUUID(),
    type: "shape",
    shape: "rect",
    fill: "#dc2626",
    x: 0,
    y: height * 0.85,
    width,
    height: height * 0.05,
    rotation: 0,
    opacity: 1,
  };
}

export function newGradient(width: number, height: number): GradientObject {
  return {
    id: crypto.randomUUID(),
    type: "gradient",
    gradientType: "linear",
    angle: 180,
    stops: [
      { offset: 0, color: "rgba(0,0,0,0)" },
      { offset: 1, color: "rgba(0,0,0,0.7)" },
    ],
    x: 0,
    y: height * 0.5,
    width,
    height: height * 0.5,
    rotation: 0,
    opacity: 1,
  };
}
