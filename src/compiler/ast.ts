/** Source location attached to every AST node. */
export interface Loc { line: number; col: number; }

// ---------------------------------------------------------------------------
// Expressions
// ---------------------------------------------------------------------------

export type Expr =
  | NumberLit
  | StringLit
  | ColorLit
  | BoolLit
  | Ident
  | BinOp
  | UnaryOp
  | Ternary
  | Call
  | Index
  | Prop
  | ArrayLit
  | Gradient
  | Lambda;

export interface NumberLit { kind: "number"; value: number; loc: Loc; }
export interface StringLit { kind: "string"; value: string; loc: Loc; }
/** Color value: hex string or named color, with optional alpha 0–100. */
export interface ColorLit { kind: "color"; value: string; alpha?: number; loc: Loc; }
export interface BoolLit { kind: "bool"; value: boolean; loc: Loc; }
export interface Ident { kind: "ident"; name: string; loc: Loc; }

export interface BinOp {
  kind: "binop";
  op: "+" | "-" | "*" | "/" | "%" | "**" | "==" | "!=" | "<" | ">" | "<=" | ">=" | ".." | "&&" | "||";
  left: Expr;
  right: Expr;
  loc: Loc;
}

export interface UnaryOp {
  kind: "unary";
  op: "-" | "!";
  operand: Expr;
  loc: Loc;
}

export interface Ternary {
  kind: "ternary";
  cond: Expr;
  then: Expr;
  else: Expr;
  loc: Loc;
}

/** Function call: `rgb(r,g,b)`, `noise(x,y)`, `sin(t)`, etc. */
export interface Call {
  kind: "call";
  callee: Expr;
  args: Expr[];
  loc: Loc;
}

/** Array index: `arr.0`, `arr.1` (also handles `.x` / `.y` on vec). */
export interface Index {
  kind: "index";
  object: Expr;
  index: Expr;
  loc: Loc;
}

/** Property access: `terrain.height`, `vec.mag`. */
export interface Prop {
  kind: "prop";
  object: Expr;
  prop: string;
  loc: Loc;
}

/** Array literal: `[a, b, c]`. */
export interface ArrayLit {
  kind: "array";
  elements: Expr[];
  loc: Loc;
}

/** Gradient: `linear(c1, c2)`, `radial(c1, c2, cx:N cy:N)`. */
export interface Gradient {
  kind: "gradient";
  type: "linear" | "radial";
  stops: Expr[];
  angle?: Expr;       // linear only
  cx?: Expr; cy?: Expr; // radial only
  loc: Loc;
}

/** Lambda: `(x, y) => expr` or `it => expr`. */
export interface Lambda {
  kind: "lambda";
  params: string[];
  body: Expr;
  loc: Loc;
}

// ---------------------------------------------------------------------------
// Named arguments (keyword args on draw commands)
// ---------------------------------------------------------------------------

export interface NamedArg { name: string; value: Expr; loc: Loc; }

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

export type Stmt =
  | Assign
  | MultiAssign
  | DrawCmd
  | BgCmd
  | BlockStmt
  | UseStmt
  | SeedStmt
  | ReturnStmt
  | PrintStmt
  | WatchStmt
  | ExprStmt;

/** `x = expr` */
export interface Assign {
  kind: "assign";
  name: string;
  value: Expr;
  loc: Loc;
}

/** `x = 1, y = 2` */
export interface MultiAssign {
  kind: "multi-assign";
  pairs: Array<{ name: string; value: Expr }>;
  loc: Loc;
}

/**
 * Drawing primitive statement.
 * Positional args + named keyword args.
 * e.g. `circle x y r:20 fill:red stroke:#000 1.5`
 */
export interface DrawCmd {
  kind: "draw-cmd";
  cmd: "circle" | "rect" | "line" | "dot" | "poly" | "path" | "arc" | "draw" | "text";
  positional: Expr[];
  named: NamedArg[];
  loc: Loc;
}

/** `bg C` */
export interface BgCmd {
  kind: "bg";
  color: Expr;
  loc: Loc;
}

/**
 * Block-opening statement: `frame:`, `once:`, `at x y:`, `rotate angle:`,
 * `scale n:`, `blend screen:`, `into buf:`, `post:`, `on click:`, `fn name args:`
 */
export interface BlockStmt {
  kind: "block";
  header: BlockHeader;
  body: Stmt[];
  loc: Loc;
}

export type BlockHeader =
  | { type: "frame" }
  | { type: "once" }
  | { type: "post" }
  | { type: "at"; x: Expr; y: Expr }
  | { type: "rotate"; angle: Expr }
  | { type: "scale"; factor: Expr }
  | { type: "blend"; mode: string }
  | { type: "into"; buffer: Expr }
  | { type: "if"; cond: Expr; elseBody?: Stmt[] }
  | { type: "loop"; count: Expr; collect: boolean }   // collect=true for `loop N =>`
  | { type: "for-in"; value: string; iter?: string; iterable: Expr; step?: Expr }
  | { type: "on"; event: string; key?: string }
  | { type: "fn"; name: string; params: string[] };

/** `use easing|shapes|palettes` */
export interface UseStmt {
  kind: "use";
  lib: "easing" | "shapes" | "palettes";
  loc: Loc;
}

/** `seed N` or `seed "name" N` */
export interface SeedStmt {
  kind: "seed";
  ns?: string;
  value: Expr;
  loc: Loc;
}

/** `return expr` */
export interface ReturnStmt {
  kind: "return";
  value?: Expr;
  loc: Loc;
}

/** `print a b c` */
export interface PrintStmt {
  kind: "print";
  values: Expr[];
  loc: Loc;
}

/** `watch "label" value` */
export interface WatchStmt {
  kind: "watch";
  label: string;
  value: Expr;
  loc: Loc;
}

/** Expression used as statement (function call). */
export interface ExprStmt {
  kind: "expr-stmt";
  expr: Expr;
  loc: Loc;
}

// ---------------------------------------------------------------------------
// Top-level declarations
// ---------------------------------------------------------------------------

export type TopLevel =
  | ParamDecl
  | ColorDecl
  | Stmt;

/** `param name default range:min..max label:"..."` */
export interface ParamDecl {
  kind: "param";
  name: string;
  default: number;
  min: number;
  max: number;
  step: number;
  label?: string;
  loc: Loc;
}

/** `color name #hex label:"..."` */
export interface ColorDecl {
  kind: "color-decl";
  name: string;
  default: string;
  label?: string;
  loc: Loc;
}

/** The complete parsed program. */
export interface Program {
  body: TopLevel[];
}
