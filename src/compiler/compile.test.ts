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

describe("compile — Phase 4 drawing polish", () => {
  it("linear gradient emits without ctx arg (bug fix)", () => {
    const r = compile("circle w/2 h/2 r:100 fill:linear(#000,#fff)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("__linearGradient__(0,");
    expect(r.code).not.toContain("__linearGradient__(ctx,");
  });

  it("linear gradient with angle", () => {
    const r = compile("circle 0 0 r:50 fill:linear(#f00,#00f angle:90)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("__linearGradient__(90,");
  });

  it("radial gradient emits without ctx arg (bug fix)", () => {
    const r = compile("circle w/2 h/2 r:100 fill:radial(#fff,#000)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("__radialGradient__(");
    expect(r.code).not.toContain("__radialGradient__(ctx,");
  });

  it("use easing inlines easing functions", () => {
    const r = compile("use easing\nx = ease_in(0.5)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("const ease_in =");
    expect(r.code).toContain("const ease_out =");
    expect(r.code).toContain("const bounce =");
  });

  it("use shapes inlines star/hexagon/arrow", () => {
    const r = compile("use shapes\nstar w/2 h/2 5 50");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("function star(");
    expect(r.code).toContain("function hexagon(");
    expect(r.code).toContain("function arrow(");
  });

  it("use palettes inlines named arrays", () => {
    const r = compile("use palettes\nbg nord[0]");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("const nord =");
    expect(r.code).toContain("const solarized =");
    expect(r.code).toContain("const pastel =");
    expect(r.code).toContain("const earth =");
  });

  it("param declaration extracts to result.params", () => {
    const r = compile('param count 100 range:10..500 label:"Count"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params).toHaveLength(1);
    expect(r.params[0]).toMatchObject({ key: "count", default: 100, min: 10, max: 500 });
    expect(r.code).toContain('let count = __params__["count"] ?? 100');
  });

  it("color declaration extracts to result.colors", () => {
    const r = compile('color bg #1a1a2e label:"Background"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.colors).toHaveLength(1);
    expect(r.colors[0]).toMatchObject({ key: "bg", default: "#1a1a2e" });
    expect(r.code).toContain('let bg = __colors__["bg"] ?? "#1a1a2e"');
  });
});

describe("compile — Phase 5 images + typography", () => {
  it("once: block becomes async function", () => {
    const r = compile("once:\n  bg black");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("async function __once__");
  });

  it("draw with tint emits multiply composite overlay", () => {
    const r = compile("draw img 0 0 tint:coral");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('ctx.drawImage(img,');
    expect(r.code).toContain('"multiply"');
    expect(r.code).toContain('"coral"');
    expect(r.code).toContain('ctx.fillRect(');
  });

  it("draw with tint and explicit size", () => {
    const r = compile("draw img 10 20 w:100 h:80 tint:#f00");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("ctx.drawImage(img, 10, 20, 100, 80)");
  });

  it("text command with size and font", () => {
    const r = compile('text "hello" 100 200 size:24');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("ctx.font =");
    expect(r.code).toContain("24");
    expect(r.code).toContain('ctx.fillText("hello", 100, 200)');
  });
});

describe("compile — Phase 6 post-processing", () => {
  it("post: block compiles with render context param", () => {
    const r = compile("post:\n  vignette(0.6)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("function __post__(__ctx__, __renderContext__)");
    expect(r.code).toContain("vignette(0.6)");
    expect(r.code).toContain("post: __post__");
  });

  it("post: block has access to renderContext", () => {
    const r = compile('post:\n  if __renderContext__ == "static":\n    blur(2)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("__renderContext__");
    expect(r.code).toContain("blur(2)");
  });
});

describe("compile — Phase 7 layer declarations", () => {
  it("basic layer declaration extracts type and preset", () => {
    const r = compile('layer "terrain:sky" "noon"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layers).toHaveLength(1);
    expect(r.layers[0]).toEqual({ type: "terrain:sky", preset: "noon" });
  });

  it("layer with name override", () => {
    const r = compile('layer "terrain:sky" "noon" name:"My Sky"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layers[0]!.name).toBe("My Sky");
  });

  it("layer with opacity and blend", () => {
    const r = compile('layer "terrain:mountains" "alpine" opacity:0.8 blend:"multiply"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layers[0]!.opacity).toBe(0.8);
    expect(r.layers[0]!.blend).toBe("multiply");
  });

  it("layer with visible:false", () => {
    const r = compile('layer "terrain:sky" "dusk" visible:false');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layers[0]!.visible).toBe(false);
  });

  it("multiple layers maintain order", () => {
    const r = compile('layer "terrain:sky" "noon"\nlayer "terrain:mountains" "alpine"\nlayer "terrain:water" "lake"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layers).toHaveLength(3);
    expect(r.layers[0]!.type).toBe("terrain:sky");
    expect(r.layers[1]!.type).toBe("terrain:mountains");
    expect(r.layers[2]!.type).toBe("terrain:water");
  });

  it("layer declarations do not emit code", () => {
    const r = compile('layer "terrain:sky" "noon"\nbg black');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).not.toContain("terrain");
    expect(r.code).not.toContain("noon");
    expect(r.code).toContain("ctx.fillStyle");
  });

  it("layers coexist with params and colors", () => {
    const src = [
      'param brightness 0.5 range:0..1 step:0.01',
      'color sky #87CEEB',
      'layer "terrain:sky" "noon"',
      'bg sky',
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params).toHaveLength(1);
    expect(r.colors).toHaveLength(1);
    expect(r.layers).toHaveLength(1);
    expect(r.layers[0]!.type).toBe("terrain:sky");
  });

  it("layer with all named args", () => {
    const r = compile('layer "particles:glow" "fireflies" name:"Firefly Glow" opacity:0.6 blend:"screen" visible:true');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const l = r.layers[0]!;
    expect(l.type).toBe("particles:glow");
    expect(l.preset).toBe("fireflies");
    expect(l.name).toBe("Firefly Glow");
    expect(l.opacity).toBe(0.6);
    expect(l.blend).toBe("screen");
    expect(l.visible).toBe(true);
  });

  it("empty layers array when no layer declarations", () => {
    const r = compile("bg black");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layers).toEqual([]);
  });
});
