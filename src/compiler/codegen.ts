import type {
  Program, TopLevel, Stmt, Expr, BlockHeader, NamedArg,
  DrawCmd, BlockStmt, ParamDecl, ColorDecl, LayerDecl, Assign, MultiAssign,
  BgCmd, UseStmt, SeedStmt, ReturnStmt, PrintStmt, WatchStmt,
  ExprStmt, BinOp, UnaryOp, Ternary, Call, Prop, ArrayLit,
  Gradient, Lambda, NumberLit, StringLit, ColorLit, Ident,
} from "./ast";
import type { CompileResult, ParamExtract, ColorExtract, LayerExtract } from "../index";
import { EASING_LIB, SHAPES_LIB, PALETTES_LIB } from "./libs";

const VERSION = "0.1.0";

export function codegen(program: Program): CompileResult {
  const params: ParamExtract[] = [];
  const colors: ColorExtract[] = [];
  const layers: LayerExtract[] = [];
  const usedLibs = new Set<string>();
  const errors: Array<{ line: number; col: number; message: string }> = [];

  // Collect param/color/layer declarations first
  for (const node of program.body) {
    if (node.kind === "param") {
      params.push({ key: node.name, label: node.label ?? node.name, min: node.min, max: node.max, step: node.step, default: node.default });
    } else if (node.kind === "color-decl") {
      colors.push({ key: node.name, label: node.label ?? node.name, default: node.default });
    } else if (node.kind === "layer") {
      layers.push(extractLayer(node));
    } else if (node.kind === "use") {
      usedLibs.add(node.lib);
    }
  }

  /** Track declared variables per scope depth to avoid duplicate `let`. */
  const declaredVars: Set<string>[] = [new Set()];

  function isDeclared(name: string): boolean {
    for (let i = declaredVars.length - 1; i >= 0; i--) {
      if (declaredVars[i]!.has(name)) return true;
    }
    return false;
  }

  function declare(name: string): void {
    declaredVars[declaredVars.length - 1]!.add(name);
  }

  const lines: string[] = [
    `// GenArt Script compiled output — compiler v${VERSION}`,
    `// DO NOT EDIT — generated from .genart-script source`,
    ``,
  ];

  // Param/color injections as globals
  for (const p of params) {
    lines.push(`let ${p.key} = __params__["${p.key}"] ?? ${p.default};`);
    declaredVars[0]!.add(p.key);
  }
  for (const c of colors) {
    lines.push(`let ${c.key} = __colors__["${c.key}"] ?? "${c.default}";`);
    declaredVars[0]!.add(c.key);
  }
  if (params.length || colors.length) lines.push(``);

  // Inline standard libraries requested via `use`
  if (usedLibs.has("easing")) { lines.push(EASING_LIB); lines.push(``); }
  if (usedLibs.has("shapes")) { lines.push(SHAPES_LIB); lines.push(``); }
  if (usedLibs.has("palettes")) { lines.push(PALETTES_LIB); lines.push(``); }

  // Separate top-level body into sections
  const staticStmts: Stmt[] = [];
  let onceBlock: BlockStmt | null = null;
  let frameBlock: BlockStmt | null = null;
  let postBlock: BlockStmt | null = null;
  const fnDecls: BlockStmt[] = [];

  for (const node of program.body) {
    if (node.kind === "block" && node.header.type === "once") { onceBlock = node; continue; }
    if (node.kind === "block" && node.header.type === "frame") { frameBlock = node; continue; }
    if (node.kind === "block" && node.header.type === "post") { postBlock = node; continue; }
    if (node.kind === "block" && node.header.type === "fn") { fnDecls.push(node); continue; }
    if (node.kind === "param" || node.kind === "color-decl" || node.kind === "layer" || node.kind === "use") continue;
    staticStmts.push(node as Stmt);
  }

  // Function declarations (hoisted)
  for (const fn of fnDecls) {
    const h = fn.header as Extract<BlockHeader, { type: "fn" }>;
    lines.push(`function ${h.name}(${h.params.join(", ")}) {`);
    emitBody(fn.body, lines, 1);
    lines.push(`}`);
    lines.push(``);
  }

  // Static top-level code
  if (staticStmts.length) {
    lines.push(`// --- static ---`);
    emitBody(staticStmts, lines, 0);
    lines.push(``);
  }

  // once: block — always async to support `await loadFont(...)` inside
  if (onceBlock) {
    lines.push(`// --- once: ---`);
    lines.push(`async function __once__(__ctx__) {`);
    lines.push(`  const ctx = __ctx__;`);
    emitBody(onceBlock.body, lines, 1);
    lines.push(`}`);
    lines.push(``);
  }

  // frame: block
  if (frameBlock) {
    lines.push(`// --- frame: ---`);
    lines.push(`function __frame__(__ctx__, t, frame, w, h, fps, mouseX, mouseY, mouseDown, pmouseX, pmouseY, touchX, touchY, touches, prev) {`);
    lines.push(`  const ctx = __ctx__;`);
    emitBody(frameBlock.body, lines, 1);
    lines.push(`}`);
    lines.push(``);
  }

  // post: block
  if (postBlock) {
    lines.push(`// --- post: ---`);
    lines.push(`function __post__(__ctx__, __renderContext__) {`);
    lines.push(`  const ctx = __ctx__;`);
    lines.push(`  __renderCtx__.value = __renderContext__;`);
    emitBody(postBlock.body, lines, 1);
    lines.push(`}`);
    lines.push(``);
  }

  // Export shape
  lines.push(`// runtime exports`);
  lines.push(`const __exports__ = {`);
  lines.push(`  isAnimated: ${frameBlock !== null},`);
  if (onceBlock) lines.push(`  once: __once__,`);
  if (frameBlock) lines.push(`  frame: __frame__,`);
  if (postBlock) lines.push(`  post: __post__,`);
  lines.push(`};`);

  const code = lines.join("\n");

  if (errors.length) return { ok: false, errors };
  return { ok: true, code, params, colors, layers };

  // ---------------------------------------------------------------------------
  // Emit helpers
  // ---------------------------------------------------------------------------

  function indent(n: number): string { return "  ".repeat(n); }

  function emitBody(stmts: Stmt[], out: string[], depth: number): void {
    for (const stmt of stmts) emitStmt(stmt, out, depth);
  }

  function emitStmt(stmt: Stmt, out: string[], d: number): void {
    const I = indent(d);
    switch (stmt.kind) {
      case "assign":
        if (isDeclared(stmt.name)) {
          out.push(`${I}${stmt.name} = ${emitExpr(stmt.value)};`);
        } else {
          declare(stmt.name);
          out.push(`${I}let ${stmt.name} = ${emitExpr(stmt.value)};`);
        }
        break;
      case "multi-assign":
        for (const p of stmt.pairs) {
          if (isDeclared(p.name)) {
            out.push(`${I}${p.name} = ${emitExpr(p.value)};`);
          } else {
            declare(p.name);
            out.push(`${I}let ${p.name} = ${emitExpr(p.value)};`);
          }
        }
        break;
      case "bg":
        out.push(`${I}ctx.fillStyle = ${emitColor(stmt.color)};`);
        out.push(`${I}ctx.fillRect(0, 0, w, h);`);
        break;
      case "draw-cmd":
        emitDrawCmd(stmt, out, d);
        break;
      case "block":
        emitBlock(stmt, out, d);
        break;
      case "use":
        // already handled at top level
        break;
      case "seed": {
        const ns = stmt.ns ? JSON.stringify(stmt.ns) : "null";
        out.push(`${I}__rnd__.seed(${ns}, ${emitExpr(stmt.value)});`);
        break;
      }
      case "return":
        out.push(`${I}return${stmt.value ? ` ${emitExpr(stmt.value)}` : ""};`);
        break;
      case "print":
        out.push(`${I}console.log(${stmt.values.map(emitExpr).join(", ")});`);
        break;
      case "watch":
        out.push(`${I}if (typeof __watch__ !== "undefined") __watch__(${JSON.stringify(stmt.label)}, ${emitExpr(stmt.value)});`);
        break;
      case "expr-stmt":
        out.push(`${I}${emitExpr(stmt.expr)};`);
        break;
    }
  }

  function emitDrawCmd(cmd: DrawCmd, out: string[], d: number): void {
    const I = indent(d);
    const p = cmd.positional;
    const n = (key: string): Expr | undefined => cmd.named.find(a => a.name === key)?.value;

    // Blend mode inline
    const blendExpr = n("blend");
    if (blendExpr) {
      out.push(`${I}ctx.save();`);
      out.push(`${I}ctx.globalCompositeOperation = ${emitExpr(blendExpr)};`);
    }

    switch (cmd.cmd) {
      case "circle": {
        const [x, y, r] = p;
        const rVal = r ? emitExpr(r) : n("r") ? emitExpr(n("r")!) : "10";
        const fill = n("fill");
        const stroke = n("stroke");
        const strokeW = p[3] ?? n("strokeWidth");
        out.push(`${I}ctx.beginPath();`);
        out.push(`${I}ctx.arc(${emitExpr(x!)}, ${emitExpr(y!)}, ${rVal}, 0, Math.PI * 2);`);
        if (fill) { out.push(`${I}ctx.fillStyle = ${emitColor(fill)};`); out.push(`${I}ctx.fill();`); }
        if (stroke) {
          out.push(`${I}ctx.strokeStyle = ${emitColor(stroke)};`);
          if (strokeW) out.push(`${I}ctx.lineWidth = ${emitExpr(strokeW)};`);
          out.push(`${I}ctx.stroke();`);
        }
        break;
      }
      case "rect": {
        const [x, y] = p;
        const w = n("w") ?? p[2];
        const h = n("h") ?? p[3];
        const fill = n("fill");
        const stroke = n("stroke");
        const rx = n("rx");
        out.push(`${I}ctx.beginPath();`);
        if (rx) {
          out.push(`${I}ctx.roundRect(${emitExpr(x!)}, ${emitExpr(y!)}, ${emitExpr(w!)}, ${emitExpr(h!)}, ${emitExpr(rx)});`);
        } else {
          out.push(`${I}ctx.rect(${emitExpr(x!)}, ${emitExpr(y!)}, ${emitExpr(w!)}, ${emitExpr(h!)});`);
        }
        if (fill) { out.push(`${I}ctx.fillStyle = ${emitColor(fill)};`); out.push(`${I}ctx.fill();`); }
        if (stroke) { out.push(`${I}ctx.strokeStyle = ${emitColor(stroke)};`); out.push(`${I}ctx.stroke();`); }
        break;
      }
      case "line": {
        const [x1, y1, x2, y2] = p;
        const stroke = n("stroke") ?? n("color");
        const strokeW = p[4] ?? n("strokeWidth");
        out.push(`${I}ctx.beginPath();`);
        out.push(`${I}ctx.moveTo(${emitExpr(x1!)}, ${emitExpr(y1!)});`);
        out.push(`${I}ctx.lineTo(${emitExpr(x2!)}, ${emitExpr(y2!)});`);
        if (stroke) { out.push(`${I}ctx.strokeStyle = ${emitColor(stroke)};`); }
        if (strokeW) { out.push(`${I}ctx.lineWidth = ${emitExpr(strokeW)};`); }
        out.push(`${I}ctx.stroke();`);
        break;
      }
      case "dot": {
        const [x, y] = p;
        const fill = n("fill") ?? n("color");
        out.push(`${I}ctx.beginPath();`);
        out.push(`${I}ctx.arc(${emitExpr(x!)}, ${emitExpr(y!)}, 1, 0, Math.PI * 2);`);
        if (fill) { out.push(`${I}ctx.fillStyle = ${emitColor(fill)};`); }
        out.push(`${I}ctx.fill();`);
        break;
      }
      case "poly": {
        const pts = p[0];
        const fill = n("fill");
        const stroke = n("stroke");
        out.push(`${I}ctx.beginPath();`);
        out.push(`${I}const __pts = ${emitExpr(pts!)};`);
        out.push(`${I}ctx.moveTo(__pts[0], __pts[1]);`);
        out.push(`${I}for (let __i = 2; __i < __pts.length; __i += 2) ctx.lineTo(__pts[__i], __pts[__i+1]);`);
        out.push(`${I}ctx.closePath();`);
        if (fill) { out.push(`${I}ctx.fillStyle = ${emitColor(fill)};`); out.push(`${I}ctx.fill();`); }
        if (stroke) { out.push(`${I}ctx.strokeStyle = ${emitColor(stroke)};`); out.push(`${I}ctx.stroke();`); }
        break;
      }
      case "path": {
        const d = p[0];
        const stroke = n("stroke");
        const fill = n("fill");
        const strokeW = p[1] ?? n("strokeWidth");
        out.push(`${I}const __p = new Path2D(${emitExpr(d!)});`);
        if (fill) { out.push(`${I}ctx.fillStyle = ${emitColor(fill)};`); out.push(`${I}ctx.fill(__p);`); }
        if (stroke) {
          out.push(`${I}ctx.strokeStyle = ${emitColor(stroke)};`);
          if (strokeW) out.push(`${I}ctx.lineWidth = ${emitExpr(strokeW)};`);
          out.push(`${I}ctx.stroke(__p);`);
        }
        break;
      }
      case "arc": {
        const [x, y] = p;
        const r = n("r") ?? p[2];
        const start = n("start") ?? p[3];
        const end = n("end") ?? p[4];
        const fill = n("fill");
        const stroke = n("stroke");
        out.push(`${I}ctx.beginPath();`);
        out.push(`${I}ctx.arc(${emitExpr(x!)}, ${emitExpr(y!)}, ${emitExpr(r!)}, ${emitExpr(start!)}, ${emitExpr(end!)});`);
        if (fill) { out.push(`${I}ctx.fillStyle = ${emitColor(fill)};`); out.push(`${I}ctx.fill();`); }
        if (stroke) { out.push(`${I}ctx.strokeStyle = ${emitColor(stroke)};`); out.push(`${I}ctx.stroke();`); }
        break;
      }
      case "draw": {
        // draw src x y [w:N h:N alpha:N blend:mode tint:color]
        const [src, x, y] = p;
        const w2 = n("w");
        const h2 = n("h");
        const alpha = n("alpha");
        const tint = n("tint");
        const needsSave = !!(alpha || tint);
        if (needsSave) out.push(`${I}ctx.save();`);
        if (alpha) out.push(`${I}ctx.globalAlpha = ${emitExpr(alpha)};`);
        const dw = w2 ? emitExpr(w2) : `${emitExpr(src!)}.width`;
        const dh = h2 ? emitExpr(h2) : `${emitExpr(src!)}.height`;
        const iStr = w2 && h2
          ? `${emitExpr(src!)}, ${emitExpr(x!)}, ${emitExpr(y!)}, ${emitExpr(w2)}, ${emitExpr(h2)}`
          : `${emitExpr(src!)}, ${emitExpr(x!)}, ${emitExpr(y!)}`;
        out.push(`${I}ctx.drawImage(${iStr});`);
        if (tint) {
          // Color multiply overlay — draw tint rect with "multiply" over the image area
          out.push(`${I}ctx.globalCompositeOperation = "multiply";`);
          out.push(`${I}ctx.fillStyle = ${emitColor(tint)};`);
          out.push(`${I}ctx.fillRect(${emitExpr(x!)}, ${emitExpr(y!)}, ${dw}, ${dh});`);
        }
        if (needsSave) out.push(`${I}ctx.restore();`);
        break;
      }
      case "text": {
        const [str, x, y] = p;
        const font = n("font");
        const size = n("size");
        const align = n("align");
        const fill = n("fill") ?? n("color");
        if (size || font) {
          const sz = size ? emitExpr(size) : "16";
          const ff = font ? `\${${emitExpr(font)}.family}` : "sans-serif";
          out.push(`${I}ctx.font = \`${sz}px ${ff}\`;`);
        }
        if (align) out.push(`${I}ctx.textAlign = ${emitExpr(align)};`);
        if (fill) out.push(`${I}ctx.fillStyle = ${emitColor(fill)};`);
        out.push(`${I}ctx.fillText(${emitExpr(str!)}, ${emitExpr(x!)}, ${emitExpr(y!)});`);
        break;
      }
    }

    if (blendExpr) out.push(`${I}ctx.restore();`);
  }

  function emitBlock(stmt: BlockStmt, out: string[], d: number): void {
    const I = indent(d);
    const h = stmt.header;

    switch (h.type) {
      case "at":
        out.push(`${I}ctx.save();`);
        out.push(`${I}ctx.translate(${emitExpr(h.x)}, ${emitExpr(h.y)});`);
        emitBody(stmt.body, out, d + 1);
        out.push(`${I}ctx.restore();`);
        break;
      case "rotate":
        out.push(`${I}ctx.save();`);
        out.push(`${I}ctx.rotate(${emitExpr(h.angle)});`);
        emitBody(stmt.body, out, d + 1);
        out.push(`${I}ctx.restore();`);
        break;
      case "scale":
        out.push(`${I}ctx.save();`);
        out.push(`${I}ctx.scale(${emitExpr(h.factor)}, ${emitExpr(h.factor)});`);
        emitBody(stmt.body, out, d + 1);
        out.push(`${I}ctx.restore();`);
        break;
      case "blend":
        out.push(`${I}ctx.save();`);
        out.push(`${I}ctx.globalCompositeOperation = "${h.mode}";`);
        emitBody(stmt.body, out, d + 1);
        out.push(`${I}ctx.restore();`);
        break;
      case "into":
        out.push(`${I}{`);
        out.push(`${indent(d+1)}const ctx = ${emitExpr(h.buffer)}.getContext("2d");`);
        emitBody(stmt.body, out, d + 1);
        out.push(`${I}}`);
        break;
      case "if":
        out.push(`${I}if (${emitExpr(h.cond)}) {`);
        emitBody(stmt.body, out, d + 1);
        if (h.elseBody) {
          out.push(`${I}} else {`);
          emitBody(h.elseBody, out, d + 1);
        }
        out.push(`${I}}`);
        break;
      case "loop":
        if (h.collect) {
          out.push(`${I}const __arr_${d}__ = Array.from({ length: ${emitExpr(h.count)} }, (_, i) => {`);
          emitBody(stmt.body, out, d + 1);
          out.push(`${I}});`);
        } else {
          out.push(`${I}for (let i = 0; i < ${emitExpr(h.count)}; i++) {`);
          emitBody(stmt.body, out, d + 1);
          out.push(`${I}}`);
        }
        break;
      case "for-in": {
        // Range: `for x in 0..w step:20:`
        // Check if iterable is a range (binop "..")
        const iter = h.iterable;
        if (iter.kind === "binop" && iter.op === "..") {
          const step = h.step ? emitExpr(h.step) : "1";
          out.push(`${I}for (let ${h.value} = ${emitExpr(iter.left)}; ${h.value} < ${emitExpr(iter.right)}; ${h.value} += ${step}) {`);
        } else if (h.iter) {
          out.push(`${I}let __idx_${d}__ = 0; for (const ${h.value} of ${emitExpr(iter)}) {`);
          out.push(`${indent(d+1)}const ${h.iter} = __idx_${d}__++;`);
        } else {
          out.push(`${I}for (const ${h.value} of ${emitExpr(iter)}) {`);
        }
        emitBody(stmt.body, out, d + 1);
        out.push(`${I}}`);
        break;
      }
      case "on": {
        const eventMap: Record<string, string> = { click: "click", drag: "pointermove", key: "keydown" };
        const evName = eventMap[h.event] ?? h.event;
        out.push(`${I}__canvas__.addEventListener("${evName}", (__event__) => {`);
        if (h.event === "key") out.push(`${indent(d+1)}if (__event__.key !== ${JSON.stringify(h.key)}) return;`);
        emitBody(stmt.body, out, d + 1);
        out.push(`${I}});`);
        break;
      }
      case "fn": // already hoisted
        break;
      case "frame": // handled at top level
      case "once":
      case "post":
        break;
    }
  }

  /** Recursively checks if an expression references the implicit `it` variable. */
  function containsIt(expr: Expr): boolean {
    switch (expr.kind) {
      case "ident": return expr.name === "it";
      case "binop": return containsIt(expr.left) || containsIt(expr.right);
      case "unary": return containsIt(expr.operand);
      case "ternary": return containsIt(expr.cond) || containsIt(expr.then) || containsIt(expr.else);
      case "call": return containsIt(expr.callee) || expr.args.some(containsIt);
      case "prop": return containsIt(expr.object);
      case "index": return containsIt(expr.object) || containsIt(expr.index);
      case "array": return expr.elements.some(containsIt);
      case "lambda": return false; // `it` inside explicit lambda is scoped
      default: return false;
    }
  }

  function emitExpr(expr: Expr): string {
    switch (expr.kind) {
      case "number": return String(expr.value);
      case "string": return JSON.stringify(expr.value);
      case "bool": return String(expr.value);
      case "ident": return expr.name;
      case "color": return emitColor(expr);
      case "binop": {
        const op = expr.op === "**" ? "**" : expr.op;
        return `(${emitExpr(expr.left)} ${op} ${emitExpr(expr.right)})`;
      }
      case "unary": return `(${expr.op}${emitExpr(expr.operand)})`;
      case "ternary": return `(${emitExpr(expr.cond)} ? ${emitExpr(expr.then)} : ${emitExpr(expr.else)})`;
      case "call": {
        // Auto-wrap args containing implicit `it` in a lambda: arr.map(it * 2) → arr.map((it) => it * 2)
        const args = expr.args.map(arg =>
          arg.kind !== "lambda" && containsIt(arg)
            ? `(it) => ${emitExpr(arg)}`
            : emitExpr(arg)
        );
        return `${emitExpr(expr.callee)}(${args.join(", ")})`;
      }
      case "prop":
        // Map .each → .forEach (GenArt Script uses `.each`, JS uses `.forEach`)
        return `${emitExpr(expr.object)}.${expr.prop === "each" ? "forEach" : expr.prop}`;
      case "index": return `${emitExpr(expr.object)}[${emitExpr(expr.index)}]`;
      case "array": return `[${expr.elements.map(emitExpr).join(", ")}]`;
      case "lambda": {
        const params = expr.params.length === 1 && expr.params[0] === "it" ? ["it"] : expr.params;
        return `(${params.join(", ")}) => ${emitExpr(expr.body)}`;
      }
      case "gradient": return emitGradient(expr);
    }
  }

  function emitColor(expr: Expr): string {
    if (expr.kind === "color") {
      if (expr.alpha !== undefined) {
        // Convert named or hex to rgba
        return `__colorAlpha__(${JSON.stringify(expr.value)}, ${expr.alpha / 100})`;
      }
      return JSON.stringify(expr.value);
    }
    // Variable that holds a color string
    return emitExpr(expr);
  }

  function extractLayer(node: LayerDecl): LayerExtract {
    const extract: LayerExtract = { type: node.type, preset: node.preset };
    for (const arg of node.named) {
      switch (arg.name) {
        case "name":
          extract.name = (arg.value as StringLit).value;
          break;
        case "opacity":
          if (arg.value.kind === "number") {
            extract.opacity = (arg.value as NumberLit).value;
          } else if (arg.value.kind === "ident") {
            // Param reference — store the param name for runtime resolution
            extract.opacityParam = (arg.value as Ident).name;
            // Use the param's default value as the initial opacity
            const paramDef = params.find(p => p.key === (arg.value as Ident).name);
            extract.opacity = paramDef ? paramDef.default : 1;
          }
          break;
        case "blend":
          extract.blend = (arg.value as StringLit).value;
          break;
        case "visible":
          extract.visible = arg.value.kind === "ident" && (arg.value as Ident).name === "true";
          break;
      }
    }
    return extract;
  }

  function emitGradient(g: Gradient): string {
    const stops = g.stops.map(emitColor);
    if (g.type === "linear") {
      const angle = g.angle ? emitExpr(g.angle) : "0";
      return `__linearGradient__(${angle}, [${stops.join(", ")}])`;
    } else {
      const cx = g.cx ? emitExpr(g.cx) : "w/2";
      const cy = g.cy ? emitExpr(g.cy) : "h/2";
      return `__radialGradient__(${cx}, ${cy}, [${stops.join(", ")}])`;
    }
  }
}
