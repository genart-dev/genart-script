import { describe, it, expect } from "vitest";
import { compile } from "../index";

// Phase 2: control flow + data

describe("compile — loop", () => {
  it("loop N: emits for loop with i", () => {
    const r = compile("loop 10:\n  circle i 0 r:5 fill:red");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("for (let i = 0; i < 10; i++)");
    expect(r.code).toContain("ctx.arc(i,");
  });

  it("loop N => emits array collection", () => {
    const r = compile("loop 5 =>\n  i * 2");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("Array.from({ length: 5 }");
    expect(r.code).toContain("(i * 2)");
  });

  it("loop with expression count", () => {
    const r = compile("n = 20\nloop n:\n  dot i 0 fill:blue");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("for (let i = 0; i < n; i++)");
  });
});

describe("compile — for-in", () => {
  it("for v in arr:", () => {
    const r = compile("arr = [1, 2, 3]\nfor v in arr:\n  circle v 0 r:5 fill:red");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("for (const v of arr)");
  });

  it("for i, v in arr: (indexed)", () => {
    const r = compile("arr = [10, 20, 30]\nfor i, v in arr:\n  circle v i r:3 fill:blue");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("for (const v of arr)");
    expect(r.code).toContain("const i =");
  });

  it("for x in range: (0..N)", () => {
    const r = compile("for x in 0..100:\n  dot x 50 fill:white");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("for (let x = 0; x < 100; x += 1)");
  });

  it("for x in range with step:", () => {
    const r = compile("for x in 0..400 step:20:\n  dot x 50 fill:white");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("for (let x = 0; x < 400; x += 20)");
  });
});

describe("compile — if / else", () => {
  it("if cond: block", () => {
    const r = compile("x = 5\nif x > 3:\n  circle 0 0 r:10 fill:red");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("if ((x > 3))");
    expect(r.code).toContain("ctx.arc(");
  });

  it("if / else:", () => {
    const r = compile("x = 1\nif x > 0:\n  circle 0 0 r:5 fill:red\nelse:\n  circle 0 0 r:5 fill:blue");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("if ((x > 0))");
    expect(r.code).toContain("} else {");
  });

  it("if with &&", () => {
    const r = compile("if x > 0 && y < 10:\n  dot 0 0 fill:red");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("&&");
  });
});

describe("compile — fn / return", () => {
  it("fn with no params", () => {
    const r = compile("fn draw:\n  circle 0 0 r:5 fill:red");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("function draw()");
  });

  it("fn with params", () => {
    const r = compile("fn lerp2 a b t:\n  return a + (b - a) * t");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("function lerp2(a, b, t)");
    expect(r.code).toContain("return (a + ((b - a) * t))");
  });

  it("fn call as expression", () => {
    const r = compile("fn sq x:\n  return x * x\ny = sq(5)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("function sq(x)");
    expect(r.code).toContain("sq(5)");
  });

  it("return with no value", () => {
    const r = compile("fn noop:\n  return");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("return;");
  });
});

describe("compile — lambda", () => {
  it("explicit lambda (x) => expr", () => {
    const r = compile("arr = [1, 2, 3]\ndoubled = arr.map((x) => x * 2)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("arr.map((x) => (x * 2))");
  });

  it("explicit multi-param lambda (x, y) => expr", () => {
    const r = compile("f = (x, y) => x + y");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("(x, y) => (x + y)");
  });

  it("implicit `it` lambda in map", () => {
    const r = compile("arr = [1, 2, 3]\ndoubled = arr.map(it * 2)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("arr.map((it) => (it * 2))");
  });

  it("implicit `it` lambda in filter", () => {
    const r = compile("big = arr.filter(it > 10)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("arr.filter((it) => (it > 10))");
  });

  it("implicit `it` lambda does not double-wrap explicit lambda", () => {
    const r = compile("arr.map((x) => x * 2)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // should NOT wrap in (it) =>
    expect(r.code).not.toContain("(it) =>");
    expect(r.code).toContain("(x) => (x * 2)");
  });
});

describe("compile — .each → .forEach", () => {
  it("arr.each(fn) compiles to arr.forEach(fn)", () => {
    const r = compile("pts.each((x) => x * 2)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain(".forEach(");
    expect(r.code).not.toContain(".each(");
  });

  it("arr.each with implicit it", () => {
    const r = compile("pts.each(it * 2)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain(".forEach(");
    expect(r.code).not.toContain(".each(");
  });
});

describe("compile — arrays", () => {
  it("array literal", () => {
    const r = compile("colors = [red, blue, green]");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('["red", "blue", "green"]');
  });

  it("array with numbers", () => {
    const r = compile("pts = [0, 10, 20, 30]");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("[0, 10, 20, 30]");
  });

  it("array .map", () => {
    const r = compile("doubled = pts.map(it * 2)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain(".map(");
  });

  it("array .filter", () => {
    const r = compile("big = pts.filter(it > 10)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain(".filter(");
  });

  it("array .push as expr-stmt", () => {
    const r = compile("arr.push(42)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("arr.push(42)");
  });

  it("array index access", () => {
    const r = compile("x = arr.0");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("arr[0]");
  });

  it("array .length property", () => {
    const r = compile("n = arr.length");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("arr.length");
  });
});

describe("compile — print", () => {
  it("print single value", () => {
    const r = compile("print x");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("console.log(x)");
  });

  it("print multiple values", () => {
    const r = compile("print x y z");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("console.log(x, y, z)");
  });

  it("print string literal", () => {
    const r = compile('print "hello"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('console.log("hello")');
  });
});

describe("compile — composed programs", () => {
  it("animated scatter plot with loop", () => {
    const src = [
      "param count 50 range:10..200",
      "color bg #111111",
      "once:",
      "  bg bg",
      "frame:",
      "  loop count:",
      "    x = rnd(w)",
      "    y = rnd(h)",
      "    circle x y r:3 fill:white.50",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params[0]).toMatchObject({ key: "count", min: 10, max: 200 });
    expect(r.code).toContain("function __frame__");
    expect(r.code).toContain("for (let i = 0; i < count; i++)");
    expect(r.code).toContain("__colorAlpha__");
  });

  it("for-in with fn transform", () => {
    const src = [
      "fn scale v:",
      "  return v * 2",
      "pts = [10, 20, 30]",
      "for p in pts:",
      "  circle scale(p) 100 r:5 fill:coral",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("function scale(v)");
    expect(r.code).toContain("for (const p of pts)");
    expect(r.code).toContain("scale(p)");
  });
});

describe("runtime — range", () => {
  it("range(n) produces [0..n-1]", async () => {
    const { range } = await import("../runtime/index");
    expect(range(5)).toEqual([0, 1, 2, 3, 4]);
    expect(range(0)).toEqual([]);
  });

  it("range(start, end)", async () => {
    const { range } = await import("../runtime/index");
    expect(range(3, 7)).toEqual([3, 4, 5, 6]);
  });

  it("range(start, end, step)", async () => {
    const { range } = await import("../runtime/index");
    expect(range(0, 10, 2)).toEqual([0, 2, 4, 6, 8]);
    expect(range(0, 100, 25)).toEqual([0, 25, 50, 75]);
  });
});
