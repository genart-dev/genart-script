/** All token kinds produced by the GenArt Script tokenizer. */
export type TokenKind =
  | "ident"       // foo, bar, circle, frame
  | "number"      // 42, 3.14, -1
  | "string"      // "hello"
  | "color"       // #f00, #ff0000
  | "color-ref"   // $varname — color variable reference (with optional .NN alpha)
  | "op"          // + - * / % ** = == != < > <= >= ? : , . .. => ->
  | "lparen"      // (
  | "rparen"      // )
  | "lbracket"    // [
  | "rbracket"    // ]
  | "newline"     // \n (significant)
  | "indent"      // increased indentation level
  | "dedent"      // decreased indentation level
  | "eof";

/** A single token with source position. */
export interface Token {
  readonly kind: TokenKind;
  readonly value: string;
  readonly line: number;
  readonly col: number;
}
