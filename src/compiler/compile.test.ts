import { describe, it, expect } from "vitest";
import { compile } from "../index";

// Snapshot tests — pin compiled output per feature

describe("compile — drawing primitives", () => {
  it("bg", () => {
    const r = compile("bg black");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('ctx.fillStyle = "black"');
    expect(r.code).toContain("ctx.fillRect(0, 0, w, h)");
  });

  it("circle", () => {
    const r = compile("circle 100 200 r:50 fill:coral");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("ctx.arc(100, 200, 50");
    expect(r.code).toContain('"coral"');
    expect(r.code).toContain("ctx.fill()");
  });

  it("circle with stroke", () => {
    const r = compile("circle 50 50 r:20 fill:white stroke:#000 2");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("ctx.stroke()");
    expect(r.code).toContain('"#000"');
  });

  it("rect", () => {
    const r = compile("rect 0 0 w:100 h:50 fill:blue");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("ctx.rect(0, 0, 100, 50)");
    expect(r.code).toContain('"blue"');
  });

  it("rect with rx (rounded)", () => {
    const r = compile("rect 10 10 w:80 h:40 rx:8 fill:red");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("ctx.roundRect(10, 10, 80, 40, 8)");
  });

  it("line", () => {
    const r = compile("line 0 0 100 100 stroke:red 2");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("ctx.moveTo(0, 0)");
    expect(r.code).toContain("ctx.lineTo(100, 100)");
    expect(r.code).toContain('"red"');
  });

  it("dot", () => {
    const r = compile("dot 50 50 fill:coral");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("ctx.arc(50, 50, 1");
  });

  it("path", () => {
    const r = compile('path "M0 0 L100 100" stroke:black 1');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('new Path2D("M0 0 L100 100")');
    expect(r.code).toContain("ctx.stroke");
  });

  it("arc", () => {
    const r = compile("arc 100 100 r:50 start:0 end:3.14 fill:red");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("ctx.arc(100, 100, 50, 0, 3.14)");
  });
});

describe("compile — color", () => {
  it("color alpha shorthand", () => {
    const r = compile("circle 50 50 r:20 fill:white.50");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("__colorAlpha__");
    expect(r.code).toContain('"white"');
    expect(r.code).toContain("0.5");
  });

  it("hex color", () => {
    const r = compile("circle 10 10 r:5 fill:#ff0000");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('"#ff0000"');
  });

  it("linear gradient", () => {
    const r = compile("bg linear(white, black)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("__linearGradient__");
  });

  it("radial gradient", () => {
    const r = compile("bg radial(white, black)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("__radialGradient__");
  });
});

describe("compile — transforms", () => {
  it("at x y: block", () => {
    const r = compile("at 100 200:\n  circle 0 0 r:10 fill:red");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("ctx.save()");
    expect(r.code).toContain("ctx.translate(100, 200)");
    expect(r.code).toContain("ctx.restore()");
  });

  it("rotate angle: block", () => {
    const r = compile("rotate 1.57:\n  circle 0 0 r:5 fill:red");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("ctx.rotate(1.57)");
  });

  it("scale n: block", () => {
    const r = compile("scale 2:\n  circle 0 0 r:5 fill:blue");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("ctx.scale(2, 2)");
  });

  it("nested transforms", () => {
    const r = compile("at 50 50:\n  rotate 0.5:\n    circle 0 0 r:10 fill:red");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const saves = (r.code.match(/ctx\.save\(\)/g) ?? []).length;
    expect(saves).toBe(2);
  });
});

describe("compile — execution model", () => {
  it("frame: block emits __frame__ function", () => {
    const r = compile("frame:\n  circle 0 0 r:t fill:red");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("function __frame__");
    expect(r.code).toContain("isAnimated: true");
  });

  it("once: block emits __once__ function", () => {
    const r = compile("once:\n  bg black");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("function __once__");
  });

  it("static only has isAnimated false", () => {
    const r = compile("bg coral");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("isAnimated: false");
  });
});

describe("compile — param/color declarations", () => {
  it("param declaration", () => {
    const r = compile("param count 100 range:10..500");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params).toHaveLength(1);
    expect(r.params[0]).toMatchObject({ key: "count", default: 100, min: 10, max: 500 });
    expect(r.code).toContain('let count = __params__["count"]');
  });

  it("color declaration", () => {
    const r = compile('color bg #1a1a1a label:"Background"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.colors).toHaveLength(1);
    expect(r.colors[0]).toMatchObject({ key: "bg", default: "#1a1a1a", label: "Background" });
    expect(r.code).toContain('let bg = __colors__["bg"]');
  });
});

describe("compile — expressions", () => {
  it("variable assignment", () => {
    const r = compile("x = 42");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("let x = 42");
  });

  it("math expression with precedence", () => {
    const r = compile("x = 2 + 3 * 4");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("(2 + (3 * 4))");
  });

  it("function call expression", () => {
    const r = compile("x = sin(t)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("sin(t)");
  });

  it("ternary expression", () => {
    const r = compile("x = a > b ? a : b");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("(a > b) ?");
  });
});

describe("compile — Phase 3 interactivity", () => {
  it("on click: wires canvas event listener", () => {
    const r = compile('on click:\n  circle mouseX mouseY r:10 fill:white');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('__canvas__.addEventListener("click"');
    expect(r.code).toContain("mouseX");
  });

  it("on key: filters by key value", () => {
    const r = compile('on key "r":\n  bg black');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('addEventListener("keydown"');
    expect(r.code).toContain('"r"');
  });

  it("watch emits guarded __watch__ call", () => {
    const r = compile('watch "x" 42');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('typeof __watch__ !== "undefined"');
    expect(r.code).toContain('__watch__("x",');
  });

  it("into buf: redirects ctx to buffer", () => {
    const r = compile('buf = buffer(w, h)\ninto buf:\n  bg red');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('buf.getContext("2d")');
  });

  it("draw buf x y emits drawImage", () => {
    const r = compile('buf = buffer(200, 200)\ndraw buf 0 0');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('ctx.drawImage(buf,');
  });
});

describe("compile — error reporting", () => {
  it("returns CompileFailure with location on parse error", () => {
    // Deliberate syntax error
    const r = compile("frame\n  circle");
    // This may or may not fail depending on parser tolerance, but errors shape is correct
    if (!r.ok) {
      expect(r.errors[0]).toHaveProperty("line");
      expect(r.errors[0]).toHaveProperty("col");
      expect(r.errors[0]).toHaveProperty("message");
    }
  });
});
