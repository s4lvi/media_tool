// Frame Template — composable poster layout with placeholders

export type FrameObjectType =
  | "photo-zone"
  | "text-zone"
  | "asset"
  | "shape"
  | "gradient";

export interface BaseFrameObject {
  id: string;
  type: FrameObjectType;
  // All positions/sizes in canvas pixel coordinates (matches frame width/height)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number; // degrees
  opacity?: number;  // 0-1
  zIndex?: number;
}

export interface PhotoZone extends BaseFrameObject {
  type: "photo-zone";
  photoIndex: number; // which uploaded photo to use (0 = first)
  scaleMode: "cover" | "contain";
  filters?: {
    grayscale?: boolean;
    brightness?: number;
    contrast?: number;
  };
  blendMode?: string;
}

export interface TextZone extends BaseFrameObject {
  type: "text-zone";
  placeholder: "heading" | "subheading" | "custom";
  defaultText?: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  color: string;
  textAlign: "left" | "center" | "right";
  uppercase?: boolean;
  shadow?: boolean;
  backing?: "dark" | "light" | null;
}

export interface AssetObject extends BaseFrameObject {
  type: "asset";
  assetPath: string; // path to logo/asset image
  scaleMode: "cover" | "contain";
  blendMode?: string;
  backing?: "dark" | "light" | null;
}

export interface ShapeObject extends BaseFrameObject {
  type: "shape";
  shape: "rect" | "circle";
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  borderRadius?: number;
  blendMode?: string;
}

export interface GradientStop {
  offset: number; // 0-1
  color: string;
}

export type GradientCurve = "linear" | "long-tail" | "short-tail" | "smooth";

export interface GradientObject extends BaseFrameObject {
  type: "gradient";
  gradientType: "linear" | "radial";
  angle: number; // degrees, for linear
  stops: GradientStop[]; // 2 stops only — start and end. Curve generates intermediates.
  curve?: GradientCurve;
  blendMode?: string;
}

export type FrameObject =
  | PhotoZone
  | TextZone
  | AssetObject
  | ShapeObject
  | GradientObject;

export interface FrameTemplate {
  id: string;
  organization_id: string | null;
  created_by: string | null;
  name: string;
  description: string | null;
  category: string | null;
  aspect_ratio: string;
  width: number;
  height: number;
  min_photos: number;
  max_photos: number;
  objects: FrameObject[];
  thumbnail_url: string | null;
  is_seeded: boolean;
  is_public: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface FrameRenderInput {
  template: FrameTemplate;
  photos: string[]; // photo URLs
  texts: {
    heading?: string;
    subheading?: string;
    [key: string]: string | undefined;
  };
}
