import { describe, it, expect } from "vitest";
import { resolveGrammar } from "../../../src/core/grammar-utils";
import { javascript } from "../../../src/grammars/javascript";
import { typescript } from "../../../src/grammars/typescript";
import { python } from "../../../src/grammars/python";

describe("resolveGrammar", () => {
  const grammars = [javascript, typescript, python];

  it("resolves by exact name", () => {
    expect(resolveGrammar("javascript", grammars)).toBe(javascript);
    expect(resolveGrammar("typescript", grammars)).toBe(typescript);
    expect(resolveGrammar("python", grammars)).toBe(python);
  });

  it("resolves by alias", () => {
    expect(resolveGrammar("js", grammars)).toBe(javascript);
    expect(resolveGrammar("ts", grammars)).toBe(typescript);
    expect(resolveGrammar("py", grammars)).toBe(python);
  });

  it("returns null for unknown language", () => {
    expect(resolveGrammar("unknown", grammars)).toBeNull();
    expect(resolveGrammar("", grammars)).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(resolveGrammar("JS", grammars)).toBe(javascript);
    expect(resolveGrammar("JavaScript", grammars)).toBe(javascript);
    expect(resolveGrammar("PYTHON", grammars)).toBe(python);
  });

  it("returns first match when multiple could match", () => {
    const result = resolveGrammar("javascript", grammars);
    expect(result).toBe(javascript);
  });

  it("works with empty grammar list", () => {
    expect(resolveGrammar("js", [])).toBeNull();
  });
});
