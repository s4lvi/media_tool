import type { FrameObject, FrameTemplate } from "@/types/frame-template";

const LOGO = {
  classic: "/assets/logos/ACP Logo Classic.png",
  white: "/assets/logos/ACP-Logo-White.svg",
};

type SeedTemplate = Omit<
  FrameTemplate,
  "id" | "organization_id" | "created_by" | "thumbnail_url" | "created_at" | "updated_at"
>;

const id = () => crypto.randomUUID();

// 4:5 portrait base dimensions
const W = 1080;
const H = 1350;

export const SEED_TEMPLATES: SeedTemplate[] = [
  // ============================
  // CORNER LOGO
  // ============================
  {
    name: "Corner Logo",
    description: "Full-bleed photo with logo top-left and caption at bottom",
    category: "frame",
    aspect_ratio: "4:5",
    width: W,
    height: H,
    min_photos: 1,
    max_photos: 1,
    is_seeded: false,
    is_public: false,
    tags: [],
    objects: [
      {
        id: id(),
        type: "photo-zone",
        photoIndex: 0,
        scaleMode: "cover",
        x: 0, y: 0, width: W, height: H,
      },
      // Dark gradient overlay at bottom for text readability
      {
        id: id(),
        type: "gradient",
        gradientType: "linear",
        angle: 180,
        curve: "long-tail",
        stops: [
          { offset: 0, color: "rgba(0,0,0,0)" },
          { offset: 1, color: "rgba(0,0,0,0.7)" },
        ],
        x: 0, y: H * 0.5, width: W, height: H * 0.5,
      },
      {
        id: id(),
        type: "asset",
        assetPath: LOGO.white,
        scaleMode: "contain",
        x: W * 0.04, y: H * 0.04,
        width: W * 0.18, height: W * 0.18,
        backing: "dark",
      },
      {
        id: id(),
        type: "text-zone",
        placeholder: "heading",
        defaultText: "Heading",
        fontSize: 72,
        fontFamily: "Arial",
        fontWeight: "bold",
        color: "#ffffff",
        textAlign: "center",
        uppercase: true,
        shadow: true,
        x: W * 0.06, y: H * 0.78,
        width: W * 0.88, height: H * 0.1,
      },
      {
        id: id(),
        type: "text-zone",
        placeholder: "subheading",
        defaultText: "Subheading",
        fontSize: 30,
        fontFamily: "Arial",
        fontWeight: "normal",
        color: "#dddddd",
        textAlign: "center",
        x: W * 0.1, y: H * 0.91,
        width: W * 0.8, height: H * 0.05,
      },
    ],
  },

  // ============================
  // MINIMAL BORDER
  // ============================
  {
    name: "Minimal Border",
    description: "Photo with red border and small logo watermark",
    category: "frame",
    aspect_ratio: "4:5",
    width: W,
    height: H,
    min_photos: 1,
    max_photos: 1,
    is_seeded: false,
    is_public: false,
    tags: [],
    objects: [
      {
        id: id(),
        type: "shape",
        shape: "rect",
        fill: "#dc2626",
        x: 0, y: 0, width: W, height: H,
      },
      {
        id: id(),
        type: "photo-zone",
        photoIndex: 0,
        scaleMode: "cover",
        x: W * 0.028, y: W * 0.028,
        width: W - W * 0.056, height: H - W * 0.056,
      },
      {
        id: id(),
        type: "asset",
        assetPath: LOGO.classic,
        scaleMode: "contain",
        x: W * 0.83, y: H * 0.88,
        width: W * 0.1, height: W * 0.1,
        opacity: 0.85,
      },
    ],
  },

  // ============================
  // BOLD TEXT (story-style)
  // ============================
  {
    name: "Bold Text",
    description: "Darkened photo with large heading text — story style",
    category: "story",
    aspect_ratio: "4:5",
    width: W,
    height: H,
    min_photos: 1,
    max_photos: 1,
    is_seeded: false,
    is_public: false,
    tags: [],
    objects: [
      {
        id: id(),
        type: "photo-zone",
        photoIndex: 0,
        scaleMode: "cover",
        x: 0, y: 0, width: W, height: H,
      },
      {
        id: id(),
        type: "shape",
        shape: "rect",
        fill: "#000000",
        opacity: 0.4,
        x: 0, y: 0, width: W, height: H,
      },
      {
        id: id(),
        type: "asset",
        assetPath: LOGO.white,
        scaleMode: "contain",
        x: W * 0.05, y: H * 0.04,
        width: W * 0.2, height: W * 0.2,
        backing: "dark",
      },
      {
        id: id(),
        type: "text-zone",
        placeholder: "heading",
        defaultText: "Heading",
        fontSize: 96,
        fontFamily: "Arial",
        fontWeight: "bold",
        color: "#ffffff",
        textAlign: "center",
        uppercase: true,
        shadow: true,
        x: W * 0.05, y: H * 0.62,
        width: W * 0.9, height: H * 0.25,
      },
    ],
  },

  // ============================
  // TOP & BOTTOM
  // ============================
  {
    name: "Top & Bottom",
    description: "Photo with red header and dark footer bars",
    category: "story",
    aspect_ratio: "9:16",
    width: 1080,
    height: 1920,
    min_photos: 1,
    max_photos: 1,
    is_seeded: false,
    is_public: false,
    tags: [],
    objects: [
      // Top accent bar
      {
        id: id(),
        type: "shape",
        shape: "rect",
        fill: "#dc2626",
        x: 0, y: 0, width: 1080, height: 1920 * 0.12,
      },
      // Photo
      {
        id: id(),
        type: "photo-zone",
        photoIndex: 0,
        scaleMode: "cover",
        x: 0, y: 1920 * 0.12,
        width: 1080, height: 1920 * 0.76,
      },
      // Dark footer
      {
        id: id(),
        type: "shape",
        shape: "rect",
        fill: "#111111",
        x: 0, y: 1920 * 0.88,
        width: 1080, height: 1920 * 0.12,
      },
      // Logo in header
      {
        id: id(),
        type: "asset",
        assetPath: LOGO.white,
        scaleMode: "contain",
        x: 540 - 1920 * 0.04,
        y: 1920 * 0.02,
        width: 1920 * 0.08,
        height: 1920 * 0.08,
      },
      // Heading in footer
      {
        id: id(),
        type: "text-zone",
        placeholder: "heading",
        defaultText: "Heading",
        fontSize: 56,
        fontFamily: "Arial",
        fontWeight: "bold",
        color: "#ffffff",
        textAlign: "center",
        uppercase: true,
        x: 1080 * 0.075, y: 1920 * 0.91,
        width: 1080 * 0.85, height: 1920 * 0.06,
      },
    ],
  },

  // ============================
  // 2x2 GRID
  // ============================
  {
    name: "2x2 Grid",
    description: "Four photos in a clean grid with red border",
    category: "collage",
    aspect_ratio: "1:1",
    width: 1080,
    height: 1080,
    min_photos: 2,
    max_photos: 4,
    is_seeded: false,
    is_public: false,
    tags: [],
    objects: [
      // Background (red border)
      {
        id: id(),
        type: "shape",
        shape: "rect",
        fill: "#dc2626",
        x: 0, y: 0, width: 1080, height: 1080,
      },
      // 4 photo zones
      ...([0, 1, 2, 3].map((i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const cellW = (1080 - 16) / 2;
        const cellH = (1080 - 16) / 2;
        return {
          id: id(),
          type: "photo-zone" as const,
          photoIndex: i,
          scaleMode: "cover" as const,
          x: 8 + col * (cellW + 8),
          y: 8 + row * (cellH + 8),
          width: cellW,
          height: cellH,
        };
      })),
      // Logo watermark
      {
        id: id(),
        type: "asset",
        assetPath: LOGO.white,
        scaleMode: "contain",
        x: 1080 * 0.85, y: 1080 * 0.85,
        width: 1080 * 0.1, height: 1080 * 0.1,
        opacity: 0.85,
        backing: "dark",
      },
    ],
  },

  // ============================
  // HERO + STRIP
  // ============================
  {
    name: "Hero + Strip",
    description: "Large hero photo with 3-photo strip below",
    category: "collage",
    aspect_ratio: "4:5",
    width: W,
    height: H,
    min_photos: 2,
    max_photos: 4,
    is_seeded: false,
    is_public: false,
    tags: [],
    objects: [
      // Hero photo
      {
        id: id(),
        type: "photo-zone",
        photoIndex: 0,
        scaleMode: "cover",
        x: 0, y: 0, width: W, height: H * 0.72,
      },
      // 3 strip photos
      ...([0, 1, 2].map((i) => {
        const cellW = (W - 16) / 3;
        return {
          id: id(),
          type: "photo-zone" as const,
          photoIndex: i + 1,
          scaleMode: "cover" as const,
          x: i * (cellW + 8),
          y: H * 0.72 + 8,
          width: cellW,
          height: H * 0.28 - 8,
        };
      })),
      // Logo overlay on hero
      {
        id: id(),
        type: "asset",
        assetPath: LOGO.white,
        scaleMode: "contain",
        x: W * 0.04, y: H * 0.03,
        width: W * 0.12, height: W * 0.12,
        backing: "dark",
      },
    ],
  },

  // ============================
  // EVENT POSTER
  // ============================
  {
    name: "Event Poster",
    description: "Photo background with text panel and event details",
    category: "poster",
    aspect_ratio: "4:5",
    width: W,
    height: H,
    min_photos: 1,
    max_photos: 1,
    is_seeded: false,
    is_public: false,
    tags: [],
    objects: [
      {
        id: id(),
        type: "photo-zone",
        photoIndex: 0,
        scaleMode: "cover",
        x: 0, y: 0, width: W, height: H,
      },
      // Dark overlay
      {
        id: id(),
        type: "shape",
        shape: "rect",
        fill: "#000000",
        opacity: 0.45,
        x: 0, y: 0, width: W, height: H,
      },
      // Top accent line
      {
        id: id(),
        type: "shape",
        shape: "rect",
        fill: "#dc2626",
        x: 0, y: 0, width: W, height: H * 0.005,
      },
      // Text panel
      {
        id: id(),
        type: "shape",
        shape: "rect",
        fill: "#000000",
        opacity: 0.7,
        x: W * 0.07, y: H * 0.55,
        width: W * 0.86, height: H * 0.36,
      },
      // Panel accent line
      {
        id: id(),
        type: "shape",
        shape: "rect",
        fill: "#dc2626",
        x: W * 0.07, y: H * 0.55,
        width: W * 0.86, height: H * 0.005,
      },
      // Logo top-left
      {
        id: id(),
        type: "asset",
        assetPath: LOGO.white,
        scaleMode: "contain",
        x: W * 0.1, y: H * 0.06,
        width: W * 0.16, height: W * 0.16,
        backing: "dark",
      },
      // Heading in panel
      {
        id: id(),
        type: "text-zone",
        placeholder: "heading",
        defaultText: "Heading",
        fontSize: 64,
        fontFamily: "Arial",
        fontWeight: "bold",
        color: "#ffffff",
        textAlign: "center",
        uppercase: true,
        shadow: true,
        x: W * 0.075, y: H * 0.6,
        width: W * 0.85, height: H * 0.15,
      },
      {
        id: id(),
        type: "text-zone",
        placeholder: "subheading",
        defaultText: "Subheading",
        fontSize: 34,
        fontFamily: "Arial",
        fontWeight: "bold",
        color: "#ffffff",
        textAlign: "center",
        x: W * 0.14, y: H * 0.78,
        width: W * 0.72, height: H * 0.08,
      },
    ],
  },

  // ============================
  // SPLIT LAYOUT
  // ============================
  {
    name: "Split Layout",
    description: "Half photo, half color with text on the side",
    category: "poster",
    aspect_ratio: "1:1",
    width: 1080,
    height: 1080,
    min_photos: 1,
    max_photos: 1,
    is_seeded: false,
    is_public: false,
    tags: [],
    objects: [
      // Color background (right side)
      {
        id: id(),
        type: "shape",
        shape: "rect",
        fill: "#dc2626",
        x: 0, y: 0, width: 1080, height: 1080,
      },
      // Photo on left
      {
        id: id(),
        type: "photo-zone",
        photoIndex: 0,
        scaleMode: "cover",
        x: 0, y: 0, width: 1080 * 0.55, height: 1080,
      },
      // Logo on color side
      {
        id: id(),
        type: "asset",
        assetPath: LOGO.white,
        scaleMode: "contain",
        x: 1080 * 0.55 + 1080 * 0.225 - 1080 * 0.075,
        y: 1080 * 0.1,
        width: 1080 * 0.15,
        height: 1080 * 0.15,
      },
      {
        id: id(),
        type: "text-zone",
        placeholder: "heading",
        defaultText: "Heading",
        fontSize: 56,
        fontFamily: "Arial",
        fontWeight: "bold",
        color: "#ffffff",
        textAlign: "center",
        uppercase: true,
        x: 1080 * 0.55 + 1080 * 0.04,
        y: 1080 * 0.42,
        width: 1080 * 0.37,
        height: 1080 * 0.2,
      },
      {
        id: id(),
        type: "text-zone",
        placeholder: "subheading",
        defaultText: "Subheading",
        fontSize: 24,
        fontFamily: "Arial",
        fontWeight: "normal",
        color: "#ffffffcc",
        textAlign: "center",
        x: 1080 * 0.55 + 1080 * 0.05,
        y: 1080 * 0.68,
        width: 1080 * 0.35,
        height: 1080 * 0.1,
      },
    ],
  },

  // ============================
  // B&W CINEMATIC
  // ============================
  {
    name: "B&W Cinematic",
    description: "Grayscale photo with cinematic text overlay",
    category: "story",
    aspect_ratio: "4:5",
    width: W,
    height: H,
    min_photos: 1,
    max_photos: 1,
    is_seeded: false,
    is_public: false,
    tags: [],
    objects: [
      {
        id: id(),
        type: "photo-zone",
        photoIndex: 0,
        scaleMode: "cover",
        x: 0, y: 0, width: W, height: H,
        filters: { grayscale: true, contrast: 0.15, brightness: -0.1 },
      },
      {
        id: id(),
        type: "shape",
        shape: "rect",
        fill: "#000000",
        opacity: 0.25,
        x: 0, y: 0, width: W, height: H,
      },
      {
        id: id(),
        type: "text-zone",
        placeholder: "heading",
        defaultText: "Heading",
        fontSize: 56,
        fontFamily: "Georgia",
        fontWeight: "normal",
        color: "#ffffff",
        textAlign: "center",
        uppercase: true,
        shadow: true,
        x: W * 0.075, y: H * 0.25,
        width: W * 0.85, height: H * 0.1,
      },
      {
        id: id(),
        type: "asset",
        assetPath: LOGO.white,
        scaleMode: "contain",
        x: W / 2 - W * 0.07,
        y: H * 0.78,
        width: W * 0.14,
        height: W * 0.14,
        backing: "dark",
      },
      {
        id: id(),
        type: "text-zone",
        placeholder: "subheading",
        defaultText: "Subheading",
        fontSize: 24,
        fontFamily: "Arial",
        fontWeight: "bold",
        color: "#ffffff",
        textAlign: "center",
        x: W * 0.2, y: H * 0.93,
        width: W * 0.6, height: H * 0.04,
      },
    ],
  },

  // ============================
  // COLLAGE + HEADER
  // ============================
  {
    name: "Collage + Header",
    description: "Bordered collage with header text and photo strip",
    category: "collage",
    aspect_ratio: "4:5",
    width: W,
    height: H,
    min_photos: 2,
    max_photos: 4,
    is_seeded: false,
    is_public: false,
    tags: [],
    objects: [
      // Red border background
      {
        id: id(),
        type: "shape",
        shape: "rect",
        fill: "#dc2626",
        x: 0, y: 0, width: W, height: H,
      },
      // Dark inner background
      {
        id: id(),
        type: "shape",
        shape: "rect",
        fill: "#111111",
        x: W * 0.02, y: H * 0.13,
        width: W * 0.96, height: H * 0.85,
      },
      // Header text
      {
        id: id(),
        type: "text-zone",
        placeholder: "heading",
        defaultText: "Heading",
        fontSize: 56,
        fontFamily: "Arial",
        fontWeight: "bold",
        color: "#ffffff",
        textAlign: "center",
        uppercase: true,
        x: W * 0.05, y: H * 0.025,
        width: W * 0.9, height: H * 0.08,
      },
      // Subheading
      {
        id: id(),
        type: "text-zone",
        placeholder: "subheading",
        defaultText: "Subheading",
        fontSize: 22,
        fontFamily: "Arial",
        fontWeight: "normal",
        color: "#dddddd",
        textAlign: "center",
        x: W * 0.05, y: H * 0.16,
        width: W * 0.9, height: H * 0.04,
      },
      // Hero photo
      {
        id: id(),
        type: "photo-zone",
        photoIndex: 0,
        scaleMode: "cover",
        x: W * 0.04, y: H * 0.22,
        width: W * 0.92, height: H * 0.5,
      },
      // 3-photo strip
      ...([0, 1, 2].map((i) => {
        const cellW = (W * 0.92 - 16) / 3;
        return {
          id: id(),
          type: "photo-zone" as const,
          photoIndex: i + 1,
          scaleMode: "cover" as const,
          x: W * 0.04 + i * (cellW + 8),
          y: H * 0.74,
          width: cellW,
          height: H * 0.16,
        };
      })),
      // Logo at bottom
      {
        id: id(),
        type: "asset",
        assetPath: LOGO.classic,
        scaleMode: "contain",
        x: W / 2 - W * 0.07,
        y: H * 0.92,
        width: W * 0.14,
        height: W * 0.06,
      },
    ],
  },

  // ============================
  // DARK MOODY
  // ============================
  {
    name: "Dark Moody",
    description: "Desaturated dark photo with red accent and bold text",
    category: "story",
    aspect_ratio: "4:5",
    width: W,
    height: H,
    min_photos: 1,
    max_photos: 1,
    is_seeded: false,
    is_public: false,
    tags: [],
    objects: [
      {
        id: id(),
        type: "photo-zone",
        photoIndex: 0,
        scaleMode: "cover",
        x: 0, y: 0, width: W, height: H,
        filters: { grayscale: true, brightness: -0.2, contrast: 0.2 },
      },
      {
        id: id(),
        type: "shape",
        shape: "rect",
        fill: "#000000",
        opacity: 0.35,
        x: 0, y: 0, width: W, height: H,
      },
      // Top accent
      {
        id: id(),
        type: "shape",
        shape: "rect",
        fill: "#dc2626",
        x: 0, y: 0, width: W, height: H * 0.005,
      },
      // Bottom accent
      {
        id: id(),
        type: "shape",
        shape: "rect",
        fill: "#dc2626",
        x: 0, y: H - H * 0.005, width: W, height: H * 0.005,
      },
      {
        id: id(),
        type: "asset",
        assetPath: LOGO.white,
        scaleMode: "contain",
        x: W * 0.06, y: H * 0.05,
        width: W * 0.15, height: W * 0.15,
        backing: "dark",
      },
      {
        id: id(),
        type: "text-zone",
        placeholder: "heading",
        defaultText: "Heading",
        fontSize: 80,
        fontFamily: "Arial",
        fontWeight: "bold",
        color: "#ffffff",
        textAlign: "left",
        uppercase: true,
        shadow: true,
        x: W * 0.06, y: H * 0.65,
        width: W * 0.88, height: H * 0.2,
      },
      {
        id: id(),
        type: "text-zone",
        placeholder: "subheading",
        defaultText: "Subheading",
        fontSize: 22,
        fontFamily: "Arial",
        fontWeight: "normal",
        color: "#dc2626",
        textAlign: "left",
        x: W * 0.06, y: H * 0.9,
        width: W * 0.88, height: H * 0.05,
      },
    ],
  },
];

export const SEED_TEMPLATE_NAMES = SEED_TEMPLATES.map((t) => t.name);
