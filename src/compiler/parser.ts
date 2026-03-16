import type { Token } from "./token";
import type {
  Program, TopLevel, Stmt, Expr, BlockHeader, NamedArg,
  DrawCmd, BlockStmt, ParamDecl, ColorDecl, LayerDecl, Assign, MultiAssign,
  BgCmd, UseStmt, SeedStmt, ReturnStmt, PrintStmt, WatchStmt,
  ExprStmt, Loc, NumberLit, StringLit, ColorLit, Ident,
  BinOp, UnaryOp, Ternary, Call, Prop, ArrayLit, Gradient, Lambda,
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

      // use easing|shapes|palettes
      if (name === "use") {
        pos++;
        const lib = eat("ident").value as UseStmt["lib"];
        eatNewline();
        return [{ kind: "use", lib, loc: { line: t.line, col: t.col } }];
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
    let min = 0, max = 100, step = 1, label: string | undefined;
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
      }
    }
    eatNewline();
    return { kind: "param", name, default: (def as NumberLit).value, min, max, step, label, loc: l };
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
    const type = eat("string").value;
    const preset = eat("string").value;
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
        const val = parseSimpleExpr(); // no comma ambiguity
        named.push({ name: key, value: val, loc: argLoc });
      } else {
        positional.push(parseSimpleExpr());
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
   * Used in draw commands and block headers to avoid consuming `fill:`.
   */
  function parseSimpleExpr(): Expr {
    // Same as parseExpr but we stop when we see ident:
    // We achieve this by checking if the result is followed by ident + colon
    return parseTernary();
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

  const body: TopLevel[] = [];
  while (!check("eof")) {
    skipNewlines();
    if (check("eof")) break;
    body.push(...parseTopLevel());
  }

  return { body };
}
