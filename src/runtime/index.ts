/**
 * GenArt Script runtime library.
 *
 * Exported as the `./runtime` entry point. Consumed by the renderer adapter
 * in `@genart-dev/core`. Not imported by the compiler itself.
 */

import { PRNG, defaultPRNG } from "./prng";
import { noise1, noise2, noise3, noiseSeed } from "./noise";
import { colorAlpha, linearGradient, radialGradient } from "./color";
import { PI, TWO_PI, HALF_PI, lerp, clamp, map, dist, sin, cos, tan, atan2, sqrt, abs, floor, ceil, round, min, max, pow, log, exp } from "./math";

export { PRNG, defaultPRNG };
export { noise1, noise2, noise3, noiseSeed };
export { PI, TWO_PI, HALF_PI, lerp, clamp, map, dist, sin, cos, tan, atan2, sqrt, abs, floor, ceil, round, min, max, pow, log, exp };
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
    lerp, clamp, map, dist,
    sin, cos, tan, atan2, sqrt, abs, floor, ceil, round, min, max, pow, log, exp,

    // Color helpers used by compiled code
    __colorAlpha__: colorAlpha,
    __linearGradient__: (angle: number, stops: string[]) => linearGradient(ctx, angle, stops),
    __radialGradient__: (cx: number, cy: number, stops: string[]) => radialGradient(ctx, cx, cy, stops),
  };
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
  sin: typeof sin; cos: typeof cos; tan: typeof tan; atan2: typeof atan2;
  sqrt: typeof sqrt; abs: typeof abs; floor: typeof floor; ceil: typeof ceil;
  round: typeof round; min: typeof min; max: typeof max; pow: typeof pow;
  log: typeof log; exp: typeof exp;
  __colorAlpha__: typeof colorAlpha;
  __linearGradient__: (angle: number, stops: string[]) => CanvasGradient;
  __radialGradient__: (cx: number, cy: number, stops: string[]) => CanvasGradient;
}
