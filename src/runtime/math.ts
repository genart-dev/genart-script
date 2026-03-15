/** Math utilities exposed as GenArt Script globals. */

export const PI = Math.PI;
export const TWO_PI = Math.PI * 2;
export const HALF_PI = Math.PI / 2;

export function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
export function clamp(v: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, v)); }
export function map(v: number, inLo: number, inHi: number, outLo: number, outHi: number): number {
  return outLo + ((v - inLo) / (inHi - inLo)) * (outHi - outLo);
}
export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

export const { sin, cos, tan, atan2, sqrt, abs, floor, ceil, round, min, max, pow, log, exp } = Math;

/**
 * Generate a numeric range array.
 * `range(n)` → [0, 1, ..., n-1]
 * `range(start, end)` → [start, ..., end-1]
 * `range(start, end, step)` → values from start up to (not including) end, incrementing by step
 */
export function range(n: number, end?: number, step = 1): number[] {
  const [start, stop] = end === undefined ? [0, n] : [n, end];
  const result: number[] = [];
  for (let i = start; i < stop; i += step) result.push(i);
  return result;
}
