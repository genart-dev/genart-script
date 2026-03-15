import { describe, it, expect } from "vitest";
import { tokenize } from "./tokenizer";

function kinds(src: string) {
  return tokenize(src).map(t => t.kind);
}

function vals(src: string) {
  return tokenize(src).map(t => t.value);
}

describe("tokenizer", () => {
  it("tokenizes a number", () => {
    const tokens = tokenize("42");
    expect(tokens[0]).toMatchObject({ kind: "number", value: "42" });
  });

  it("tokenizes a hex color", () => {
    const tokens = tokenize("#ff0000");
    expect(tokens[0]).toMatchObject({ kind: "color", value: "#ff0000" });
  });

  it("tokenizes a short hex color", () => {
    const tokens = tokenize("#f00");
    expect(tokens[0]).toMatchObject({ kind: "color", value: "#f00" });
  });

  it("tokenizes a named color", () => {
    const tokens = tokenize("red");
    expect(tokens[0]).toMatchObject({ kind: "color", value: "red" });
  });

  it("tokenizes alpha shorthand on named color", () => {
    const tokens = tokenize("white.50");
    expect(tokens[0]).toMatchObject({ kind: "color", value: "white" });
    expect(tokens[1]).toMatchObject({ kind: "op", value: "." });
    expect(tokens[2]).toMatchObject({ kind: "number", value: "50" });
  });

  it("tokenizes alpha shorthand on hex color", () => {
    const tokens = tokenize("#f00.80");
    expect(tokens[0]).toMatchObject({ kind: "color", value: "#f00" });
    expect(tokens[1]).toMatchObject({ kind: "op", value: "." });
    expect(tokens[2]).toMatchObject({ kind: "number", value: "80" });
  });

  it("tokenizes string literals", () => {
    const tokens = tokenize('"hello world"');
    expect(tokens[0]).toMatchObject({ kind: "string", value: "hello world" });
  });

  it("tokenizes identifiers", () => {
    const tokens = tokenize("circle");
    expect(tokens[0]).toMatchObject({ kind: "ident", value: "circle" });
  });

  it("tokenizes range operator", () => {
    const tokens = tokenize("0..100");
    const kinds = tokens.map(t => t.kind + ":" + t.value);
    expect(kinds).toContain("op:..");
  });

  it("tokenizes arrow operators", () => {
    expect(tokenize("=>")[0]).toMatchObject({ kind: "op", value: "=>" });
    expect(tokenize("->")[0]).toMatchObject({ kind: "op", value: "->" });
  });

  it("emits indent/dedent tokens", () => {
    const src = "frame:\n  circle 0 0 r:10 fill:red";
    const k = kinds(src);
    expect(k).toContain("indent");
    expect(k).toContain("dedent");
  });

  it("skips line comments", () => {
    const tokens = tokenize("42 // this is a comment");
    expect(tokens.filter(t => t.kind !== "newline" && t.kind !== "eof")).toHaveLength(1);
  });

  it("tracks line and col", () => {
    const tokens = tokenize("42");
    expect(tokens[0]).toMatchObject({ line: 1, col: 1 });
  });

  it("tokenizes two-char ops", () => {
    expect(tokenize("==")[0]).toMatchObject({ kind: "op", value: "==" });
    expect(tokenize("!=")[0]).toMatchObject({ kind: "op", value: "!=" });
    expect(tokenize("<=")[0]).toMatchObject({ kind: "op", value: "<=" });
    expect(tokenize(">=")[0]).toMatchObject({ kind: "op", value: ">=" });
    expect(tokenize("**")[0]).toMatchObject({ kind: "op", value: "**" });
  });
});
