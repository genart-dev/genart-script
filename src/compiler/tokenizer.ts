import type { Token, TokenKind } from "./token";

/** Named CSS colors recognized by the tokenizer. */
const NAMED_COLORS = new Set([
  "red", "green", "blue", "white", "black", "gray", "grey",
  "yellow", "orange", "purple", "pink", "cyan", "magenta",
  "coral", "salmon", "gold", "silver", "teal", "navy",
  "maroon", "olive", "lime", "aqua", "fuchsia", "indigo",
  "violet", "crimson", "turquoise", "beige", "ivory", "khaki",
  "lavender", "linen", "tan", "wheat", "transparent",
]);

/** Keywords that open a block (followed by colon). */
const BLOCK_KEYWORDS = new Set([
  "frame", "once", "post", "at", "rotate", "scale",
  "blend", "into", "on", "fn", "if", "else", "loop", "for",
]);

/** All keywords. */
const KEYWORDS = new Set([
  ...BLOCK_KEYWORDS,
  "param", "color", "use", "layer", "library", "seed", "return", "print",
  "watch", "bg", "circle", "rect", "line", "dot", "poly",
  "path", "arc", "draw", "text", "step", "in",
]);

/** Tokenize a GenArt Script source string. */
export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const lines = source.split("\n");
  const indentStack: number[] = [0];
  /** Bracket nesting depth — when > 0, newline/indent/dedent are suppressed */
  let bracketDepth = 0;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const raw = lines[lineNum]!;
    const line = lineNum + 1;

    // Strip line comment
    const commentIdx = raw.indexOf("//");
    const text = commentIdx >= 0 ? raw.slice(0, commentIdx) : raw;

    if (text.trim() === "") continue;

    // Measure indentation (spaces only; tabs = 4 spaces)
    let indent = 0;
    for (let i = 0; i < text.length; i++) {
      if (text[i] === " ") indent++;
      else if (text[i] === "\t") indent += 4;
      else break;
    }

    // Only emit indent/dedent when not inside brackets
    if (bracketDepth === 0) {
      const curIndent = indentStack[indentStack.length - 1]!;
      if (indent > curIndent) {
        indentStack.push(indent);
        tokens.push({ kind: "indent", value: "", line, col: 1 });
      } else {
        while (indent < indentStack[indentStack.length - 1]!) {
          indentStack.pop();
          tokens.push({ kind: "dedent", value: "", line, col: 1 });
        }
      }
    }

    // Tokenize the rest of the line
    let pos = indent;
    while (pos < text.length) {
      const col = pos + 1;
      const ch = text[pos]!;

      // Skip spaces
      if (ch === " " || ch === "\t") { pos++; continue; }

      // Hex color
      if (ch === "#") {
        let end = pos + 1;
        while (end < text.length && /[0-9a-fA-F]/.test(text[end]!)) end++;
        const hex = text.slice(pos, end);
        if (hex.length === 4 || hex.length === 7) {
          tokens.push({ kind: "color", value: hex, line, col });
          pos = end;
          // Alpha shorthand: #f00.80
          if (text[pos] === "." && /\d/.test(text[pos + 1] ?? "")) {
            let ae = pos + 1;
            while (ae < text.length && /[\d.]/.test(text[ae]!)) ae++;
            tokens.push({ kind: "op", value: ".", line, col: pos + 1 });
            tokens.push({ kind: "number", value: text.slice(pos + 1, ae), line, col: pos + 2 });
            pos = ae;
          }
          continue;
        }
        // Not a valid hex → fall through as op '#' (shouldn't normally happen)
        tokens.push({ kind: "op", value: "#", line, col });
        pos++;
        continue;
      }

      // Number (including leading minus only if preceded by op/start)
      const prevKind = tokens[tokens.length - 1]?.kind;
      const canBeNeg = prevKind === undefined || prevKind === "op" || prevKind === "indent" || prevKind === "newline";
      if (/\d/.test(ch) || (ch === "-" && canBeNeg && /\d/.test(text[pos + 1] ?? ""))) {
        let end = pos + (ch === "-" ? 1 : 0);
        // Consume digits and at most one decimal point; stop before ".." range operator
        let hasDot = false;
        while (end < text.length) {
          const c = text[end]!;
          if (/\d/.test(c)) { end++; continue; }
          if (c === "." && !hasDot && text[end + 1] !== ".") { hasDot = true; end++; continue; }
          break;
        }
        // scientific notation
        if (text[end] === "e" || text[end] === "E") {
          end++;
          if (text[end] === "+" || text[end] === "-") end++;
          while (end < text.length && /\d/.test(text[end]!)) end++;
        }
        tokens.push({ kind: "number", value: text.slice(pos, end), line, col });
        pos = end;
        continue;
      }

      // String
      if (ch === '"') {
        let end = pos + 1;
        while (end < text.length && text[end] !== '"') {
          if (text[end] === "\\") end++;
          end++;
        }
        tokens.push({ kind: "string", value: text.slice(pos + 1, end), line, col });
        pos = end + 1;
        continue;
      }

      // Range operator ..  (must check before single dot)
      if (ch === "." && text[pos + 1] === ".") {
        tokens.push({ kind: "op", value: "..", line, col });
        pos += 2;
        continue;
      }

      // Arrow =>
      if (ch === "=" && text[pos + 1] === ">") {
        tokens.push({ kind: "op", value: "=>", line, col });
        pos += 2;
        continue;
      }

      // Arrow ->
      if (ch === "-" && text[pos + 1] === ">") {
        tokens.push({ kind: "op", value: "->", line, col });
        pos += 2;
        continue;
      }

      // Two-char operators
      const two = text.slice(pos, pos + 2);
      if (["==", "!=", "<=", ">=", "**", "&&", "||"].includes(two)) {
        tokens.push({ kind: "op", value: two, line, col });
        pos += 2;
        continue;
      }

      // Parens / brackets — track depth for implicit line continuation
      if (ch === "(") { tokens.push({ kind: "lparen", value: "(", line, col }); bracketDepth++; pos++; continue; }
      if (ch === ")") { tokens.push({ kind: "rparen", value: ")", line, col }); if (bracketDepth > 0) bracketDepth--; pos++; continue; }
      if (ch === "[") { tokens.push({ kind: "lbracket", value: "[", line, col }); bracketDepth++; pos++; continue; }
      if (ch === "]") { tokens.push({ kind: "rbracket", value: "]", line, col }); if (bracketDepth > 0) bracketDepth--; pos++; continue; }
      if (ch === "{") { tokens.push({ kind: "lbrace", value: "{", line, col }); bracketDepth++; pos++; continue; }
      if (ch === "}") { tokens.push({ kind: "rbrace", value: "}", line, col }); if (bracketDepth > 0) bracketDepth--; pos++; continue; }

      // Single-char operators
      if ("+-*/%=<>?:,.|!".includes(ch)) {
        tokens.push({ kind: "op", value: ch, line, col });
        pos++;
        continue;
      }

      // Property access dot (between idents/numbers)
      if (ch === ".") {
        tokens.push({ kind: "op", value: ".", line, col });
        pos++;
        continue;
      }

      // Color variable reference: $varname (optionally followed by .NN alpha)
      if (ch === "$" && /[a-zA-Z_]/.test(text[pos + 1] ?? "")) {
        let end = pos + 1;
        while (end < text.length && /[a-zA-Z0-9_]/.test(text[end]!)) end++;
        const varName = text.slice(pos + 1, end);
        tokens.push({ kind: "color-ref", value: varName, line, col });
        pos = end;
        // Alpha shorthand: $star.08
        if (text[pos] === "." && /\d/.test(text[pos + 1] ?? "")) {
          let ae = pos + 1;
          while (ae < text.length && /[\d.]/.test(text[ae]!)) ae++;
          tokens.push({ kind: "op", value: ".", line, col: pos + 1 });
          tokens.push({ kind: "number", value: text.slice(pos + 1, ae), line, col: pos + 2 });
          pos = ae;
        }
        continue;
      }

      // Identifier or keyword
      if (/[a-zA-Z_]/.test(ch)) {
        let end = pos;
        while (end < text.length && /[a-zA-Z0-9_]/.test(text[end]!)) end++;
        const word = text.slice(pos, end);
        pos = end;

        // Named color check
        if (NAMED_COLORS.has(word)) {
          tokens.push({ kind: "color", value: word, line, col });
          // Alpha shorthand: white.50
          if (text[pos] === "." && /\d/.test(text[pos + 1] ?? "")) {
            let ae = pos + 1;
            while (ae < text.length && /[\d.]/.test(text[ae]!)) ae++;
            tokens.push({ kind: "op", value: ".", line, col: pos + 1 });
            tokens.push({ kind: "number", value: text.slice(pos + 1, ae), line, col: pos + 2 });
            pos = ae;
          }
          continue;
        }

        tokens.push({ kind: "ident", value: word, line, col });
        continue;
      }

      // Unknown character — skip
      pos++;
    }

    // Only emit newline when not inside brackets
    if (bracketDepth === 0) {
      tokens.push({ kind: "newline", value: "", line, col: text.length + 1 });
    }
  }

  // Close any remaining open indents
  while (indentStack.length > 1) {
    indentStack.pop();
    tokens.push({ kind: "dedent", value: "", line: lines.length, col: 1 });
  }

  tokens.push({ kind: "eof", value: "", line: lines.length + 1, col: 1 });
  return tokens;
}
