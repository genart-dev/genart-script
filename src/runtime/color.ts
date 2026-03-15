/**
 * Color utilities: alpha shorthand, gradients, CSS color names → rgba.
 * These are injected as __colorAlpha__, __linearGradient__, __radialGradient__.
 */

/** Apply alpha to a color string (hex or named). Returns rgba() string. */
export function colorAlpha(color: string, alpha: number): string {
  const rgb = hexToRgb(color);
  if (rgb) return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
  // Named color fallback via canvas trick (not available in Node — return as-is)
  return color;
}

function hexToRgb(color: string): [number, number, number] | null {
  const h = color.startsWith("#") ? color.slice(1) : NAMED_HEX[color.toLowerCase()];
  if (!h) return null;
  if (h.length === 3) {
    return [
      parseInt(h[0]! + h[0]!, 16),
      parseInt(h[1]! + h[1]!, 16),
      parseInt(h[2]! + h[2]!, 16),
    ];
  }
  if (h.length === 6) {
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  return null;
}

export function linearGradient(
  ctx: CanvasRenderingContext2D,
  angleDeg: number,
  stops: string[],
): CanvasGradient {
  const rad = (angleDeg * Math.PI) / 180;
  const { canvas } = ctx;
  const w = canvas.width, h = canvas.height;
  const x0 = w / 2 - (Math.cos(rad) * w) / 2;
  const y0 = h / 2 - (Math.sin(rad) * h) / 2;
  const x1 = w / 2 + (Math.cos(rad) * w) / 2;
  const y1 = h / 2 + (Math.sin(rad) * h) / 2;
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

export function radialGradient(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  stops: string[],
): CanvasGradient {
  const r = Math.min(ctx.canvas.width, ctx.canvas.height) / 2;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

/** Minimal named color → hex map (common colors used in .gs scripts). */
const NAMED_HEX: Record<string, string> = {
  red: "ff0000", green: "008000", blue: "0000ff", white: "ffffff",
  black: "000000", gray: "808080", grey: "808080", yellow: "ffff00",
  orange: "ffa500", purple: "800080", pink: "ffc0cb", cyan: "00ffff",
  magenta: "ff00ff", coral: "ff7f50", salmon: "fa8072", gold: "ffd700",
  silver: "c0c0c0", teal: "008080", navy: "000080", maroon: "800000",
  olive: "808000", lime: "00ff00", aqua: "00ffff", fuchsia: "ff00ff",
  indigo: "4b0082", violet: "ee82ee", crimson: "dc143c",
  turquoise: "40e0d0", beige: "f5f5dc", ivory: "fffff0", khaki: "f0e68c",
  lavender: "e6e6fa", linen: "faf0e6", tan: "d2b48c", wheat: "f5deb3",
  transparent: "00000000",
};
