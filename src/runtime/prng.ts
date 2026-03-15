/**
 * Seeded pseudo-random number generator using mulberry32.
 * Supports named namespaces for independent streams.
 */
export class PRNG {
  private seeds = new Map<string | null, number>();
  private current: string | null = null;

  seed(ns: string | null, value: number): void {
    this.seeds.set(ns, value >>> 0);
    this.current = ns;
  }

  private getState(ns: string | null): number {
    return this.seeds.get(ns) ?? 0xdeadbeef;
  }

  private setState(ns: string | null, s: number): void {
    this.seeds.set(ns, s);
  }

  private nextFloat(ns: string | null): number {
    let s = this.getState(ns);
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    this.setState(ns, s);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** `rnd(max)` → [0, max) | `rnd(min, max)` → [min, max) */
  rnd(a: number, b?: number): number {
    const ns = this.current;
    const r = this.nextFloat(ns);
    return b === undefined ? r * a : a + r * (b - a);
  }

  /** `rndInt(max)` → [0, max) integer */
  rndInt(a: number, b?: number): number {
    return Math.floor(this.rnd(a, b));
  }
}

export const defaultPRNG = new PRNG();
defaultPRNG.seed(null, 42);
