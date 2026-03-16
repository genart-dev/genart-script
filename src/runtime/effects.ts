/**
 * Shared render-context ref — updated by `__post__` at call time so
 * effects can decide between full-quality pixel ops and fast approximations.
 * Scripts can also pass an explicit `quality` param to override.
 */
export interface RenderCtxRef { value: "static" | "animated"; }

/** Resolve effective quality: explicit param > renderContext ref > "auto". */
function resolveQuality(
  ref: RenderCtxRef,
  quality?: "auto" | "high" | "fast",
): "high" | "fast" {
  if (quality === "high") return "high";
  if (quality === "fast") return "fast";
  // "auto" or undefined → derive from render context
  return ref.value === "static" ? "high" : "fast";
}

/**
 * Post-processing effects injected as globals into compiled script scope.
 * All functions close over (ctx, w, h, renderCtx) captured at scope-build time.
 * Designed for use inside `post:` blocks but work anywhere in a script.
 */

export function makeEffects(ctx: CanvasRenderingContext2D, w: number, h: number, renderCtx: RenderCtxRef) {
  return {
    /**
     * vignette(strength = 0.5) — radial gradient overlay darkening the edges.
     */
    vignette(strength = 0.5): void {
      const r = Math.max(w, h) * 0.65;
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r);
      g.addColorStop(0, "transparent");
      g.addColorStop(1, `rgba(0,0,0,${strength})`);
      ctx.save();
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },

    /**
     * grain(amount = 0.15) — random noise dot overlay, amount 0-1.
     * Uses save/restore so composite stays source-over.
     */
    grain(amount = 0.15): void {
      const count = Math.floor(w * h * amount * 0.1);
      ctx.save();
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < count; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        const v = Math.random() > 0.5 ? 255 : 0;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.restore();
    },

    /**
     * grade(contrast?, saturation?, brightness?, hue?) — CSS filter adjustment.
     * Values: contrast/brightness/saturation as multipliers (1 = no change); hue in degrees.
     * Applied to a full-canvas copy via `ctx.filter` + drawImage trick.
     */
    grade(contrast = 1, saturation = 1, brightness = 1, hue = 0): void {
      const parts: string[] = [];
      if (contrast !== 1) parts.push(`contrast(${contrast})`);
      if (saturation !== 1) parts.push(`saturate(${saturation})`);
      if (brightness !== 1) parts.push(`brightness(${brightness})`);
      if (hue !== 0) parts.push(`hue-rotate(${hue}deg)`);
      if (!parts.length) return;
      // Draw canvas back onto itself through the filter
      const tmp = document.createElement("canvas");
      tmp.width = ctx.canvas.width; tmp.height = ctx.canvas.height;
      const tc = tmp.getContext("2d")!;
      tc.filter = parts.join(" ");
      tc.drawImage(ctx.canvas, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tmp, 0, 0);
    },

    /**
     * blur(radius) — Gaussian blur via CSS filter self-composite.
     */
    blur(radius: number): void {
      const tmp = document.createElement("canvas");
      tmp.width = ctx.canvas.width; tmp.height = ctx.canvas.height;
      const tc = tmp.getContext("2d")!;
      tc.filter = `blur(${radius}px)`;
      tc.drawImage(ctx.canvas, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tmp, 0, 0);
    },

    /**
     * scanlines(opacity = 0.15) — horizontal line pattern overlay.
     */
    scanlines(opacity = 0.15): void {
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = "black";
      for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
      ctx.restore();
    },

    /**
     * pixelate(blockSize) — large-pixel effect via scale-down/scale-up trick.
     */
    pixelate(blockSize: number): void {
      if (blockSize < 2) return;
      const dw = Math.ceil(w / blockSize);
      const dh = Math.ceil(h / blockSize);
      const tmp = document.createElement("canvas");
      tmp.width = dw; tmp.height = dh;
      const tc = tmp.getContext("2d")!;
      tc.imageSmoothingEnabled = false;
      tc.drawImage(ctx.canvas, 0, 0, dw, dh);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(tmp, 0, 0, w, h);
      ctx.restore();
    },

    /**
     * bloom(strength = 0.5, radius = 8) — glow effect via blur + screen blend.
     */
    bloom(strength = 0.5, radius = 8): void {
      const tmp = document.createElement("canvas");
      tmp.width = ctx.canvas.width; tmp.height = ctx.canvas.height;
      const tc = tmp.getContext("2d")!;
      tc.filter = `blur(${radius}px)`;
      tc.drawImage(ctx.canvas, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = strength;
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
    },

    /**
     * chromatic_aberration(amount = 3, quality?) — RGB channel offset.
     * Shifts R and B channels horizontally by ±amount pixels.
     * quality: "auto" (default) uses renderContext, "high" forces pixel ops,
     * "fast" uses a CSS-filter approximation.
     */
    chromatic_aberration(amount = 3, quality?: "auto" | "high" | "fast"): void {
      const q = resolveQuality(renderCtx, quality);
      if (q === "fast") {
        // Fast path: draw tinted copies with slight offset + blend
        const tmp = document.createElement("canvas");
        tmp.width = ctx.canvas.width; tmp.height = ctx.canvas.height;
        const tc = tmp.getContext("2d")!;
        tc.drawImage(ctx.canvas, 0, 0);
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.5;
        ctx.drawImage(tmp, amount, 0);
        ctx.drawImage(tmp, -amount, 0);
        ctx.restore();
        return;
      }
      // High-quality path: per-pixel RGB channel shift
      const cw = ctx.canvas.width;
      const ch = ctx.canvas.height;
      const imageData = ctx.getImageData(0, 0, cw, ch);
      const src = imageData.data;
      const out = new Uint8ClampedArray(src.length);
      const a = Math.round(amount * (ctx.getTransform().a || 1)); // scale by density
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const i = (y * cw + x) * 4;
          // Red channel: shift left
          const rx = Math.min(Math.max(x - a, 0), cw - 1);
          out[i] = src[(y * cw + rx) * 4]!;
          // Green channel: no shift
          out[i + 1] = src[i + 1]!;
          // Blue channel: shift right
          const bx = Math.min(Math.max(x + a, 0), cw - 1);
          out[i + 2] = src[(y * cw + bx) * 4 + 2]!;
          // Alpha: keep original
          out[i + 3] = src[i + 3]!;
        }
      }
      const result = new ImageData(out, cw, ch);
      ctx.putImageData(result, 0, 0);
    },

    /**
     * distort(type = "wave", amount = 10, quality?) — pixel displacement.
     * Types: "wave" (sinusoidal), "ripple" (radial), "noise" (random offset).
     * quality: "auto" (default), "high" forces pixel ops, "fast" skips.
     */
    distort(type: "wave" | "ripple" | "noise" = "wave", amount = 10, quality?: "auto" | "high" | "fast"): void {
      const q = resolveQuality(renderCtx, quality);
      if (q === "fast") return; // no fast approximation — just skip
      const cw = ctx.canvas.width;
      const ch = ctx.canvas.height;
      const imageData = ctx.getImageData(0, 0, cw, ch);
      const src = imageData.data;
      const out = new Uint8ClampedArray(src.length);
      const a = amount * (ctx.getTransform().a || 1); // scale by density
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          let sx = x, sy = y;
          if (type === "wave") {
            sx = x + Math.round(a * Math.sin(y * 0.05));
            sy = y + Math.round(a * Math.cos(x * 0.05));
          } else if (type === "ripple") {
            const cx2 = cw / 2, cy2 = ch / 2;
            const dx = x - cx2, dy = y - cy2;
            const d = Math.sqrt(dx * dx + dy * dy);
            const offset = Math.round(a * Math.sin(d * 0.05));
            sx = x + (dx === 0 ? 0 : Math.round(offset * dx / d));
            sy = y + (dy === 0 ? 0 : Math.round(offset * dy / d));
          } else {
            // noise — deterministic-ish displacement from pixel coords
            sx = x + Math.round(a * (Math.sin(x * 127.1 + y * 311.7) * 0.5));
            sy = y + Math.round(a * (Math.sin(x * 269.5 + y * 183.3) * 0.5));
          }
          sx = Math.min(Math.max(sx, 0), cw - 1);
          sy = Math.min(Math.max(sy, 0), ch - 1);
          const si = (sy * cw + sx) * 4;
          const di = (y * cw + x) * 4;
          out[di] = src[si]!;
          out[di + 1] = src[si + 1]!;
          out[di + 2] = src[si + 2]!;
          out[di + 3] = src[si + 3]!;
        }
      }
      const result = new ImageData(out, cw, ch);
      ctx.putImageData(result, 0, 0);
    },

    /**
     * dither(strength = 0.5) — ordered dithering (Bayer 4×4 matrix).
     * Adds a retro, print-like quality to gradients.
     */
    dither(strength = 0.5): void {
      const cw = ctx.canvas.width;
      const ch = ctx.canvas.height;
      const imageData = ctx.getImageData(0, 0, cw, ch);
      const data = imageData.data;
      const bayer = [
        0, 8, 2, 10,
        12, 4, 14, 6,
        3, 11, 1, 9,
        15, 7, 13, 5,
      ];
      const s = strength * 32;
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const i = (y * cw + x) * 4;
          const threshold = (bayer[(y % 4) * 4 + (x % 4)]! / 16 - 0.5) * s;
          data[i] = Math.min(255, Math.max(0, data[i]! + threshold));
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1]! + threshold));
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2]! + threshold));
        }
      }
      ctx.putImageData(imageData, 0, 0);
    },

    /**
     * halftone(dotSize = 4, angle = 0.3) — CMYK halftone dot screen effect.
     */
    halftone(dotSize = 4, angle = 0.3): void {
      const cw = ctx.canvas.width;
      const ch = ctx.canvas.height;
      const imageData = ctx.getImageData(0, 0, cw, ch);
      const src = imageData.data;
      const ds = Math.max(2, Math.round(dotSize * (ctx.getTransform().a || 1)));
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, w, h);
      const cosA = Math.cos(angle), sinA = Math.sin(angle);
      for (let y = 0; y < ch; y += ds) {
        for (let x = 0; x < cw; x += ds) {
          // Sample center pixel
          const cx2 = Math.min(x + Math.floor(ds / 2), cw - 1);
          const cy2 = Math.min(y + Math.floor(ds / 2), ch - 1);
          const si = (cy2 * cw + cx2) * 4;
          const lum = (src[si]! * 0.299 + src[si + 1]! * 0.587 + src[si + 2]! * 0.114) / 255;
          const r = (1 - lum) * ds * 0.5;
          if (r < 0.5) continue;
          // Rotate dot position
          const px = (x + ds / 2) / (ctx.getTransform().a || 1);
          const py = (y + ds / 2) / (ctx.getTransform().d || 1);
          const rx = px * cosA - py * sinA + w / 2 * (1 - cosA) + h / 2 * sinA;
          const ry = px * sinA + py * cosA + h / 2 * (1 - cosA) - w / 2 * sinA;
          ctx.beginPath();
          ctx.arc(rx, ry, r / (ctx.getTransform().a || 1), 0, Math.PI * 2);
          ctx.fillStyle = `rgb(${src[si]},${src[si + 1]},${src[si + 2]})`;
          ctx.fill();
        }
      }
      ctx.restore();
    },
  };
}
