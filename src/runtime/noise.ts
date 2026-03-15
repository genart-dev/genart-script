/**
 * Perlin noise — classic 3D implementation.
 * noise(x), noise(x,y), noise(x,y,z) → [-1, 1]
 */

const P: number[] = [];
const PERM = new Uint8Array(512);

function buildPerm(seed = 0): void {
  const base = Array.from({ length: 256 }, (_, i) => i);
  // Fisher-Yates with seeded LCG
  let s = seed >>> 0;
  for (let i = 255; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [base[i], base[j]] = [base[j]!, base[i]!];
  }
  for (let i = 0; i < 512; i++) PERM[i] = base[i & 255]!;
}

buildPerm(0);

function fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t: number, a: number, b: number): number { return a + t * (b - a); }
function grad(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

export function noise1(x: number): number {
  return noise3(x, 0, 0);
}

export function noise2(x: number, y: number): number {
  return noise3(x, y, 0);
}

export function noise3(x: number, y: number, z: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = PERM[X]! + Y, AA = PERM[A]! + Z, AB = PERM[A + 1]! + Z;
  const B = PERM[X + 1]! + Y, BA = PERM[B]! + Z, BB = PERM[B + 1]! + Z;
  return lerp(w,
    lerp(v, lerp(u, grad(PERM[AA]!, x, y, z), grad(PERM[BA]!, x - 1, y, z)),
              lerp(u, grad(PERM[AB]!, x, y - 1, z), grad(PERM[BB]!, x - 1, y - 1, z))),
    lerp(v, lerp(u, grad(PERM[AA + 1]!, x, y, z - 1), grad(PERM[BA + 1]!, x - 1, y, z - 1)),
              lerp(u, grad(PERM[AB + 1]!, x, y - 1, z - 1), grad(PERM[BB + 1]!, x - 1, y - 1, z - 1)))
  );
}

/** Reseed the noise table. */
export function noiseSeed(seed: number): void {
  buildPerm(seed);
}
