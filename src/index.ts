import { tokenize } from "./compiler/tokenizer";
import { parse, ParseError } from "./compiler/parser";
import { codegen } from "./compiler/codegen";
export { tokenize, parse, codegen, ParseError };
export type { Token, TokenKind } from "./compiler/token";
export type { Program } from "./compiler/ast";

/** A param extracted from source at compile time (maps to ParamDef). */
export interface ParamExtract {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

/** A color extracted from source at compile time (maps to ColorDef). */
export interface ColorExtract {
  key: string;
  label: string;
  default: string;
}

/** Successful compilation result. */
export interface CompileSuccess {
  ok: true;
  /** Compiled JavaScript source. */
  code: string;
  /** Params extracted from `param` declarations. */
  params: ParamExtract[];
  /** Colors extracted from `color` declarations. */
  colors: ColorExtract[];
}

/** Failed compilation result. */
export interface CompileFailure {
  ok: false;
  errors: Array<{ line: number; col: number; message: string }>;
}

/** Result of compiling a GenArt Script source string. */
export type CompileResult = CompileSuccess | CompileFailure;

/**
 * Compile a GenArt Script source string to JavaScript.
 *
 * @param source - The `.genart-script` source text.
 * @returns A `CompileResult` — check `.ok` before using `.code`.
 *
 * @example
 * ```ts
 * import { compile } from "@genart-dev/genart-script";
 * const result = compile(`bg black\ncircle w/2 h/2 r:100 fill:coral`);
 * if (result.ok) console.log(result.code);
 * ```
 */
export function compile(source: string): CompileResult {
  try {
    const tokens = tokenize(source);
    const program = parse(tokens);
    return codegen(program);
  } catch (err) {
    if (err instanceof Error && "loc" in err) {
      const e = err as Error & { loc: { line: number; col: number } };
      return { ok: false, errors: [{ line: e.loc.line, col: e.loc.col, message: e.message }] };
    }
    return { ok: false, errors: [{ line: 0, col: 0, message: String(err) }] };
  }
}
