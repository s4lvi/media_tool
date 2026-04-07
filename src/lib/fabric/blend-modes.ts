import type { BlendMode } from "@/types/editor";

export const BLEND_MODE_GROUPS: {
  label: string;
  modes: { value: BlendMode; label: string }[];
}[] = [
  {
    label: "Normal",
    modes: [{ value: "source-over", label: "Normal" }],
  },
  {
    label: "Darken",
    modes: [
      { value: "multiply", label: "Multiply" },
      { value: "darken", label: "Darken" },
      { value: "color-burn", label: "Color Burn" },
    ],
  },
  {
    label: "Lighten",
    modes: [
      { value: "screen", label: "Screen" },
      { value: "lighten", label: "Lighten" },
      { value: "color-dodge", label: "Color Dodge" },
    ],
  },
  {
    label: "Contrast",
    modes: [
      { value: "overlay", label: "Overlay" },
      { value: "hard-light", label: "Hard Light" },
      { value: "soft-light", label: "Soft Light" },
    ],
  },
  {
    label: "Comparative",
    modes: [
      { value: "difference", label: "Difference" },
      { value: "exclusion", label: "Exclusion" },
    ],
  },
  {
    label: "Component",
    modes: [
      { value: "hue", label: "Hue" },
      { value: "saturation", label: "Saturation" },
      { value: "color", label: "Color" },
      { value: "luminosity", label: "Luminosity" },
    ],
  },
];

export function getBlendModeLabel(mode: BlendMode): string {
  for (const group of BLEND_MODE_GROUPS) {
    const found = group.modes.find((m) => m.value === mode);
    if (found) return found.label;
  }
  return mode;
}
