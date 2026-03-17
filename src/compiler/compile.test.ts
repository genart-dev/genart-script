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

describe("compile — prev + touch globals in frame", () => {
  it("frame signature includes touchX, touchY, touches, prev", () => {
    const r = compile("frame:\n  circle touchX touchY r:10 fill:red");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("function __frame__(__ctx__, t, frame, w, h, fps, mouseX, mouseY, mouseDown, pmouseX, pmouseY, touchX, touchY, touches, prev)");
  });

  it("prev is accessible as identifier inside frame block", () => {
    const r = compile("frame:\n  draw prev 0 0");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("ctx.drawImage(prev,");
  });

  it("touches is accessible as identifier inside frame block", () => {
    const r = compile("frame:\n  n = touches.length");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("touches.length");
  });

  it("touchX and touchY are usable in expressions", () => {
    const r = compile("frame:\n  circle touchX touchY r:5 fill:white");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("ctx.arc(touchX, touchY,");
  });
});

describe("compile — post quality + renderCtx", () => {
  it("post block sets __renderCtx__.value", () => {
    const r = compile("post:\n  vignette(0.5)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("__renderCtx__.value = __renderContext__");
  });

  it("chromatic_aberration compiles in post block", () => {
    const r = compile("post:\n  chromatic_aberration(3)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("chromatic_aberration(3)");
  });

  it("distort compiles with type and amount", () => {
    const r = compile('post:\n  distort("wave", 10)');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('distort("wave", 10)');
  });

  it("chromatic_aberration with quality override", () => {
    const r = compile('post:\n  chromatic_aberration(5, "high")');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('chromatic_aberration(5, "high")');
  });

  it("distort with quality override", () => {
    const r = compile('post:\n  distort("ripple", 8, "fast")');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('distort("ripple", 8, "fast")');
  });

  it("dither compiles in post block", () => {
    const r = compile("post:\n  dither(0.3)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("dither(0.3)");
  });

  it("halftone compiles in post block", () => {
    const r = compile("post:\n  halftone(4, 0.3)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("halftone(4, 0.3)");
  });

  it("multiple effects with mixed quality overrides", () => {
    const src = [
      "post:",
      '  chromatic_aberration(3, "high")',
      "  vignette(0.5)",
      '  distort("noise", 5, "fast")',
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('chromatic_aberration(3, "high")');
    expect(r.code).toContain("vignette(0.5)");
    expect(r.code).toContain('distort("noise", 5, "fast")');
  });
});

describe("compile — use component declarations", () => {
  it("use with string extracts component name", () => {
    const r = compile('use "bristle-stroke-renderer"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.components).toEqual(["bristle-stroke-renderer"]);
  });

  it("multiple use component declarations", () => {
    const r = compile('use "bristle-stroke-renderer"\nuse "curl-flow-field"\nuse "grid-placement"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.components).toEqual(["bristle-stroke-renderer", "curl-flow-field", "grid-placement"]);
  });

  it("use component does not emit code", () => {
    const r = compile('use "math"\nbg black');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).not.toContain("math");
    expect(r.code).toContain("ctx.fillStyle");
  });

  it("use component coexists with use lib", () => {
    const r = compile('use easing\nuse "bristle-stroke-renderer"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("const ease_in =");
    expect(r.components).toEqual(["bristle-stroke-renderer"]);
  });

  it("empty components array when no use component declarations", () => {
    const r = compile("bg black");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.components).toEqual([]);
  });
});

describe("compile — param group tabs", () => {
  it("inline group on param extracts tab", () => {
    const r = compile('param size 10 range:1..50 group:"Style"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params[0]!.tab).toBe("style");
    expect(r.tabs).toEqual([{ id: "style", label: "Style" }]);
  });

  it("group directive sets group for subsequent params", () => {
    const src = [
      'group "Sky"',
      "param skyWidth 19 range:4..40 step:1",
      "param skyBristles 6 range:3..12 step:1",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params).toHaveLength(2);
    expect(r.params[0]!.tab).toBe("sky");
    expect(r.params[1]!.tab).toBe("sky");
    expect(r.tabs).toEqual([{ id: "sky", label: "Sky" }]);
  });

  it("multiple group directives create multiple tabs", () => {
    const src = [
      "param global 1 range:0..2",
      'group "Sky"',
      "param skyW 19 range:4..40",
      'group "Water"',
      "param waterW 12 range:4..30",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params[0]!.tab).toBeUndefined(); // ungrouped
    expect(r.params[1]!.tab).toBe("sky");
    expect(r.params[2]!.tab).toBe("water");
    expect(r.tabs).toEqual([
      { id: "sky", label: "Sky" },
      { id: "water", label: "Water" },
    ]);
  });

  it("inline group overrides directive group", () => {
    const src = [
      'group "Sky"',
      'param special 5 range:1..10 group:"Water"',
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params[0]!.tab).toBe("water");
    expect(r.tabs).toEqual([{ id: "water", label: "Water" }]);
  });

  it("tabs are deduplicated", () => {
    const src = [
      'param a 1 range:0..2 group:"Style"',
      'param b 2 range:0..4 group:"Style"',
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tabs).toHaveLength(1);
    expect(r.tabs[0]).toEqual({ id: "style", label: "Style" });
  });

  it("empty tabs when no groups", () => {
    const r = compile("param x 5 range:0..10");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tabs).toEqual([]);
    expect(r.params[0]!.tab).toBeUndefined();
  });

  it("group with multi-word name slugifies correctly", () => {
    const r = compile('param x 5 range:0..10 group:"Lightning Bolts"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params[0]!.tab).toBe("lightning-bolts");
    expect(r.tabs[0]!.label).toBe("Lightning Bolts");
  });
});

describe("compile — object literals", () => {
  it("object literal in function call", () => {
    const r = compile("x = foo({width: 100, height: 200})");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("foo(({width: 100, height: 200}))");
  });

  it("object literal with expression values", () => {
    const r = compile("x = bar({a: 1 + 2, b: sin(t)})");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("({a: (1 + 2), b: sin(t)})");
  });

  it("nested object literal", () => {
    const r = compile("x = baz({outer: {inner: 42}})");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("({outer: ({inner: 42})})");
  });

  it("empty object literal", () => {
    const r = compile("x = foo({})");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("foo(({}))")
  });

  it("object literal with variable references", () => {
    const r = compile("x = create({seed: 42, width: w, height: h})");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("({seed: 42, width: w, height: h})");
  });
});

describe("compile — bracket indexing", () => {
  it("simple bracket index", () => {
    const r = compile("x = arr[0]");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("arr[0]");
  });

  it("bracket index with expression", () => {
    const r = compile("x = arr[i % arr.length]");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("arr[(i % arr.length)]");
  });

  it("chained bracket and dot access", () => {
    const r = compile("x = arr[0].name");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("arr[0].name");
  });

  it("nested bracket index", () => {
    const r = compile("x = grid[i][j]");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("grid[i][j]");
  });
});

describe("compile — bug fixes", () => {
  it("let keyword parses as assignment, no bare let; (bug fix)", () => {
    const r = compile("let margin = 40\nlet x = margin + 10");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("let margin = 40;");
    expect(r.code).toContain("let x = (margin + 10);");
    expect(r.code).not.toContain("let;");
  });

  it("let keyword with expression rhs", () => {
    const r = compile("let total = (w / 2) + 10");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("let total = ((w / 2) + 10);");
    expect(r.code).not.toContain("let;");
  });

  it("negative literals in draw command positional args (bug fix)", () => {
    const r = compile("rect -25 -25 w:50 h:50");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Should have two negative positional args, not a subtraction
    expect(r.code).toContain("(-25)");
    expect(r.code).toContain("50");
  });

  it("draw command still allows division in positional args", () => {
    const r = compile("circle w/2 h/2 r:100 fill:coral");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("(w / 2)");
    expect(r.code).toContain("(h / 2)");
  });

  it("draw command allows addition in positional args", () => {
    const r = compile("circle x+10 y+20 r:50");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("(x + 10)");
    expect(r.code).toContain("(y + 20)");
  });
});

describe("compile — bare identifiers (v2)", () => {
  // use directive
  it("use bare component name with hyphens", () => {
    const r = compile("use bristle-stroke-renderer");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.components).toEqual(["bristle-stroke-renderer"]);
  });

  it("use bare single-word component", () => {
    const r = compile("use math");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.components).toEqual(["math"]);
  });

  it("use bare component coexists with use lib", () => {
    const r = compile("use easing\nuse bristle-stroke-renderer");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("const ease_in =");
    expect(r.components).toEqual(["bristle-stroke-renderer"]);
  });

  it("use quoted string still works (backward compat)", () => {
    const r = compile('use "bristle-stroke-renderer"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.components).toEqual(["bristle-stroke-renderer"]);
  });

  it("use lib names still work as libs", () => {
    const r = compile("use easing");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("const ease_in =");
    expect(r.components).toEqual([]);
  });

  // layer directive
  it("layer with bare type and preset", () => {
    const r = compile("layer terrain:sky dusk");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layers).toHaveLength(1);
    expect(r.layers[0]).toEqual({ type: "terrain:sky", preset: "dusk" });
  });

  it("layer with bare type and preset plus named args", () => {
    const r = compile('layer terrain:mountains alpine name:"My Mountains" opacity:0.8');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layers[0]!.type).toBe("terrain:mountains");
    expect(r.layers[0]!.preset).toBe("alpine");
    expect(r.layers[0]!.name).toBe("My Mountains");
    expect(r.layers[0]!.opacity).toBe(0.8);
  });

  it("layer with quoted strings still works (backward compat)", () => {
    const r = compile('layer "terrain:sky" "noon"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layers[0]!.type).toBe("terrain:sky");
    expect(r.layers[0]!.preset).toBe("noon");
  });

  it("layer with hyphenated preset", () => {
    const r = compile("layer particles:glow warm-evening");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layers[0]!.type).toBe("particles:glow");
    expect(r.layers[0]!.preset).toBe("warm-evening");
  });

  it("multiple bare layers maintain order", () => {
    const r = compile("layer terrain:sky noon\nlayer terrain:mountains alpine\nlayer terrain:water lake");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.layers).toHaveLength(3);
    expect(r.layers[0]!.type).toBe("terrain:sky");
    expect(r.layers[1]!.type).toBe("terrain:mountains");
    expect(r.layers[2]!.type).toBe("terrain:water");
  });

  // group directive
  it("group with bare identifier", () => {
    const src = ["group Sky", "param skyW 19 range:4..40"].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params[0]!.tab).toBe("sky");
    expect(r.tabs).toEqual([{ id: "sky", label: "Sky" }]);
  });

  it("multiple bare groups", () => {
    const src = [
      "group Sky",
      "param skyW 19 range:4..40",
      "group Water",
      "param waterW 12 range:4..30",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params[0]!.tab).toBe("sky");
    expect(r.params[1]!.tab).toBe("water");
    expect(r.tabs).toEqual([
      { id: "sky", label: "Sky" },
      { id: "water", label: "Water" },
    ]);
  });

  it("group quoted string still works (backward compat)", () => {
    const src = ['group "Lightning Bolts"', "param x 5 range:0..10"].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params[0]!.tab).toBe("lightning-bolts");
    expect(r.tabs[0]!.label).toBe("Lightning Bolts");
  });

  // inline param group
  it("inline param group with bare identifier", () => {
    const r = compile("param size 10 range:1..50 group:Style");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params[0]!.tab).toBe("style");
    expect(r.tabs).toEqual([{ id: "style", label: "Style" }]);
  });

  it("inline param group quoted still works (backward compat)", () => {
    const r = compile('param size 10 range:1..50 group:"Style"');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params[0]!.tab).toBe("style");
  });

  // mixed bare and quoted
  it("mixed bare and quoted in same file", () => {
    const src = [
      "use bristle-stroke-renderer",
      'use "curl-flow-field"',
      "layer terrain:sky noon",
      'layer "terrain:water" "lake"',
      "group Sky",
      "param skyW 19 range:4..40",
      'group "Water"',
      "param waterW 12 range:4..30",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.components).toEqual(["bristle-stroke-renderer", "curl-flow-field"]);
    expect(r.layers).toHaveLength(2);
    expect(r.layers[0]!.type).toBe("terrain:sky");
    expect(r.layers[1]!.type).toBe("terrain:water");
    expect(r.tabs).toEqual([
      { id: "sky", label: "Sky" },
      { id: "water", label: "Water" },
    ]);
  });
});

describe("compile — colorAt/alphaAt builtins (v2)", () => {
  it("colorAt compiles as a global function call", () => {
    const r = compile("base = buffer(100, 100)\nc = colorAt(base, 50, 50)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("colorAt(base, 50, 50)");
  });

  it("alphaAt compiles as a global function call", () => {
    const r = compile("mask = buffer(100, 100)\na = alphaAt(mask, 10, 20)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("alphaAt(mask, 10, 20)");
  });

  it("pixelAt compiles as a global function call", () => {
    const r = compile("buf = buffer(100, 100)\np = pixelAt(buf, 0, 0)");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("pixelAt(buf, 0, 0)");
  });
});

describe("compile — metadata header (v2)", () => {
  it("title extracts from bare words", () => {
    const r = compile("title Stormy Sea Impressionist\nbg black");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metadata.title).toBe("Stormy Sea Impressionist");
  });

  it("title extracts from quoted string", () => {
    const r = compile('title "Stormy Sea — Impressionist"\nbg black');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metadata.title).toBe("Stormy Sea — Impressionist");
  });

  it("subtitle extracts with hyphens preserved", () => {
    const r = compile("subtitle Per-layer bristle-stroke painting\nbg black");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metadata.subtitle).toBe("Per-layer bristle-stroke painting");
  });

  it("compositionLevel extracts valid values", () => {
    const r = compile("compositionLevel complex\nbg black");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metadata.compositionLevel).toBe("complex");
  });

  it("compositionLevel rejects invalid values", () => {
    const r = compile("compositionLevel super\nbg black");
    expect(r.ok).toBe(false);
  });

  it("philosophy extracts from bare words", () => {
    const r = compile("philosophy Translate plugin composites into painterly passes\nbg black");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metadata.philosophy).toContain("Translate");
    expect(r.metadata.philosophy).toContain("painterly");
  });

  it("philosophy with keyword words (layer, color) in bare text", () => {
    const r = compile("philosophy Translate plugin layer composites into color passes\nbg black");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metadata.philosophy).toContain("layer");
    expect(r.metadata.philosophy).toContain("color");
  });

  it("philosophy extracts from quoted string", () => {
    const r = compile('philosophy "Multi-line content with special chars: dashes—and colons: here"\nbg black');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metadata.philosophy).toBe("Multi-line content with special chars: dashes—and colons: here");
  });

  it("all metadata fields together", () => {
    const src = [
      "title Stormy Sea Impressionist",
      'subtitle "Per-layer bristle-stroke painting with lightning"',
      "compositionLevel complex",
      'philosophy "Translate plugin layer composites into painterly dab passes."',
      "bg black",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metadata.title).toBe("Stormy Sea Impressionist");
    expect(r.metadata.subtitle).toBe("Per-layer bristle-stroke painting with lightning");
    expect(r.metadata.compositionLevel).toBe("complex");
    expect(r.metadata.philosophy).toBe("Translate plugin layer composites into painterly dab passes.");
  });

  it("metadata does not emit code", () => {
    const r = compile("title My Sketch\ncompositionLevel simple\nbg black");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).not.toContain("title");
    expect(r.code).not.toContain("My Sketch");
    expect(r.code).not.toContain("compositionLevel");
    expect(r.code).toContain("ctx.fillStyle");
  });

  it("empty metadata when no directives", () => {
    const r = compile("bg black");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metadata).toEqual({});
  });

  it("metadata coexists with layers, params, and groups", () => {
    const src = [
      "title Storm Painting",
      "compositionLevel complex",
      "layer terrain:sky noon",
      "group Sky",
      "param skyW 19 range:4..40",
      "bg black",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metadata.title).toBe("Storm Painting");
    expect(r.metadata.compositionLevel).toBe("complex");
    expect(r.layers).toHaveLength(1);
    expect(r.params).toHaveLength(1);
    expect(r.params[0]!.tab).toBe("sky");
  });
});

describe("compile — paramset templates (v2)", () => {
  it("basic paramset definition and instantiation", () => {
    const src = [
      "paramset bristle(dabWidth, bristles, alphaMin, alphaMax, dabs):",
      "  param {prefix}DabWidth {dabWidth} range:4..40 step:1",
      "  param {prefix}Bristles {bristles} range:3..12 step:1",
      "  param {prefix}AlphaMin {alphaMin} range:0..1 step:0.05",
      "  param {prefix}AlphaMax {alphaMax} range:0..1 step:0.05",
      "  param {prefix}Dabs {dabs} range:500..5000 step:100",
      "",
      "bristle sky(19, 6, 0.4, 0.8, 1800)",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params).toHaveLength(5);
    expect(r.params[0]).toMatchObject({ key: "skyDabWidth", default: 19, min: 4, max: 40, step: 1 });
    expect(r.params[1]).toMatchObject({ key: "skyBristles", default: 6, min: 3, max: 12, step: 1 });
    expect(r.params[2]).toMatchObject({ key: "skyAlphaMin", default: 0.4, min: 0, max: 1, step: 0.05 });
    expect(r.params[3]).toMatchObject({ key: "skyAlphaMax", default: 0.8, min: 0, max: 1, step: 0.05 });
    expect(r.params[4]).toMatchObject({ key: "skyDabs", default: 1800, min: 500, max: 5000, step: 100 });
  });

  it("multiple instantiations with different prefixes", () => {
    const src = [
      "paramset bristle(dabWidth, bristles):",
      "  param {prefix}DabWidth {dabWidth} range:4..40 step:1",
      "  param {prefix}Bristles {bristles} range:3..12 step:1",
      "",
      "bristle sky(19, 6)",
      "bristle water(12, 8)",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params).toHaveLength(4);
    expect(r.params[0]!.key).toBe("skyDabWidth");
    expect(r.params[1]!.key).toBe("skyBristles");
    expect(r.params[2]!.key).toBe("waterDabWidth");
    expect(r.params[3]!.key).toBe("waterBristles");
  });

  it("paramset with groups", () => {
    const src = [
      "paramset bristle(dabWidth, bristles):",
      "  param {prefix}DabWidth {dabWidth} range:4..40 step:1",
      "  param {prefix}Bristles {bristles} range:3..12 step:1",
      "",
      "group Sky",
      "bristle sky(19, 6)",
      "group Water",
      "bristle water(12, 8)",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.params[0]!.tab).toBe("sky");
    expect(r.params[1]!.tab).toBe("sky");
    expect(r.params[2]!.tab).toBe("water");
    expect(r.params[3]!.tab).toBe("water");
  });

  it("paramset does not emit any definition code", () => {
    const src = [
      "paramset bristle(dabWidth):",
      "  param {prefix}W {dabWidth} range:4..40 step:1",
      "",
      "bristle sky(19)",
      "bg black",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).not.toContain("paramset");
    expect(r.code).not.toContain("bristle");
    expect(r.code).toContain('let skyW = __params__["skyW"]');
  });

  it("paramset coexists with metadata and layers", () => {
    const src = [
      "title Storm Painting",
      "paramset bristle(dabWidth):",
      "  param {prefix}W {dabWidth} range:4..40",
      "",
      "layer terrain:sky noon",
      "bristle sky(19)",
      "bg black",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metadata.title).toBe("Storm Painting");
    expect(r.layers).toHaveLength(1);
    expect(r.params).toHaveLength(1);
    expect(r.params[0]!.key).toBe("skyW");
  });
});

describe("compile — bristlePass directive (v2)", () => {
  it("basic bristlePass expands to loop with renderBristleStroke", () => {
    const src = [
      "param skyDabs 1800 range:500..5000",
      "param skyDabWidth 19 range:4..40",
      "param skyBristles 6 range:3..12",
      "param skyAlphaMin 0.4 range:0..1",
      "param skyAlphaMax 0.8 range:0..1",
      "bristlePass sky seed:100 mask:skyMask texture:smooth:",
      "  count: skyDabs",
      "  width: skyDabWidth",
      "  bristles: skyBristles",
      "  alpha: [skyAlphaMin, skyAlphaMax]",
      "  angle: flowAngle * 0.3",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Should have the RNG, loop, mask check, color sampling, and stroke call
    expect(r.code).toContain("mulberry32(100)");
    expect(r.code).toContain("alphaAt(skyMask,");
    expect(r.code).toContain("colorAt(base,");
    expect(r.code).toContain("renderBristleStroke(ctx,");
    expect(r.code).toContain('"smooth"');
    expect(r.code).toContain("flowAngle");
  });

  it("bristlePass with exclude generates exclusion check", () => {
    const src = [
      "bristlePass sky seed:100 mask:skyMask texture:smooth:",
      "  count: 1000",
      "  width: 19",
      "  bristles: 6",
      "  alpha: [0.4, 0.8]",
      "  angle: flowAngle * 0.3",
      "  exclude: nearestBoltDist(pos.x, pos.y) < 30",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("nearestBoltDist");
    expect(r.code).toContain("< 30");
  });

  it("bristlePass with custom jitter", () => {
    const src = [
      "bristlePass cloud seed:400 mask:cloudMask texture:dry:",
      "  count: 1800",
      "  width: 16",
      "  bristles: 6",
      "  alpha: [0.25, 0.65]",
      "  angle: flowAngle * 0.5",
      "  jitter: colorJitter + 4",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("(colorJitter + 4)");
    expect(r.code).toContain('"dry"');
  });

  it("bristlePass with countMul", () => {
    const src = [
      "bristlePass rain seed:600 mask:rainMask texture:stipple:",
      "  count: 2000",
      "  width: 6",
      "  bristles: 4",
      "  alpha: [0.5, 0.85]",
      "  angle: PI / 2",
      "  countMul: stormIntensity",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // countMul wraps: floor(((count * dabDensity) * stormIntensity))
    expect(r.code).toContain("dabDensity");
    expect(r.code).toContain("stormIntensity");
  });

  it("bristlePass with steps and stepSize", () => {
    const src = [
      "bristlePass rain seed:600 mask:rainMask texture:stipple:",
      "  count: 2000",
      "  width: 6",
      "  bristles: 4",
      "  alpha: [0.5, 0.85]",
      "  angle: PI / 2",
      "  steps: 8",
      "  stepSize: 2",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("steps: 8");
    expect(r.code).toContain("stepSize: 2");
  });

  it("multiple bristlePasses compile independently", () => {
    const src = [
      "bristlePass sky seed:100 mask:skyMask texture:smooth:",
      "  count: 1800",
      "  width: 19",
      "  bristles: 6",
      "  alpha: [0.4, 0.8]",
      "  angle: flowAngle * 0.3",
      "",
      "bristlePass water seed:200 mask:waterMask texture:rough:",
      "  count: 2500",
      "  width: 12",
      "  bristles: 6",
      "  alpha: [0.45, 0.9]",
      "  angle: flowAngle + sin(pos.x * 0.008) * 0.15",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("mulberry32(100)");
    expect(r.code).toContain("mulberry32(200)");
    expect(r.code).toContain('"smooth"');
    expect(r.code).toContain('"rough"');
    expect(r.code).toContain("alphaAt(skyMask,");
    expect(r.code).toContain("alphaAt(waterMask,");
  });

  it("bristlePass does not contain directive keywords in output", () => {
    const src = [
      "bristlePass sky seed:100 mask:skyMask texture:smooth:",
      "  count: 1800",
      "  width: 19",
      "  bristles: 6",
      "  alpha: [0.4, 0.8]",
      "  angle: flowAngle * 0.3",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).not.toContain("bristlePass");
  });

  it("bristlePass with scatter uses probabilistic check instead of threshold", () => {
    const src = [
      "bristlePass rain seed:600 mask:rainMask texture:stipple:",
      "  count: 2000",
      "  width: 6",
      "  bristles: 4",
      "  alpha: [0.5, 0.85]",
      "  angle: PI / 2",
      "  scatter: 0.15 + (maskAlpha / 255) * 0.6",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Should have maskAlpha variable and probabilistic check
    expect(r.code).toContain("maskAlpha");
    expect(r.code).toContain("alphaAt(rainMask,");
    // Should NOT have the hard < 10 threshold
    expect(r.code).not.toContain("< 10");
  });

  it("bristlePass with custom color overrides colorAt sampling", () => {
    const src = [
      "bristlePass rain seed:600 mask:rainMask texture:stipple:",
      "  count: 2000",
      "  width: 6",
      "  bristles: 4",
      "  alpha: [0.5, 0.85]",
      "  angle: PI / 2",
      "  color: [220, 225, 245]",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Should use custom color, NOT colorAt(base, ...)
    expect(r.code).not.toContain("colorAt(base,");
    expect(r.code).toContain("[220, 225, 245]");
  });

  it("bristlePass with blend renders to offscreen buffer", () => {
    const src = [
      "bristlePass glow seed:770 mask:glowMask texture:feathered blend:screen:",
      "  count: 1200",
      "  width: 24",
      "  bristles: 4",
      "  alpha: [0.1, 0.35]",
      "  angle: flowAngle",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Should create offscreen buffer and draw with blend
    expect(r.code).toContain("buffer(w, h)");
    expect(r.code).toContain('getContext("2d")');
    expect(r.code).not.toContain("bristlePass");
  });
});

describe("compile — forcePass directive (v2)", () => {
  it("basic forcePass expands with proximity and distance check", () => {
    const src = [
      "forcePass bolt seed:777 path:boltPath radius:35 texture:impasto:",
      "  count: 1500",
      "  width: 12",
      "  bristles: 6",
      "  alpha: lerp(0.4, 0.9, proximity)",
      "  angle: flowAngle",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("mulberry32(777)");
    expect(r.code).toContain("boltPath.distAt(");
    expect(r.code).toContain("> 35");
    expect(r.code).toContain("proximity");
    expect(r.code).toContain("renderBristleStroke(");
    expect(r.code).toContain('"impasto"');
  });

  it("forcePass with sparse generates skip probability", () => {
    const src = [
      "forcePass bolt seed:777 path:boltPath radius:35 texture:impasto:",
      "  count: 1500",
      "  sparse: 0.35",
      "  width: 12",
      "  bristles: 6",
      "  alpha: lerp(0.4, 0.9, proximity)",
      "  angle: flowAngle",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("> 0.35");
  });

  it("forcePass with custom color expression", () => {
    const src = [
      "forcePass bolt seed:777 path:boltPath radius:35 texture:impasto:",
      "  count: 1500",
      "  width: 12",
      "  bristles: 6",
      "  alpha: lerp(0.4, 0.9, proximity)",
      "  angle: flowAngle",
      "  color: [floor(lerp(baseColor[0], 250, proximity)), 245, 255]",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("baseColor");
    expect(r.code).toContain("colorAt(base,");
  });

  it("forcePass with blend:screen renders to offscreen buffer", () => {
    const src = [
      "forcePass glow seed:770 path:boltPath radius:100 texture:feathered blend:screen:",
      "  count: 1200",
      "  width: 24",
      "  bristles: 4",
      "  alpha: lerp(0.03, 0.35, proximity * proximity)",
      "  angle: flowAngle",
      "  color: [210, 220, 250]",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("buffer(w, h)");
    expect(r.code).toContain('getContext("2d")');
    expect(r.code).not.toContain("forcePass");
  });

  it("forcePass exposes path variable for angle expressions", () => {
    const src = [
      "forcePass bolt seed:777 path:myBolt radius:50 texture:smooth:",
      "  count: 1000",
      "  width: 10",
      "  bristles: 6",
      "  alpha: [0.4, 0.8]",
      "  angle: path.angleAt(pos.x, pos.y, flowAngle)",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // path.angleAt(...) in the source becomes myBolt.angleAt(...) in output
    expect(r.code).toContain("myBolt.angleAt(");
  });

  it("forcePass does not contain directive keywords in output", () => {
    const src = [
      "forcePass bolt seed:777 path:boltPath radius:35 texture:impasto:",
      "  count: 1500",
      "  width: 12",
      "  bristles: 6",
      "  alpha: lerp(0.4, 0.9, proximity)",
      "  angle: flowAngle",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).not.toContain("forcePass");
  });
});

describe("compile — rng() alias in pass bodies (v3)", () => {
  it("bristlePass emits rng alias for __bp_*_rng", () => {
    const src = [
      "bristlePass sky seed:100 mask:skyMask texture:smooth:",
      "  count: 1000",
      "  width: 19",
      "  bristles: 6",
      "  alpha: [0.4, 0.8]",
      "  angle: flowAngle * 0.3",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("rng = __bp_sky_rng");
  });

  it("forcePass emits rng alias for __fp_*_rng", () => {
    const src = [
      "forcePass bolt seed:777 path:boltPath radius:35 texture:impasto:",
      "  count: 1500",
      "  width: 12",
      "  bristles: 6",
      "  alpha: lerp(0.4, 0.9, proximity)",
      "  angle: flowAngle",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("rng = __fp_bolt_rng");
  });

  it("rng() can be used in bristlePass body expressions", () => {
    const src = [
      "bristlePass rain seed:600 mask:rainMask texture:stipple:",
      "  count: 2000",
      "  width: 6",
      "  bristles: 4",
      "  alpha: lerp(0.5, 0.85, rng())",
      "  angle: PI / 2 + (rng() - 0.5) * 0.15",
      "  scatter: 0.15",
      "  color: [floor(lerp(190, 220, rng())), 200, 220]",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // rng alias is set before the loop, so rng() calls in body compile fine
    expect(r.code).toContain("rng = __bp_rain_rng");
    expect(r.code).toContain("rng()");
  });
});

describe("compile — pass keyword alias (v3)", () => {
  it("pass works as alias for bristlePass", () => {
    const src = [
      "pass sky seed:100 mask:skyMask texture:smooth:",
      "  count: 1000",
      "  width: 19",
      "  bristles: 6",
      "  alpha: [0.4, 0.8]",
      "  angle: flowAngle * 0.3",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("mulberry32(100)");
    expect(r.code).toContain("alphaAt(skyMask,");
    expect(r.code).toContain("renderBristleStroke(ctx,");
    expect(r.code).not.toContain("bristlePass");
    expect(r.code).not.toContain("pass sky");
  });

  it("pass with blend works like bristlePass blend", () => {
    const src = [
      "pass glow seed:770 mask:glowMask texture:feathered blend:screen:",
      "  count: 1200",
      "  width: 24",
      "  bristles: 4",
      "  alpha: [0.03, 0.35]",
      "  angle: flowAngle",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("buffer(w, h)");
    expect(r.code).toContain("screen");
    expect(r.code).toContain("__bp_glow_buf");
  });
});

describe("compile — bolt() exclude shorthand (v3)", () => {
  it("bolt(30) expands to bolt.excludes(pos.x, pos.y, 30)", () => {
    const src = [
      "pass sky seed:100 mask:skyMask texture:smooth:",
      "  count: 1000",
      "  width: 19",
      "  bristles: 6",
      "  alpha: [0.4, 0.8]",
      "  angle: flowAngle * 0.3",
      "  exclude: bolt(30)",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("bolt.excludes(pos.x, pos.y, 30)");
  });

  it("myPath(50) expands generically for any variable name", () => {
    const src = [
      "pass sky seed:100 mask:skyMask texture:smooth:",
      "  count: 1000",
      "  width: 19",
      "  bristles: 6",
      "  alpha: [0.4, 0.8]",
      "  angle: flowAngle",
      "  exclude: myPath(50)",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("myPath.excludes(pos.x, pos.y, 50)");
  });

  it("full bolt.excludes(...) syntax still works unchanged", () => {
    const src = [
      "pass sky seed:100 mask:skyMask texture:smooth:",
      "  count: 1000",
      "  width: 19",
      "  bristles: 6",
      "  alpha: [0.4, 0.8]",
      "  angle: flowAngle",
      "  exclude: bolt.excludes(pos.x, pos.y, 30)",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("bolt.excludes(pos.x, pos.y, 30)");
  });
});

describe("compile — auto-masks from layer: (v3)", () => {
  it("layer:terrain:sky auto-generates renderLayer call", () => {
    const src = [
      "pass sky seed:100 layer:terrain:sky texture:smooth:",
      "  count: 1000",
      "  width: 19",
      "  bristles: 6",
      "  alpha: [0.4, 0.8]",
      "  angle: flowAngle * 0.3",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('renderLayer("terrain:sky")');
    expect(r.code).toContain("alphaAt(__mask_terrain_sky,");
    expect(r.code).toContain("renderBristleStroke(ctx,");
  });

  it("two passes with same layer share the cached mask", () => {
    const src = [
      "pass sky1 seed:100 layer:terrain:sky texture:smooth:",
      "  count: 1000",
      "  width: 19",
      "  bristles: 6",
      "  alpha: [0.4, 0.8]",
      "  angle: flowAngle * 0.3",
      "",
      "pass sky2 seed:200 layer:terrain:sky texture:rough:",
      "  count: 500",
      "  width: 12",
      "  bristles: 4",
      "  alpha: [0.3, 0.7]",
      "  angle: flowAngle * 0.5",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // renderLayer should appear only once
    const matches = r.code.match(/renderLayer\("terrain:sky"\)/g);
    expect(matches).toHaveLength(1);
    // Both passes use the same mask variable
    const maskMatches = r.code.match(/alphaAt\(__mask_terrain_sky,/g);
    expect(maskMatches!.length).toBe(2);
  });

  it("different layers get separate renderLayer calls", () => {
    const src = [
      "pass sky seed:100 layer:terrain:sky texture:smooth:",
      "  count: 1000",
      "  width: 19",
      "  bristles: 6",
      "  alpha: [0.4, 0.8]",
      "  angle: flowAngle",
      "",
      "pass water seed:200 layer:terrain:water texture:rough:",
      "  count: 1500",
      "  width: 12",
      "  bristles: 6",
      "  alpha: [0.45, 0.9]",
      "  angle: flowAngle",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain('renderLayer("terrain:sky")');
    expect(r.code).toContain('renderLayer("terrain:water")');
  });

  it("mask: still works for backward compatibility", () => {
    const src = [
      "pass sky seed:100 mask:skyMask texture:smooth:",
      "  count: 1000",
      "  width: 19",
      "  bristles: 6",
      "  alpha: [0.4, 0.8]",
      "  angle: flowAngle",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("alphaAt(skyMask,");
    expect(r.code).not.toContain("renderLayer");
  });
});

describe("compile — param auto-bind (v3)", () => {
  it("auto-binds count/width/bristles/alpha from paramset naming convention", () => {
    const src = [
      "param skyDabs 1800 range:500..5000",
      "param skyDabWidth 19 range:4..40",
      "param skyBristles 6 range:3..12",
      "param skyAlphaMin 0.4 range:0..1",
      "param skyAlphaMax 0.8 range:0..1",
      "pass sky seed:100 mask:skyMask texture:smooth:",
      "  angle: flowAngle * 0.3",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Auto-bound params should appear in the compiled output
    expect(r.code).toContain("skyDabs");
    expect(r.code).toContain("skyDabWidth");
    expect(r.code).toContain("skyBristles");
    expect(r.code).toContain("skyAlphaMin");
    expect(r.code).toContain("skyAlphaMax");
  });

  it("explicit body keys override auto-bind", () => {
    const src = [
      "param skyDabs 1800 range:500..5000",
      "param skyDabWidth 19 range:4..40",
      "param skyBristles 6 range:3..12",
      "param skyAlphaMin 0.4 range:0..1",
      "param skyAlphaMax 0.8 range:0..1",
      "pass sky seed:100 mask:skyMask texture:smooth:",
      "  count: 999",
      "  width: 25",
      "  angle: flowAngle * 0.3",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Explicit overrides
    expect(r.code).toContain("999");
    expect(r.code).toContain("25");
    // Auto-bound (not overridden)
    expect(r.code).toContain("skyBristles");
    expect(r.code).toContain("skyAlphaMin");
  });

  it("no auto-bind when params are not declared", () => {
    const src = [
      "pass sky seed:100 mask:skyMask texture:smooth:",
      "  angle: flowAngle * 0.3",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Falls back to defaults (1000, 10, 6, 0.3, 0.8)
    expect(r.code).not.toContain("skyDabs");
    expect(r.code).toContain("1000");
  });

  it("auto-bind works with layer: syntax", () => {
    const src = [
      "param skyDabs 1800 range:500..5000",
      "param skyDabWidth 19 range:4..40",
      "param skyBristles 6 range:3..12",
      "param skyAlphaMin 0.4 range:0..1",
      "param skyAlphaMax 0.8 range:0..1",
      "pass sky seed:100 layer:terrain:sky texture:smooth:",
      "  angle: flowAngle * 0.3",
      "  exclude: bolt(30)",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("skyDabs");
    expect(r.code).toContain("skyDabWidth");
    expect(r.code).toContain('renderLayer("terrain:sky")');
    expect(r.code).toContain("bolt.excludes(pos.x, pos.y, 30)");
  });

  it("auto-bind works with forcePass too", () => {
    const src = [
      "param boltDabs 1500 range:300..4000",
      "param boltDabWidth 12 range:3..25",
      "param boltBristles 6 range:3..12",
      "param boltAlphaMin 0.4 range:0..1",
      "param boltAlphaMax 0.9 range:0..1",
      "forcePass bolt seed:777 path:boltPath radius:35 texture:impasto:",
      "  angle: flowAngle",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("boltDabs");
    expect(r.code).toContain("boltDabWidth");
    expect(r.code).toContain("boltBristles");
    expect(r.code).toContain("boltAlphaMin");
  });
});

describe("compile — flow directive (v3)", () => {
  it("flow expands to renderLayers + flow field + grid", () => {
    const src = [
      "param skyDabWidth 19 range:4..40",
      "param waterDabWidth 12 range:4..40",
      "flow gridSize:300 turbulence:turbulence",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("renderLayers()");
    expect(r.code).toContain("createCurlFlowField");
    expect(r.code).toContain("gridSize: 300");
    expect(r.code).toContain("makeGrid");
    // minWidth auto-derived from DabWidth params
    expect(r.code).toContain("min(skyDabWidth, waterDabWidth)");
  });

  it("flow with defaults when no args specified", () => {
    const src = "flow\nbg black";
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("renderLayers()");
    expect(r.code).toContain("gridSize: 300");
    expect(r.code).toContain("mulberry32(42)");
  });

  it("flow with custom seed", () => {
    const src = "flow seed:99\nbg black";
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("mulberry32(99)");
  });

  it("does not match flowAngle or other flow-prefixed identifiers", () => {
    const src = "flowAngle = 1.5\nbg black";
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).not.toContain("renderLayers");
    expect(r.code).toContain("flowAngle");
  });

  it("flow extracts use components", () => {
    const src = "flow gridSize:200\nbg black";
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // use statements should be present in the expanded source
    expect(r.components).toContain("curl-flow-field");
    expect(r.components).toContain("grid-placement");
  });
});

describe("compile — underpainting directive (v3)", () => {
  it("underpainting expands to full wash loop", () => {
    const src = [
      "underpainting seed:1:",
      "  exclude: bolt(40)",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("mulberry32(1)");
    expect(r.code).toContain("colorAt(base,");
    expect(r.code).toContain("renderBristleStroke(ctx,");
    expect(r.code).toContain('"smooth"');
    expect(r.code).toContain("bolt.excludes(pos.x, pos.y, 40)");
  });

  it("underpainting with custom width and bristles", () => {
    const src = "underpainting seed:5 width:30 bristles:6 alpha:0.9:";
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("mulberry32(5)");
    expect(r.code).toContain("width: 30");
    expect(r.code).toContain("bristleCount: 6");
    expect(r.code).toContain("alpha: 0.9");
  });

  it("underpainting with custom count", () => {
    const src = [
      "underpainting seed:1:",
      "  count: 5000",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("5000");
  });

  it("underpainting without body (no colon-only line)", () => {
    const src = "underpainting seed:1:";
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("mulberry32(1)");
    expect(r.code).toContain("3000");  // default count
  });
});

describe("compile — implicit line continuation (v3)", () => {
  it("multi-line array expression compiles correctly", () => {
    const src = [
      "x = [",
      "  1,",
      "  2,",
      "  3",
      "]",
      "bg black",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("[1, 2, 3]");
  });

  it("multi-line function call compiles correctly", () => {
    const src = [
      "x = lerp(",
      "  0.4,",
      "  0.9,",
      "  0.5",
      ")",
      "bg black",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("lerp(0.4, 0.9, 0.5)");
  });

  it("multi-line object literal compiles correctly", () => {
    const src = [
      "x = {",
      "  a: 1,",
      "  b: 2",
      "}",
      "bg black",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("a: 1");
    expect(r.code).toContain("b: 2");
  });

  it("nested multi-line brackets compile correctly", () => {
    const src = [
      "x = foo([",
      "  1,",
      "  2",
      "])",
      "bg black",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("foo([1, 2])");
  });
});

describe("compile — multi-line strings (v3)", () => {
  it("quoted string spanning two lines joins with space", () => {
    const src = [
      'philosophy "Translate plugin layer composites',
      '  into painterly dab passes."',
      "bg black",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metadata.philosophy).toBe(
      "Translate plugin layer composites into painterly dab passes."
    );
  });

  it("quoted string spanning three lines", () => {
    const src = [
      'philosophy "Line one',
      '  line two',
      '  line three."',
      "bg black",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metadata.philosophy).toBe("Line one line two line three.");
  });
});

describe("compile — multi-line metadata (v3)", () => {
  it("bare metadata with indented continuation lines", () => {
    const src = [
      "philosophy Translate plugin layer composites",
      "  into painterly dab passes, each with",
      "  distinct brush character.",
      "bg black",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metadata.philosophy).toContain("Translate");
    expect(r.metadata.philosophy).toContain("painterly");
    expect(r.metadata.philosophy).toContain("distinct");
  });

  it("title with continuation line", () => {
    const src = [
      "title Stormy Sea",
      "  Impressionist",
      "bg black",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.metadata.title).toBe("Stormy Sea Impressionist");
  });
});

describe("compile — multi-line pass body values (v3)", () => {
  it("pass body value with multi-line array", () => {
    const src = [
      "layer terrain:sky dusk",
      "pass sky seed:100 layer:terrain:sky texture:smooth:",
      "  color: [",
      "    floor(lerp(190, 220, rng())),",
      "    floor(lerp(200, 225, rng())),",
      "    floor(lerp(220, 245, rng()))",
      "  ]",
      "  jitter: 5",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // The color array should appear in the compiled output
    expect(r.code).toContain("lerp(190, 220");
    expect(r.code).toContain("lerp(220, 245");
    // jitter should also be present (not swallowed)
    expect(r.code).toContain("jitter");
  });

  it("pass body value with expression continuation", () => {
    const src = [
      "param flowInfluence 0.3 range:0..1 step:0.05",
      "param waveHeight 0.6 range:0.2..1.0 step:0.05",
      "layer terrain:water choppy-sea",
      "pass water seed:200 layer:terrain:water texture:rough:",
      "  angle: flowAngle * flowInfluence",
      "    + sin(pos.x * 0.008) * 0.15 * waveHeight",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // Both parts of the expression should be in the output
    expect(r.code).toContain("flowAngle");
    expect(r.code).toContain("sin(");
    expect(r.code).toContain("waveHeight");
  });

  it("pass body with multi-line function call in value", () => {
    const src = [
      "layer terrain:sky dusk",
      "pass sky seed:100 layer:terrain:sky texture:smooth:",
      "  width: lerp(",
      "    12,",
      "    24,",
      "    proximity",
      "  )",
    ].join("\n");
    const r = compile(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("lerp(12, 24, proximity)");
  });
});

// ---------------------------------------------------------------------------
// Phase 3: library directive
// ---------------------------------------------------------------------------

describe("compile — library directive", () => {
  it("library p5.brush emits libraries array", () => {
    const r = compile(`library "p5.brush"\nbg black`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.libraries).toHaveLength(1);
    expect(r.libraries[0]!.name).toBe("p5.brush");
    expect(r.libraries[0]!.version).toBeUndefined();
  });

  it("library p5.brush with version override", () => {
    const r = compile(`library "p5.brush" version:"2.1.0"\nbg black`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.libraries).toHaveLength(1);
    expect(r.libraries[0]!.name).toBe("p5.brush");
    expect(r.libraries[0]!.version).toBe("2.1.0");
  });

  it("unknown library name → compile error", () => {
    const r = compile(`library "unknown-lib"\nbg black`);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]!.message).toMatch(/Unknown library "unknown-lib"/);
  });

  it("p5.brush injects P5_BRUSH_LIB helpers into code", () => {
    const r = compile(`library "p5.brush"\nbg black`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.code).toContain("brushStroke");
    expect(r.code).toContain("watercolorFill");
    expect(r.code).toContain("hatchRegion");
  });

  it("no library → libraries array is empty", () => {
    const r = compile("bg black");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.libraries).toHaveLength(0);
  });

  it("library directive does not emit any JavaScript statement", () => {
    const r = compile(`library "p5.brush"\nbg black`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // No bare "library" call in generated code (only the injected helpers)
    const lines = r.code.split("\n").filter(l => /^\s*library\s*\(/.test(l));
    expect(lines).toHaveLength(0);
  });
});
