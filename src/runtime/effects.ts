/**
 * Post-processing effects injected as globals into compiled script scope.
 * All functions close over (ctx, w, h) captured at scope-build time.
 * Designed for use inside `post:` blocks but work anywhere in a script.
 */

export function makeEffects(ctx: CanvasRenderingContext2D, w: number, h: number) {
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
  };
}
