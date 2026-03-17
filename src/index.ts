import { tokenize } from "./compiler/tokenizer";
import { parse, ParseError } from "./compiler/parser";
import { codegen } from "./compiler/codegen";
import { preprocess, expandParamSets } from "./compiler/preprocess";
export { tokenize, parse, codegen, ParseError, preprocess, expandParamSets };
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
  /** Tab ID this param belongs to (maps to TabExtract.id / ParamDef.tab). */
  tab?: string;
}

/** A tab extracted from source at compile time (maps to TabDef). */
export interface TabExtract {
  /** Unique tab ID (slugified from group name). */
  id: string;
  /** Display label (original group name). */
  label: string;
}

/** A color extracted from source at compile time (maps to ColorDef). */
export interface ColorExtract {
  key: string;
  label: string;
  default: string;
}

/** An external library dependency extracted from a `library` declaration. */
export interface LibraryExtract {
  /** Library preset name, e.g. `"p5.brush"`. */
  name: string;
  /** Version override (if specified with `version:"x.y.z"`). */
  version?: string;
}

/** A layer extracted from source at compile time (maps to DesignLayer). */
export interface LayerExtract {
  /** Plugin layer type ID, e.g. `"terrain:sky"`. */
  type: string;
  /** Preset name resolved by the plugin, e.g. `"noon"`. */
  preset: string;
  /** Display name override. */
  name?: string;
  /** Layer opacity 0–1. */
  opacity?: number;
  /** Param name that drives opacity at runtime (e.g. `opacity:fog` → `"fog"`). */
  opacityParam?: string;
  /** Blend mode string. */
  blend?: string;
  /** Layer visibility. */
  visible?: boolean;
}

/** Sketch metadata extracted from header directives (maps to SketchDefinition fields). */
export interface MetadataExtract {
  title?: string;
  subtitle?: string;
  philosophy?: string;
  compositionLevel?: "minimal" | "simple" | "moderate" | "complex" | "extreme";
}

/** Successful compilation result. */
export interface CompileSuccess {
  ok: true;
  /** Compiled JavaScript source. */
  code: string;
  /** Params extracted from `param` declarations. */
  params: ParamExtract[];
  /** Tabs extracted from `group` directives (in declaration order, deduplicated). */
  tabs: TabExtract[];
  /** Colors extracted from `color` declarations. */
  colors: ColorExtract[];
  /** Layers extracted from `layer` declarations. */
  layers: LayerExtract[];
  /** Component names extracted from `use "component-name"` declarations. */
  components: string[];
  /** External libraries declared with `library "name"` directives. */
  libraries: LibraryExtract[];
  /** Sketch metadata from header directives (title, subtitle, philosophy, compositionLevel). */
  metadata: MetadataExtract;
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
    const expanded = preprocess(source);
    const tokens = tokenize(expanded);
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
