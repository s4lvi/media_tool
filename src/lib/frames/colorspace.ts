/**
 * Detect whether an image file (PNG/JPEG) has a wide-gamut color profile
 * (Display P3 or similar) by inspecting its file header chunks.
 *
 * Returns "display-p3" if a wide-gamut profile is detected, "srgb" otherwise.
 */
export type DetectedColorSpace = "display-p3" | "srgb";

export async function detectColorSpaceFromUrl(url: string): Promise<DetectedColorSpace> {
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    return detectColorSpaceFromBuffer(buf);
  } catch {
    return "srgb";
  }
}

export function detectColorSpaceFromBuffer(buf: ArrayBuffer): DetectedColorSpace {
  const view = new Uint8Array(buf);
  // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4e && view[3] === 0x47;
  if (isPng) {
    return detectPngColorSpace(view);
  }
  // JPEG: starts with FF D8 FF
  const isJpeg = view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff;
  if (isJpeg) {
    return detectJpegColorSpace(view);
  }
  return "srgb";
}

function detectPngColorSpace(view: Uint8Array): DetectedColorSpace {
  // Walk PNG chunks looking for iCCP (embedded profile) or cICP (coding-independent)
  let pos = 8; // skip signature
  while (pos < view.length - 8) {
    const len =
      (view[pos] << 24) | (view[pos + 1] << 16) | (view[pos + 2] << 8) | view[pos + 3];
    const type = String.fromCharCode(
      view[pos + 4],
      view[pos + 5],
      view[pos + 6],
      view[pos + 7]
    );
    if (type === "iCCP") {
      // iCCP: profile name (1-79 bytes, null-terminated) + compression byte + compressed profile
      let nameEnd = pos + 8;
      while (nameEnd < pos + 8 + 80 && view[nameEnd] !== 0) nameEnd++;
      const name = String.fromCharCode(...view.slice(pos + 8, nameEnd)).toLowerCase();
      if (
        name.includes("display p3") ||
        name.includes("display-p3") ||
        name.includes("p3") ||
        name.includes("rec2020") ||
        name.includes("dci")
      ) {
        return "display-p3";
      }
      // Embedded profile but unknown name — also try to scan the compressed bytes
      // for the profile description. Common profile names appear plaintext-ish in
      // the compressed stream. Cheap heuristic:
      const profileBytes = view.slice(nameEnd + 2, pos + 8 + len);
      const ascii = bytesToAscii(profileBytes);
      if (
        /display\s*p3/i.test(ascii) ||
        /\bp3\b/i.test(ascii) ||
        /rec2020/i.test(ascii)
      ) {
        return "display-p3";
      }
      return "srgb";
    }
    if (type === "cICP") {
      // cICP chunk: colour primaries (1) + transfer (1) + matrix (1) + full range (1)
      const primaries = view[pos + 8];
      // 12 = Display P3, 9 = Rec.2020
      if (primaries === 12 || primaries === 9) return "display-p3";
      return "srgb";
    }
    if (type === "sRGB") {
      return "srgb";
    }
    if (type === "IDAT") {
      // Hit pixel data — no color profile chunks earlier means default sRGB
      return "srgb";
    }
    pos += 12 + len; // length(4) + type(4) + data + crc(4)
  }
  return "srgb";
}

function detectJpegColorSpace(view: Uint8Array): DetectedColorSpace {
  // Look for ICC_PROFILE marker in APP2 segment
  let pos = 2;
  while (pos < view.length - 4) {
    if (view[pos] !== 0xff) {
      pos++;
      continue;
    }
    const marker = view[pos + 1];
    if (marker === 0xd9 || marker === 0xda) break; // EOI / SOS
    const len = (view[pos + 2] << 8) | view[pos + 3];
    if (marker === 0xe2 && len > 14) {
      // APP2: check for "ICC_PROFILE\0" identifier
      const id = String.fromCharCode(
        view[pos + 4], view[pos + 5], view[pos + 6], view[pos + 7],
        view[pos + 8], view[pos + 9], view[pos + 10], view[pos + 11],
        view[pos + 12], view[pos + 13], view[pos + 14]
      );
      if (id === "ICC_PROFILE") {
        const profileData = view.slice(pos + 18, pos + 2 + len);
        const ascii = bytesToAscii(profileData);
        if (
          /display\s*p3/i.test(ascii) ||
          /\bp3\b/i.test(ascii) ||
          /rec2020/i.test(ascii)
        ) {
          return "display-p3";
        }
        return "srgb";
      }
    }
    pos += 2 + len;
  }
  return "srgb";
}

function bytesToAscii(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if (c >= 32 && c < 127) s += String.fromCharCode(c);
    else s += " ";
  }
  return s;
}
