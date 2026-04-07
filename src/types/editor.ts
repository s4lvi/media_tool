export type EditorTool = "select" | "pan" | "text" | "crop";

export type BlendMode =
  | "source-over"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

export const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: "source-over", label: "Normal" },
  { value: "multiply", label: "Multiply" },
  { value: "screen", label: "Screen" },
  { value: "overlay", label: "Overlay" },
  { value: "darken", label: "Darken" },
  { value: "lighten", label: "Lighten" },
  { value: "color-dodge", label: "Color Dodge" },
  { value: "color-burn", label: "Color Burn" },
  { value: "hard-light", label: "Hard Light" },
  { value: "soft-light", label: "Soft Light" },
  { value: "difference", label: "Difference" },
  { value: "exclusion", label: "Exclusion" },
  { value: "hue", label: "Hue" },
  { value: "saturation", label: "Saturation" },
  { value: "color", label: "Color" },
  { value: "luminosity", label: "Luminosity" },
];

export const ASPECT_RATIO_PRESETS = [
  { label: "Square", ratio: "1:1", width: 1080, height: 1080 },
  { label: "Portrait", ratio: "4:5", width: 1080, height: 1350 },
  { label: "Story / Reel", ratio: "9:16", width: 1080, height: 1920 },
  { label: "Landscape", ratio: "16:9", width: 1920, height: 1080 },
  { label: "Post Wide", ratio: "1.91:1", width: 1200, height: 628 },
  { label: "Letter", ratio: "8.5:11", width: 2550, height: 3300 },
  { label: "FB Cover", ratio: "2.63:1", width: 820, height: 312 },
  { label: "X Header", ratio: "3:1", width: 1500, height: 500 },
];
