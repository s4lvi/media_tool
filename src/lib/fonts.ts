export interface FontDefinition {
  family: string;
  label: string;
  weights: { value: string; label: string }[];
  source: "custom" | "google" | "system";
  category: "sans-serif" | "serif" | "display" | "monospace";
}

// Custom fonts loaded via @font-face in globals.css
// Drop .woff2/.ttf files in public/fonts/ and add @font-face rules
export const CUSTOM_FONTS: FontDefinition[] = [
  {
    family: "Eurostile",
    label: "Eurostile",
    weights: [
      { value: "normal", label: "Regular" },
      { value: "bold", label: "Bold" },
    ],
    source: "custom",
    category: "sans-serif",
  },
];

// Google Fonts loaded dynamically
export const GOOGLE_FONTS: FontDefinition[] = [
  {
    family: "Oswald",
    label: "Oswald",
    weights: [
      { value: "400", label: "Regular" },
      { value: "500", label: "Medium" },
      { value: "700", label: "Bold" },
    ],
    source: "google",
    category: "sans-serif",
  },
  {
    family: "Bebas Neue",
    label: "Bebas Neue",
    weights: [{ value: "400", label: "Regular" }],
    source: "google",
    category: "display",
  },
  {
    family: "Roboto Condensed",
    label: "Roboto Condensed",
    weights: [
      { value: "400", label: "Regular" },
      { value: "700", label: "Bold" },
    ],
    source: "google",
    category: "sans-serif",
  },
  {
    family: "Anton",
    label: "Anton",
    weights: [{ value: "400", label: "Regular" }],
    source: "google",
    category: "display",
  },
  {
    family: "Impact",
    label: "Impact",
    weights: [{ value: "normal", label: "Regular" }],
    source: "system",
    category: "sans-serif",
  },
  {
    family: "Montserrat",
    label: "Montserrat",
    weights: [
      { value: "400", label: "Regular" },
      { value: "600", label: "Semi Bold" },
      { value: "700", label: "Bold" },
      { value: "900", label: "Black" },
    ],
    source: "google",
    category: "sans-serif",
  },
  {
    family: "Raleway",
    label: "Raleway",
    weights: [
      { value: "400", label: "Regular" },
      { value: "700", label: "Bold" },
      { value: "900", label: "Black" },
    ],
    source: "google",
    category: "sans-serif",
  },
  {
    family: "Archivo Black",
    label: "Archivo Black",
    weights: [{ value: "400", label: "Regular" }],
    source: "google",
    category: "sans-serif",
  },
];

export const SYSTEM_FONTS: FontDefinition[] = [
  {
    family: "Arial",
    label: "Arial",
    weights: [
      { value: "normal", label: "Regular" },
      { value: "bold", label: "Bold" },
    ],
    source: "system",
    category: "sans-serif",
  },
  {
    family: "Helvetica",
    label: "Helvetica",
    weights: [
      { value: "normal", label: "Regular" },
      { value: "bold", label: "Bold" },
    ],
    source: "system",
    category: "sans-serif",
  },
  {
    family: "Georgia",
    label: "Georgia",
    weights: [
      { value: "normal", label: "Regular" },
      { value: "bold", label: "Bold" },
    ],
    source: "system",
    category: "serif",
  },
];

export const ALL_FONTS: FontDefinition[] = [
  ...CUSTOM_FONTS,
  ...GOOGLE_FONTS,
  ...SYSTEM_FONTS,
];

// Load a Google Font dynamically
const loadedFonts = new Set<string>();

export async function loadFont(font: FontDefinition): Promise<void> {
  if (font.source === "system" || font.source === "custom") return;
  if (loadedFonts.has(font.family)) return;

  const weights = font.weights.map((w) => w.value).join(";");
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family)}:wght@${weights}&display=swap`;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);

  // Wait for font to actually load
  await document.fonts.load(`${font.weights[0].value} 16px "${font.family}"`);
  loadedFonts.add(font.family);
}

export function preloadAllGoogleFonts(): void {
  const families = GOOGLE_FONTS.map((f) => {
    const weights = f.weights.map((w) => w.value).join(";");
    return `family=${encodeURIComponent(f.family)}:wght@${weights}`;
  });

  const url = `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = url;
  document.head.appendChild(link);

  // Mark all as loaded
  GOOGLE_FONTS.forEach((f) => loadedFonts.add(f.family));
}
