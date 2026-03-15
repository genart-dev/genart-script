/**
 * GenArt Script runtime library.
 *
 * Exported as the `./runtime` entry point. Consumed by the renderer adapter
 * in `@genart-dev/core`. Not imported by the compiler itself.
 */

import { PRNG, defaultPRNG } from "./prng";
import { noise1, noise2, noise3, noiseSeed } from "./noise";
import { colorAlpha, linearGradient, radialGradient } from "./color";
import { PI, TWO_PI, HALF_PI, lerp, clamp, map, dist, range, sin, cos, tan, atan2, sqrt, abs, floor, ceil, round, min, max, pow, log, exp } from "./math";

export { PRNG, defaultPRNG };
export { noise1, noise2, noise3, noiseSeed };
export { PI, TWO_PI, HALF_PI, lerp, clamp, map, dist, range, sin, cos, tan, atan2, sqrt, abs, floor, ceil, round, min, max, pow, log, exp };
export { colorAlpha, linearGradient, radialGradient };

/**
 * Build the globals object injected into the compiled script's scope.
 * The renderer adapter calls this and passes the result to `new Function(...)`.
 */
export function buildGlobals(
  ctx: CanvasRenderingContext2D,
  params: Record<string, number>,
  colors: Record<string, string>,
  seed: number,
): RuntimeGlobals {
  defaultPRNG.seed(null, seed);

  return {
    // Canvas context helpers
    __ctx__: ctx,
    w: ctx.canvas.width,
    h: ctx.canvas.height,

    // Params / colors (injected as globals via codegen let statements)
    __params__: params,
    __colors__: colors,

    // PRNG
    __rnd__: defaultPRNG,
    rnd: (a: number, b?: number) => defaultPRNG.rnd(a, b),
    rndInt: (a: number, b?: number) => Math.floor(defaultPRNG.rnd(a, b)),

    // Noise
    noise: (x: number, y?: number, z?: number) =>
      z !== undefined ? noise3(x, y!, z) :
      y !== undefined ? noise2(x, y) :
      noise1(x),

    // Math
    PI, TWO_PI, HALF_PI,
    lerp, clamp, map, dist, range,
    sin, cos, tan, atan2, sqrt, abs, floor, ceil, round, min, max, pow, log, exp,

    // Array helpers (use seeded PRNG for reproducibility)
    pick: <T>(arr: T[]): T => arr[Math.floor(defaultPRNG.rnd(arr.length))]!,
    shuffle: <T>(arr: T[]): T[] => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(defaultPRNG.rnd(i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },

    // Color helpers used by compiled code
    __colorAlpha__: colorAlpha,
    __linearGradient__: (angle: number, stops: string[]) => linearGradient(ctx, angle, stops),
    __radialGradient__: (cx: number, cy: number, stops: string[]) => radialGradient(ctx, cx, cy, stops),

    // Offscreen buffer — `buf = buffer(w, h)` then `into buf:` / `draw buf x y`
    buffer: (bw: number, bh: number): HTMLCanvasElement => {
      const c = document.createElement("canvas");
      c.width = bw; c.height = bh;
      return c;
    },

    // Vector type — `v = vec(x, y)`, then `v.add(u)`, `v.mag()`, etc.
    vec,

    // Image loading — synchronous return; load starts in background.
    // `ctx.drawImage` on an unloaded image is a no-op in all browsers.
    load: (url: string): HTMLImageElement => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      return img;
    },

    // Font loading — async via FontFace API; use `await loadFont(...)` inside `once:`.
    // Returns a font descriptor `{ family }` for use with `text ... font:f`.
    loadFont: async (family: string, url: string): Promise<{ family: string }> => {
      const face = new FontFace(family, `url(${url})`);
      await face.load();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (document.fonts as any).add(face);
      return { family };
    },

    // Text measurement — returns { width, height } for the given string.
    // height is approximated as `size` (actual line metrics vary by font).
    measure: (text: string, size = 16, family = "sans-serif"): { width: number; height: number } => {
      const saved = ctx.font;
      ctx.font = `${size}px ${family}`;
      const m = ctx.measureText(text);
      ctx.font = saved;
      return { width: m.width, height: size };
    },
  };
}

/** Standalone `vec` factory — also available as a global in compiled scripts. */
export function vec(x: number, y: number): Vec { return buildVec(x, y); }

// Internal helper — avoids re-capturing closure each time
function buildVec(x: number, y: number): Vec {
  return {
    x, y,
    add: (u) => buildVec(x + u.x, y + u.y),
    sub: (u) => buildVec(x - u.x, y - u.y),
    mult: (n) => buildVec(x * n, y * n),
    mag: () => Math.sqrt(x * x + y * y),
    norm: () => { const m = Math.sqrt(x * x + y * y); return m ? buildVec(x / m, y / m) : buildVec(0, 0); },
    dot: (u) => x * u.x + y * u.y,
    angle: () => Math.atan2(y, x),
  };
}

export interface Vec {
  x: number; y: number;
  add(v: Vec): Vec;
  sub(v: Vec): Vec;
  mult(n: number): Vec;
  mag(): number;
  norm(): Vec;
  dot(v: Vec): number;
  angle(): number;
}

export interface RuntimeGlobals {
  __ctx__: CanvasRenderingContext2D;
  w: number;
  h: number;
  __params__: Record<string, number>;
  __colors__: Record<string, string>;
  __rnd__: PRNG;
  rnd: (a: number, b?: number) => number;
  rndInt: (a: number, b?: number) => number;
  noise: (x: number, y?: number, z?: number) => number;
  PI: number; TWO_PI: number; HALF_PI: number;
  lerp: typeof lerp; clamp: typeof clamp; map: typeof map; dist: typeof dist;
  range: typeof range;
  sin: typeof sin; cos: typeof cos; tan: typeof tan; atan2: typeof atan2;
  sqrt: typeof sqrt; abs: typeof abs; floor: typeof floor; ceil: typeof ceil;
  round: typeof round; min: typeof min; max: typeof max; pow: typeof pow;
  log: typeof log; exp: typeof exp;
  pick: <T>(arr: T[]) => T;
  shuffle: <T>(arr: T[]) => T[];
  __colorAlpha__: typeof colorAlpha;
  __linearGradient__: (angle: number, stops: string[]) => CanvasGradient;
  __radialGradient__: (cx: number, cy: number, stops: string[]) => CanvasGradient;
  buffer: (w: number, h: number) => HTMLCanvasElement;
  vec: (x: number, y: number) => Vec;
  load: (url: string) => HTMLImageElement;
  loadFont: (family: string, url: string) => Promise<{ family: string }>;
  measure: (text: string, size?: number, family?: string) => { width: number; height: number };
}
