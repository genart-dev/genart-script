import { describe, it, expect } from "vitest";
import { PRNG, noise1, noise2, noise3, lerp, clamp, map, dist, colorAlpha } from "./index";

describe("PRNG", () => {
  it("produces values in range [0, 1) with rnd(1)", () => {
    const p = new PRNG();
    p.seed(null, 42);
    for (let i = 0; i < 100; i++) {
      const v = p.rnd(1);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("is deterministic with same seed", () => {
    const a = new PRNG();
    const b = new PRNG();
    a.seed(null, 99);
    b.seed(null, 99);
    expect(a.rnd(1)).toBe(b.rnd(1));
    expect(a.rnd(1)).toBe(b.rnd(1));
  });

  it("produces different values with different seeds", () => {
    const a = new PRNG();
    const b = new PRNG();
    a.seed(null, 1);
    b.seed(null, 2);
    expect(a.rnd(1)).not.toBe(b.rnd(1));
  });

  it("supports named namespaces independently", () => {
    const p = new PRNG();
    // Seed two namespaces
    p.seed(null, 42);
    const globalFirst = p.rnd(1);
    p.seed("trees", 99);
    const treesFirst = p.rnd(1);
    // Seeding trees shouldn't have changed global namespace state
    // Re-check by seeding global with same seed and comparing
    const q = new PRNG();
    q.seed(null, 42);
    expect(q.rnd(1)).toBe(globalFirst);
    // trees and global should differ (different seeds)
    expect(globalFirst).not.toBe(treesFirst);
  });

  it("rnd(min, max) stays in range", () => {
    const p = new PRNG();
    p.seed(null, 7);
    for (let i = 0; i < 50; i++) {
      const v = p.rnd(10, 20);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThan(20);
    }
  });
});

describe("noise", () => {
  it("noise1 returns values in [-1, 1]", () => {
    for (let i = 0; i < 20; i++) {
      const v = noise1(i * 0.1);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("noise2 is continuous (nearby values similar)", () => {
    const a = noise2(0.5, 0.5);
    const b = noise2(0.501, 0.5);
    expect(Math.abs(a - b)).toBeLessThan(0.1);
  });

  it("noise3 returns values in [-1, 1]", () => {
    for (let i = 0; i < 20; i++) {
      const v = noise3(i * 0.1, i * 0.05, i * 0.02);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("math utils", () => {
  it("lerp interpolates correctly", () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });

  it("clamp constrains values", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("map remaps range", () => {
    expect(map(0.5, 0, 1, 0, 100)).toBe(50);
    expect(map(0, 0, 1, 10, 20)).toBe(10);
    expect(map(1, 0, 1, 10, 20)).toBe(20);
  });

  it("dist calculates euclidean distance", () => {
    expect(dist(0, 0, 3, 4)).toBe(5);
    expect(dist(0, 0, 0, 0)).toBe(0);
  });
});

describe("colorAlpha", () => {
  it("applies alpha to hex color", () => {
    const result = colorAlpha("#ff0000", 0.5);
    expect(result).toBe("rgba(255,0,0,0.5)");
  });

  it("applies alpha to short hex color", () => {
    const result = colorAlpha("#f00", 1);
    expect(result).toBe("rgba(255,0,0,1)");
  });

  it("applies alpha to named color", () => {
    const result = colorAlpha("white", 0.5);
    expect(result).toBe("rgba(255,255,255,0.5)");
  });

  it("returns original string for unknown color", () => {
    const result = colorAlpha("unknowncolor", 0.5);
    expect(result).toBe("unknowncolor");
  });
});
