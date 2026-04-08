import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // COOP/COEP headers required for SharedArrayBuffer (multi-threaded ffmpeg.wasm)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};

export default nextConfig;
