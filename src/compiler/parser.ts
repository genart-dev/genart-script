import type { Token } from "./token";
import type {
  Program, TopLevel, Stmt, Expr, BlockHeader, NamedArg, Metadata,
  DrawCmd, BlockStmt, ParamDecl, ColorDecl, LayerDecl, LibraryDecl, Assign, MultiAssign,
  BgCmd, UseStmt, UseComponentStmt, SeedStmt, ReturnStmt, PrintStmt, WatchStmt,
  ExprStmt, Loc, NumberLit, StringLit, ColorLit, Ident,
  BinOp, UnaryOp, Ternary, Call, Prop, ArrayLit, ObjectLit, Gradient, Lambda,
} from "./ast";

const DRAW_CMDS = new Set(["circle", "rect", "line", "dot", "poly", "path", "arc", "draw", "text"]);
const BLEND_MODES = new Set([
  "normal", "multiply", "screen", "overlay", "darken", "lighten",
  "color-dodge", "color-burn", "hard-light", "soft-light",
  "difference", "exclusion", "hue", "saturation", "color", "luminosity",
  "add",
]);

export class ParseError extends Error {
  constructor(msg: string, public loc: Loc) { super(`${msg} (${loc.line}:${loc.col})`); }
}

export function parse(tokens: Token[]): Program {
  let pos = 0;

  function cur(): Token { return tokens[pos] ?? { kind: "eof", value: "", line: 0, col: 0 }; }
  function loc(): Loc { return { line: cur().line, col: cur().col }; }

  function peek(offset = 0): Token {
    return tokens[pos + offset] ?? { kind: "eof", value: "", line: 0, col: 0 };
  }

  function eat(kind?: string, value?: string): Token {
    const t = cur();
    if (kind && t.kind !== kind) throw new ParseError(`Expected ${kind}, got ${t.kind} "${t.value}"`, loc());
    if (value && t.value !== value) throw new ParseError(`Expected "${value}", got "${t.value}"`, loc());
    pos++;
    return t;
  }

  function check(kind: string, value?: string): boolean {
    const t = cur();
    return t.kind === kind && (value === undefined || t.value === value);
  }

  function skipNewlines(): void {
    while (check("newline")) pos++;
  }

  function eatNewline(): void {
    if (check("newline")) pos++;
  }

  const METADATA_KEYS = new Set(["title", "subtitle", "philosophy", "compositionLevel"]);
  const COMPOSITION_LEVELS = new Set(["minimal", "simple", "moderate", "complex", "extreme"]);

  /**
   * Consume all tokens until newline/eof and reconstruct the original text.
   * Preserves adjacency (no space between `Per` `-` `layer`) using column positions.
   * If first token is a quoted string, returns it directly (allows special chars).
   */
  function parseRestOfLine(): string {
    if (check("string")) return eat("string").value;
    let result = "";
    let lastEnd = -1;
    while (!check("newline") && !check("eof") && !check("dedent")) {
      const t = cur();
      pos++;
      const tokenCol = t.col; // 1-based
      // Add space only if there's a gap between this token and the previous one
      if (lastEnd >= 0 && tokenCol > lastEnd) result += " ";
      result += t.value;
      // Estimate end column: col + length of the token's text representation
      lastEnd = tokenCol + t.value.length;
    }
    return result;
  }

  /**
   * Parse a bare identifier or quoted string.
   * Bare idents can include hyphens (`bristle-stroke-renderer`)
   * and colons (`terrain:sky`). Quoted strings are always accepted.
   */
  function parseBareString(): string {
    if (check("string")) return eat("string").value;
    let result = eat("ident").value;
    while (true) {
      if (check("op", "-") && peek(1).kind === "ident") {
        eat("op", "-");
        result += "-" + eat("ident").value;
      } else if (check("op", ":") && peek(1).kind === "ident") {
        eat("op", ":");
        result += ":" + eat("ident").value;
      } else {
        break;
      }
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Block body: consumes indent … dedent
  // ---------------------------------------------------------------------------
  function parseBlock(): Stmt[] {
    eat("indent");
    const stmts: Stmt[] = [];
    skipNewlines();
    while (!check("dedent") && !check("eof")) {
      stmts.push(...parseStmt());
      skipNewlines();
    }
    if (check("dedent")) eat("dedent");
    return stmts;
  }

  // ---------------------------------------------------------------------------
  // Statements
  // ---------------------------------------------------------------------------
  function parseStmt(): Stmt[] {
    skipNewlines();
    const t = cur();

    if (t.kind === "ident") {
      const name = t.value;

      // param declaration
      if (name === "param") return [parseParamDecl() as unknown as Stmt];
      // color declaration
      if (name === "color" && peek(1).kind === "ident") return [parseColorDecl() as unknown as Stmt];
      // layer declaration
      if (name === "layer") return [parseLayerDecl() as unknown as Stmt];

      // use easing|shapes|palettes  OR  use "component-name"  OR  use component-name
      if (name === "use") {
        pos++;
        const l = { line: t.line, col: t.col };
        // Known standard libraries (bare ident followed by newline/eof)
        const LIBS = new Set(["easing", "shapes", "palettes"]);
        if (check("ident") && LIBS.has(cur().value) &&
            (peek(1).kind === "newline" || peek(1).kind === "eof")) {
          const lib = eat("ident").value as UseStmt["lib"];
          eatNewline();
          return [{ kind: "use", lib, loc: l }];
        }
        // Quoted or bare component name
        const componentName = parseBareString();
        eatNewline();
        return [{ kind: "use-component", name: componentName, loc: l } as UseComponentStmt];
      }

      // library "name" [version:"x.y.z"]
      if (name === "library") {
        pos++;
        const l = { line: t.line, col: t.col };
        const libName = eat("string").value;
        let version: string | undefined;
        if (check("ident") && cur().value === "version") {
          eat("ident", "version");
          eat("op", ":");
          version = eat("string").value;
        }
        eatNewline();
        return [{ kind: "library", name: libName, version, loc: l } as LibraryDecl];
      }

      // seed
      if (name === "seed") {
        pos++;
        const l = loc();
        let ns: string | undefined;
        if (check("string")) ns = eat("string").value;
        const value = parseExpr();
        eatNewline();
        return [{ kind: "seed", ns, value, loc: l }];
      }

      // bg
      if (name === "bg") {
        pos++;
        const l = loc();
        const color = parseExpr();
        eatNewline();
        return [{ kind: "bg", color, loc: l }];
      }

      // return
      if (name === "return") {
        pos++;
        const l = loc();
        let value: Expr | undefined;
        if (!check("newline") && !check("dedent") && !check("eof")) value = parseExpr();
        eatNewline();
        return [{ kind: "return", value, loc: l }];
      }

      // print
      if (name === "print") {
        pos++;
        const l = loc();
        const values: Expr[] = [];
        while (!check("newline") && !check("dedent") && !check("eof")) values.push(parseExpr());
        eatNewline();
        return [{ kind: "print", values, loc: l }];
      }

      // watch
      if (name === "watch") {
        pos++;
        const l = loc();
        const label = eat("string").value;
        const value = parseExpr();
        eatNewline();
        return [{ kind: "watch", label, value, loc: l }];
      }

      // draw commands
      if (DRAW_CMDS.has(name)) return [parseDrawCmd()];

      // block keywords
      if (["frame", "once", "post", "at", "rotate", "scale", "blend", "into", "on", "fn", "if", "else", "loop", "for"].includes(name)) {
        return [parseBlockStmt()];
      }

      // `let x = expr` — skip the `let` keyword, parse as normal assignment
      if (name === "let" && peek(1).kind === "ident" && peek(2).kind === "op" && peek(2).value === "=") {
        pos++; // skip `let`
        return [parseAssign()];
      }

      // multi-assign: `x = 1, y = 2`
      if (peek(1).kind === "op" && peek(1).value === "=" && peek(2).kind !== undefined) {
        // Check for multi-assign pattern (comma after first rhs)
        return [parseAssign()];
      }
    }

    // expression statement
    const e = parseExpr();
    eatNewline();
    return [{ kind: "expr-stmt", expr: e, loc: { line: t.line, col: t.col } }];
  }

  // ---------------------------------------------------------------------------
  // param / color declarations
  // ---------------------------------------------------------------------------
  function parseParamDecl(): ParamDecl {
    const l = loc();
    eat("ident", "param");
    const name = eat("ident").value;
    const def = parseExpr(); // default value
    let min = 0, max = 100, step = 1, label: string | undefined, group: string | undefined;
    while (!check("newline") && !check("eof") && !check("dedent")) {
      const key = eat("ident").value;
      eat("op", ":");
      if (key === "range") {
        // parseExpr may produce a range BinOp (10..500) or we may need to eat ".." separately
        const rangeExpr = parseExpr();
        if (rangeExpr.kind === "binop" && rangeExpr.op === "..") {
          min = (rangeExpr.left as NumberLit).value;
          max = (rangeExpr.right as NumberLit).value;
        } else {
          min = (rangeExpr as NumberLit).value;
          if (check("op", "..")) { eat("op", ".."); }
          max = (parseExpr() as NumberLit).value;
        }
      } else if (key === "step") {
        step = (parseExpr() as NumberLit).value;
      } else if (key === "label") {
        label = eat("string").value;
      } else if (key === "group") {
        group = parseBareString();
      }
    }
    eatNewline();
    return { kind: "param", name, default: (def as NumberLit).value, min, max, step, label, group, loc: l };
  }

  function parseColorDecl(): ColorDecl {
    const l = loc();
    eat("ident", "color");
    const name = eat("ident").value;
    const defExpr = parseExpr();
    const defColor = (defExpr as ColorLit).value;
    let label: string | undefined;
    if (!check("newline") && !check("eof") && !check("dedent")) {
      const key = eat("ident").value;
      if (key === "label") {
        eat("op", ":");
        label = eat("string").value;
      }
    }
    eatNewline();
    return { kind: "color-decl", name, default: defColor, label, loc: l };
  }

  function parseLayerDecl(): LayerDecl {
    const l = loc();
    eat("ident", "layer");
    const type = parseBareString();
    const preset = parseBareString();
    const named: NamedArg[] = [];
    while (!check("newline") && !check("eof") && !check("dedent")) {
      if (cur().kind === "ident" && peek(1).kind === "op" && peek(1).value === ":") {
        const argLoc = loc();
        const key = eat("ident").value;
        eat("op", ":");
        const val = parseSimpleExpr();
        named.push({ name: key, value: val, loc: argLoc });
      } else {
        break;
      }
    }
    eatNewline();
    return { kind: "layer", type, preset, named, loc: l };
  }

  // ---------------------------------------------------------------------------
  // Assignment
  // ---------------------------------------------------------------------------
  function parseAssign(): Assign | MultiAssign {
    const l = loc();
    const firstName = eat("ident").value;
    eat("op", "=");
    const firstVal = parseExpr();

    // check for multi-assign: `, y = expr`
    if (check("op", ",")) {
      const pairs: Array<{ name: string; value: Expr }> = [{ name: firstName, value: firstVal }];
      while (check("op", ",")) {
        eat("op", ",");
        const n = eat("ident").value;
        eat("op", "=");
        pairs.push({ name: n, value: parseExpr() });
      }
      eatNewline();
      return { kind: "multi-assign", pairs, loc: l };
    }

    eatNewline();
    return { kind: "assign", name: firstName, value: firstVal, loc: l };
  }

  // ---------------------------------------------------------------------------
  // Draw command: `circle x y r:20 fill:red stroke:#000 1.5`
  // ---------------------------------------------------------------------------
  function parseDrawCmd(): DrawCmd {
    const l = loc();
    const cmd = eat("ident").value as DrawCmd["cmd"];
    const positional: Expr[] = [];
    const named: NamedArg[] = [];

    while (!check("newline") && !check("eof") && !check("dedent")) {
      // named arg: `key:value` (ident followed immediately by colon)
      if (cur().kind === "ident" && peek(1).kind === "op" && peek(1).value === ":") {
        const argLoc = loc();
        const key = eat("ident").value;
        eat("op", ":");
        const val = parseSimpleExpr(); // full expression for named arg values
        named.push({ name: key, value: val, loc: argLoc });
      } else {
        positional.push(parseDrawArg());
      }
    }

    eatNewline();
    return { kind: "draw-cmd", cmd, positional, named, loc: l };
  }

  // ---------------------------------------------------------------------------
  // Block statement
  // ---------------------------------------------------------------------------
  function parseBlockStmt(): BlockStmt {
    const l = loc();
    const keyword = eat("ident").value;
    let header: BlockHeader;

    switch (keyword) {
      case "frame": { eat("op", ":"); header = { type: "frame" }; break; }
      case "once":  { eat("op", ":"); header = { type: "once" }; break; }
      case "post":  { eat("op", ":"); header = { type: "post" }; break; }
      case "at": {
        const x = parseSimpleExpr();
        const y = parseSimpleExpr();
        eat("op", ":");
        header = { type: "at", x, y };
        break;
      }
      case "rotate": {
        const angle = parseSimpleExpr();
        eat("op", ":");
        header = { type: "rotate", angle };
        break;
      }
      case "scale": {
        const factor = parseSimpleExpr();
        eat("op", ":");
        header = { type: "scale", factor };
        break;
      }
      case "blend": {
        const mode = eat("ident").value;
        eat("op", ":");
        header = { type: "blend", mode };
        break;
      }
      case "into": {
        const buffer = parseSimpleExpr();
        eat("op", ":");
        header = { type: "into", buffer };
        break;
      }
      case "if": {
        const cond = parseExpr();
        eat("op", ":");
        eatNewline();
        const body = parseBlock();
        let elseBody: Stmt[] | undefined;
        skipNewlines();
        if (cur().kind === "ident" && cur().value === "else") {
          eat("ident", "else");
          eat("op", ":");
          eatNewline();
          elseBody = parseBlock();
        }
        return { kind: "block", header: { type: "if", cond, elseBody }, body, loc: l };
      }
      case "loop": {
        const count = parseSimpleExpr();
        let collect = false;
        if (check("op", "=>")) { eat("op", "=>"); collect = true; }
        else { eat("op", ":"); }
        header = { type: "loop", count, collect };
        break;
      }
      case "for": {
        // `for v in arr:` or `for i, v in arr:` or `for x in 0..w step:20:`
        const firstName = eat("ident").value;
        let iterName: string | undefined;
        let valueName = firstName;
        if (check("op", ",")) {
          eat("op", ",");
          iterName = firstName;
          valueName = eat("ident").value;
        }
        eat("ident", "in");
        const iterable = parseExpr();
        let step: Expr | undefined;
        if (cur().kind === "ident" && cur().value === "step") {
          eat("ident", "step");
          eat("op", ":");
          step = parseSimpleExpr();
        }
        eat("op", ":");
        header = { type: "for-in", value: valueName, iter: iterName, iterable, step };
        break;
      }
      case "on": {
        const event = eat("ident").value;
        let key: string | undefined;
        if (check("string")) key = eat("string").value;
        eat("op", ":");
        header = { type: "on", event, key };
        break;
      }
      case "fn": {
        const name = eat("ident").value;
        const params: string[] = [];
        while (!check("op", ":") && !check("eof")) params.push(eat("ident").value);
        eat("op", ":");
        header = { type: "fn", name, params };
        break;
      }
      default:
        throw new ParseError(`Unknown block keyword "${keyword}"`, l);
    }

    eatNewline();
    const body = parseBlock();
    return { kind: "block", header, body, loc: l };
  }

  // ---------------------------------------------------------------------------
  // Expressions
  // ---------------------------------------------------------------------------

  /** Full expression with ternary and binary ops. */
  function parseExpr(): Expr {
    return parseTernary();
  }

  function parseTernary(): Expr {
    const left = parseOr();
    if (check("op", "?")) {
      const l = loc();
      eat("op", "?");
      const then = parseOr();
      eat("op", ":");
      const els = parseOr();
      return { kind: "ternary", cond: left, then, else: els, loc: l };
    }
    return left;
  }

  function parseOr(): Expr { return parseBinary(parseAnd, ["||"]); }
  function parseAnd(): Expr { return parseBinary(parseEquality, ["&&"]); }
  function parseEquality(): Expr { return parseBinary(parseRelational, ["==", "!="]); }
  function parseRelational(): Expr { return parseBinary(parseRange, ["<", ">", "<=", ">="]); }
  function parseRange(): Expr { return parseBinary(parseAdd, [".."]); }
  function parseAdd(): Expr { return parseBinary(parseMul, ["+", "-"]); }
  function parseMul(): Expr { return parseBinary(parsePow, ["*", "/", "%"]); }
  function parsePow(): Expr { return parseBinary(parseUnary, ["**"]); }

  function parseBinary(lower: () => Expr, ops: string[]): Expr {
    let left = lower();
    while (check("op") && ops.includes(cur().value)) {
      const l = loc();
      const op = eat("op").value as BinOp["op"];
      const right = lower();
      left = { kind: "binop", op, left, right, loc: l };
    }
    return left;
  }

  function parseUnary(): Expr {
    if (check("op", "-")) {
      const l = loc();
      eat("op", "-");
      return { kind: "unary", op: "-", operand: parseUnary(), loc: l };
    }
    if (check("op", "!")) {
      const l = loc();
      eat("op", "!");
      return { kind: "unary", op: "!", operand: parseUnary(), loc: l };
    }
    return parsePostfix();
  }

  function parsePostfix(): Expr {
    let expr = parsePrimary();
    while (true) {
      if (check("op", ".")) {
        const l = loc();
        eat("op", ".");
        if (cur().kind === "number") {
          // numeric index: .0, .1
          const idx = eat("number");
          expr = { kind: "index", object: expr, index: { kind: "number", value: Number(idx.value), loc: l }, loc: l };
        } else if (cur().kind === "ident") {
          const prop = eat("ident").value;
          expr = { kind: "prop", object: expr, prop, loc: l };
        }
      } else if (check("lbracket")) {
        const l = loc();
        eat("lbracket");
        const index = parseExpr();
        eat("rbracket");
        expr = { kind: "index", object: expr, index, loc: l };
      } else if (check("lparen")) {
        const l = loc();
        eat("lparen");
        const args: Expr[] = [];
        while (!check("rparen") && !check("eof")) {
          args.push(parseExpr());
          if (check("op", ",")) eat("op", ",");
        }
        eat("rparen");
        expr = { kind: "call", callee: expr, args, loc: l };
      } else {
        break;
      }
    }
    return expr;
  }

  function parsePrimary(): Expr {
    const t = cur();
    const l = loc();

    if (t.kind === "number") {
      pos++;
      return { kind: "number", value: Number(t.value), loc: l };
    }

    if (t.kind === "string") {
      pos++;
      return { kind: "string", value: t.value, loc: l };
    }

    if (t.kind === "color") {
      pos++;
      // check for alpha: the tokenizer already emits dot+number tokens after color
      let alpha: number | undefined;
      if (check("op", ".") && peek(1).kind === "number") {
        eat("op", ".");
        alpha = Number(eat("number").value);
      }
      return { kind: "color", value: t.value, alpha, loc: l };
    }

    // $varname color variable reference with optional alpha shorthand
    if (t.kind === "color-ref") {
      pos++;
      const varName = t.value;
      // check for alpha shorthand: $star.08
      if (check("op", ".") && peek(1).kind === "number") {
        eat("op", ".");
        const alpha = Number(eat("number").value);
        // Emit as a call: __colorAlpha__(varname, alpha/100)
        return {
          kind: "call",
          callee: { kind: "ident", name: "__colorAlpha__", loc: l },
          args: [
            { kind: "ident", name: varName, loc: l },
            { kind: "number", value: alpha / 100, loc: l },
          ],
          loc: l,
        };
      }
      // No alpha — just a reference to the color variable
      return { kind: "ident", name: varName, loc: l };
    }

    if (t.kind === "lparen") {
      // Could be lambda `(x, y) =>` or grouped expr `(expr)`
      eat("lparen");
      if (cur().kind === "ident" && (peek(1).kind === "rparen" || (peek(1).kind === "op" && peek(1).value === ",")) ) {
        // Try lambda parse
        const params: string[] = [];
        while (!check("rparen")) {
          params.push(eat("ident").value);
          if (check("op", ",")) eat("op", ",");
        }
        eat("rparen");
        if (check("op", "=>")) {
          eat("op", "=>");
          const body = parseExpr();
          return { kind: "lambda", params, body, loc: l };
        }
        // Not a lambda — reconstruct (fall through won't work cleanly, so treat single ident as grouped)
        const ident: Ident = { kind: "ident", name: params[0]!, loc: l };
        return ident;
      }
      const inner = parseExpr();
      eat("rparen");
      return inner;
    }

    if (t.kind === "lbracket") {
      eat("lbracket");
      const elements: Expr[] = [];
      while (!check("rbracket") && !check("eof")) {
        elements.push(parseExpr());
        if (check("op", ",")) eat("op", ",");
      }
      eat("rbracket");
      return { kind: "array", elements, loc: l };
    }

    if (t.kind === "lbrace") {
      eat("lbrace");
      const entries: Array<{ key: string; value: Expr }> = [];
      while (!check("rbrace") && !check("eof")) {
        const key = eat("ident").value;
        eat("op", ":");
        const value = parseExpr();
        entries.push({ key, value });
        if (check("op", ",")) eat("op", ",");
      }
      eat("rbrace");
      return { kind: "object", entries, loc: l } as ObjectLit;
    }

    if (t.kind === "ident") {
      const name = t.value;

      // gradient constructors
      if (name === "linear" || name === "radial") {
        pos++;
        eat("lparen");
        const stops: Expr[] = [];
        let angle: Expr | undefined;
        let cx: Expr | undefined, cy: Expr | undefined;

        while (!check("rparen") && !check("eof")) {
          // named args inside gradient
          if (cur().kind === "ident" && peek(1).kind === "op" && peek(1).value === ":") {
            const key = eat("ident").value;
            eat("op", ":");
            const val = parseExpr();
            if (key === "angle") angle = val;
            else if (key === "cx") cx = val;
            else if (key === "cy") cy = val;
          } else {
            stops.push(parseExpr());
          }
          if (check("op", ",")) eat("op", ",");
        }
        eat("rparen");
        return { kind: "gradient", type: name as "linear" | "radial", stops, angle, cx, cy, loc: l };
      }

      // `it` implicit lambda variable
      if (name === "it") {
        pos++;
        return { kind: "ident", name: "it", loc: l };
      }

      pos++;
      return { kind: "ident", name, loc: l };
    }

    throw new ParseError(`Unexpected token ${t.kind} "${t.value}"`, l);
  }

  /**
   * Simple expression — stops before named-arg colons.
   * Used in block headers to avoid consuming `fill:`.
   */
  function parseSimpleExpr(): Expr {
    return parseTernary();
  }

  /**
   * Draw-command positional arg — like a full expression but `-` is NOT
   * consumed as binary subtraction at the top level. This makes
   * `rect -25 -25` parse as two positional args instead of `(-25) - (-25)`.
   * Other binary ops (/, *, +, %, **) still work: `circle w/2 h/2 r:100`.
   * For subtraction, wrap in parens: `rect (x - 5) (y - 10)`.
   */
  function parseDrawArg(): Expr {
    // Use parseAdd variant that only allows `+` (not `-`)
    return parseBinary(parseMul, ["+"]);
  }

  // ---------------------------------------------------------------------------
  // Top-level
  // ---------------------------------------------------------------------------
  function parseTopLevel(): TopLevel[] {
    skipNewlines();
    const t = cur();

    if (t.kind === "ident" && t.value === "param") return [parseParamDecl()];
    if (t.kind === "ident" && t.value === "color" && peek(1).kind === "ident") return [parseColorDecl()];
    if (t.kind === "ident" && t.value === "layer") return [parseLayerDecl()];

    return parseStmt() as unknown as TopLevel[];
  }

  /** Current group set by `group "label"` directives. Applied to subsequent params. */
  let currentGroup: string | undefined;

  /** Metadata from header directives. */
  const metadata: Metadata = {};

  const body: TopLevel[] = [];
  while (!check("eof")) {
    skipNewlines();
    if (check("eof")) break;

    // Metadata header directives: title, subtitle, philosophy, compositionLevel
    if (cur().kind === "ident" && METADATA_KEYS.has(cur().value)) {
      const key = eat("ident").value;
      const value = parseRestOfLine();
      if (key === "compositionLevel") {
        if (COMPOSITION_LEVELS.has(value)) {
          metadata.compositionLevel = value as Metadata["compositionLevel"];
        } else {
          throw new ParseError(`Invalid compositionLevel "${value}" — expected minimal, simple, moderate, complex, or extreme`, loc());
        }
      } else {
        (metadata as Record<string, string>)[key] = value;
      }
      eatNewline();
      continue;
    }

    // `group "label"` or `group Label` directive — sets group for subsequent params
    if (cur().kind === "ident" && cur().value === "group" &&
        (peek(1).kind === "string" || peek(1).kind === "ident")) {
      pos++; // skip `group`
      const groupName = parseBareString();
      currentGroup = groupName || undefined;
      eatNewline();
      continue;
    }

    const nodes = parseTopLevel();
    // Apply current group to param declarations that don't have an inline group
    for (const node of nodes) {
      if (node.kind === "param" && node.group === undefined && currentGroup !== undefined) {
        (node as ParamDecl).group = currentGroup;
      }
    }
    body.push(...nodes);
  }

  return { body, metadata };
}
