import type { GradientStop, GradientCurve } from "@/types/frame-template";

// Easing functions: input 0..1 → output 0..1
const easings: Record<GradientCurve, (t: number) => number> = {
  linear: (t) => t,
  // long-tail: stays near start for a while, then ramps up fast
  // (slow start) — quadratic ease-in
  "long-tail": (t) => t * t * t,
  // short-tail: ramps up fast then slowly approaches end
  // (fast start) — quadratic ease-out
  "short-tail": (t) => 1 - Math.pow(1 - t, 3),
  // smooth: S-curve, slow at both ends
  smooth: (t) => t * t * (3 - 2 * t),
};

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(c: string): RGBA {
  if (c.startsWith("#")) {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    const a = c.length === 9 ? parseInt(c.slice(7), 16) / 255 : 1;
    return { r, g, b, a };
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return { r: 0, g: 0, b: 0, a: 1 };
  const parts = m[1].split(",").map((p) => parseFloat(p.trim()));
  return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts[3] ?? 1 };
}

function formatColor(c: RGBA): string {
  return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${c.a})`;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: RGBA, b: RGBA, t: number): RGBA {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
    a: lerp(a.a, b.a, t),
  };
}

/**
 * Expand a 2-stop gradient + curve into a series of intermediate stops
 * that approximate the easing function.
 */
export function expandGradientStops(
  startStop: GradientStop,
  endStop: GradientStop,
  curve: GradientCurve = "linear"
): GradientStop[] {
  if (curve === "linear") {
    return [startStop, endStop];
  }

  const ease = easings[curve];
  const startColor = parseColor(startStop.color);
  const endColor = parseColor(endStop.color);
  const steps = 10;
  const result: GradientStop[] = [];

  for (let i = 0; i <= steps; i++) {
    const offset = i / steps;
    // Map raw offset onto the start..end range
    const positionInRange = offset; // we want stops along 0..1 range
    const t = ease(positionInRange);
    const color = lerpColor(startColor, endColor, t);
    result.push({
      offset: startStop.offset + (endStop.offset - startStop.offset) * positionInRange,
      color: formatColor(color),
    });
  }

  return result;
}
