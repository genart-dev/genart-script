/**
 * Inlineable standard library fragments for `use easing|shapes|palettes`.
 * These strings are injected verbatim at the top of compiled output.
 * Functions reference `ctx` from the compiled scope — valid since they're
 * top-level declarations inside the new Function(...) wrapper.
 */

export const EASING_LIB = `\
const ease_in = (t) => t * t;
const ease_out = (t) => 1 - (1 - t) * (1 - t);
const ease_in_out = (t) => t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
const ease_cubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const elastic = (t) => t === 0 ? 0 : t === 1 ? 1 :
  -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * (2 * Math.PI / 3));
const bounce = (t) => {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
  if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
  t -= 2.625 / 2.75; return 7.5625 * t * t + 0.984375;
};`;

export const SHAPES_LIB = `\
function star(x, y, n, r, ir) {
  ir = ir ?? r / 2;
  ctx.beginPath();
  for (let __i = 0; __i < n * 2; __i++) {
    const __a = (__i * Math.PI / n) - Math.PI / 2;
    const __r = __i % 2 === 0 ? r : ir;
    if (__i === 0) ctx.moveTo(x + Math.cos(__a) * __r, y + Math.sin(__a) * __r);
    else ctx.lineTo(x + Math.cos(__a) * __r, y + Math.sin(__a) * __r);
  }
  ctx.closePath(); ctx.fill();
}
function hexagon(x, y, r) {
  ctx.beginPath();
  for (let __i = 0; __i < 6; __i++) {
    const __a = (__i * Math.PI / 3) - Math.PI / 6;
    if (__i === 0) ctx.moveTo(x + Math.cos(__a) * r, y + Math.sin(__a) * r);
    else ctx.lineTo(x + Math.cos(__a) * r, y + Math.sin(__a) * r);
  }
  ctx.closePath(); ctx.fill();
}
function arrow(x, y, angle, size) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.5, -size * 0.35);
  ctx.lineTo(-size * 0.5, size * 0.35);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}`;

/**
 * Convenience helpers auto-injected when `library "p5.brush"` is declared.
 * Requires p5.brush v2.x loaded as a global — call from within draw().
 * Coordinate offsets (ox, oy) must be set by the sketch: ox = -width/2, oy = -height/2.
 */
export const P5_BRUSH_LIB = `\
// p5.brush helpers (auto-injected by GenArt Script)
function brushStroke(x1, y1, x2, y2, type, weight, clr) {
  brush.set(type ?? "marker", weight ?? 1, clr ?? "#000");
  brush.line(x1, y1, x2, y2);
}
function watercolorFill(alpha) {
  brush.fill("watercolor", alpha ?? 80);
}
function hatchRegion(x, y, w, h, type, weight, clr) {
  brush.set(type ?? "hatch", weight ?? 1, clr ?? "#000");
  brush.rect(x, y, w, h);
}`;

export const PALETTES_LIB = `\
const nord = ["#2e3440","#3b4252","#434c5e","#4c566a","#d8dee9","#e5e9f0","#eceff4","#8fbcbb","#88c0d0","#81a1c1","#5e81ac","#bf616a","#d08770","#ebcb8b","#a3be8c","#b48ead"];
const solarized = ["#002b36","#073642","#586e75","#657b83","#839496","#93a1a1","#fdf6e3","#b58900","#cb4b16","#dc322f","#d33682","#6c71c4","#268bd2","#2aa198","#859900","#eee8d5"];
const pastel = ["#ffb3ba","#ffdfba","#ffffba","#baffc9","#bae1ff","#e8baff","#ffd9ba","#c9ffba","#baffe8","#d9baff","#ffbae8","#bac9ff"];
const earth = ["#3d2b1f","#5c3d2e","#7d5a3c","#a0724a","#c4935a","#d4a96a","#e8c48c","#f0d9a8","#c8b88a","#9a8060","#6b5a42","#4a3f30"];`;
