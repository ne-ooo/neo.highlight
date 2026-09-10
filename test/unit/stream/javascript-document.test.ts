import { describe, expect, it } from "vitest";
import { createJavaScriptDocument } from "../../../src/experimental/javascript-document";
import { tokenize, getPlainText } from "../../../src/core/tokenizer";
import { javascript } from "../../../src/grammars/javascript";
import { typescript } from "../../../src/grammars/typescript";
import { renderToHTML } from "../../../src/core/renderer";
import type { Token } from "../../../src/core/types";

function range(tokens: Token[], start: number, end: number): Token[] {
  let offset = 0; const result: Token[] = [];
  for (const token of tokens) {
    const size = typeof token === "string" ? token.length : token.length;
    if (offset < end && offset + size > start) {
      if (offset < start || offset + size > end) {
        expect(typeof token).toBe("string"); result.push((token as string).slice(Math.max(0, start - offset), end - offset));
      } else result.push(token);
    }
    offset += size;
  }
  return result;
}
function merge(tokens: Token[]): Token[] {
  const result: Token[] = [];
  for (const token of tokens) {
    if (token === "") continue;
    if (typeof token === "string" && typeof result.at(-1) === "string") result[result.length - 1] += token;
    else result.push(token);
  }
  return result.length ? result : [""];
}
const parts = ["const x = 1;\n", "function f() {}\n", "const C = class {} / 2;\n", "call<A;\nB>();\n", "`template ${/[}]/.test('}')}`;\n", "// comment\n", "/* comment */", "\r\n", "'", "\\", "/*", "*/", "<", ">", "a", "0", "\\u{", "😀", "𐐀", "(", ")", "}", "{", "#!x\n", "?.", ";\n", "=>"];

for (const language of ["javascript", "typescript"] as const) describe(`${language} document edits`, () => {
  const grammar = language === "javascript" ? javascript : typescript;
  it("reuses unchanged source after grammar state converges", () => {
    const code = "const first = 1;\nconst middle = 2;\nconst last = 3;\n";
    const document = createJavaScriptDocument(code, { language });
    const index = code.indexOf("middle");
    const before = document.metrics.tokenizedCodeUnits;
    const update = document.edit({ revision: 0, start: index, end: index + 6, text: "changed" });
    const next = code.replace("middle", "changed");
    expect(update.from).toBe(code.indexOf("\n")); expect(update.to).toBe(code.lastIndexOf("\nconst"));
    expect(document.metrics.tokenizedCodeUnits - before).toBeLessThan(next.length / 2);
    expect(document.metrics.reusedCodeUnits).toBeGreaterThan(next.length / 2);
    expect(document.snapshot().tokens).toEqual(tokenize(next, grammar)); document.dispose();
  });
  it("invalidates a checkpoint when its following newline changes", () => {
    const code = "const x = 1;\nconst y = 2;\n";
    const document = createJavaScriptDocument(code, { language }); const index = code.indexOf("\n");
    const patch = document.edit({ revision: 0, start: index, end: index + 1, text: "/*" });
    expect(patch.from).toBe(0); expect(patch.to).toBe(code.length);
    expect(document.snapshot().tokens).toEqual(tokenize(code.slice(0, index) + "/*" + code.slice(index + 1), grammar));
  });
  it("preserves exact token trees, offsets, and HTML through randomized edit sequences", () => {
    let seed = 17421;
    const random = (n: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
    for (let sample = 0; sample < 50; sample++) {
      let source = Array.from({ length: 6 }, () => parts[random(parts.length)]).join("");
      const document = createJavaScriptDocument(source, { language }); let tokens = document.snapshot().tokens;
      for (let revision = 0; revision < 30; revision++) {
        const start = random(source.length + 1), end = start + random(source.length - start + 1), text = parts[random(parts.length)]!;
        const patch = document.edit({ revision, start, end, text });
        tokens = merge([...range(tokens, 0, patch.from), ...patch.tokens, ...range(tokens, patch.to, source.length)]);
        source = source.slice(0, start) + text + source.slice(end);
        const snapshot = document.snapshot();
        expect(snapshot.source).toBe(source); expect(snapshot.revision).toBe(revision + 1);
        expect(tokens).toEqual(tokenize(source, grammar)); expect(snapshot.tokens).toEqual(tokens);
        expect(getPlainText(tokens)).toBe(source);
        expect(renderToHTML(tokens)).toBe(renderToHTML(tokenize(source, grammar)));
      }
      document.dispose();
    }
  });
  it("handles insertion, deletion, empty documents, and edits inside surrogate pairs", () => {
    const document = createJavaScriptDocument("", { language });
    document.edit({ revision: 0, start: 0, end: 0, text: "const x = '😀';\n" });
    const initial = document.snapshot().source, emoji = initial.indexOf("😀");
    document.edit({ revision: 1, start: emoji, end: emoji + 1, text: "" });
    expect(document.snapshot().tokens).toEqual(tokenize(initial.slice(0, emoji) + initial.slice(emoji + 1), grammar));
    document.edit({ revision: 2, start: 0, end: document.snapshot().source.length, text: "" });
    expect(document.snapshot().tokens).toEqual([""]);
  });
});

describe("document isolation and limits", () => {
  it("rejects stale revisions and invalid edits without changing the document", () => {
    const document = createJavaScriptDocument("x;\n"); const original = document.snapshot();
    for (const edit of [{ revision: 1, start: 0, end: 0, text: "x" }, { revision: 0, start: -1, end: 0, text: "" },
      { revision: 0, start: 0, end: 9, text: "" }, { revision: 0, start: 0, end: 0, text: 1 }]) {
      expect(() => document.edit(edit as any)).toThrow(); expect(document.snapshot()).toEqual(original);
    }
  });
  it("isolates returned patches and snapshots from its token cache", () => {
    const document = createJavaScriptDocument("const x=1;\nconst y=2;\n");
    const first = document.snapshot(); first.tokens.length = 0;
    const patch = document.edit({ revision: 0, start: 6, end: 7, text: "z" }); patch.tokens.length = 0;
    expect(document.snapshot().tokens).toEqual(tokenize("const z=1;\nconst y=2;\n", javascript));
  });
  it.each([
    [{ maxInputLength: 3 }, "too long", "maxInputLength"],
    [{ maxRetainedCodeUnits: 3 }, "unfinished", "maxRetainedCodeUnits"],
    [{ maxWorkCodeUnits: 0 }, "x", "maxWorkCodeUnits"],
    [{ maxUpdates: 0 }, "", "maxUpdates"],
    [{ maxTokenCount: 0 }, "const x=1;", "Token count"],
    [{ maxMatchCount: 0 }, "const x=1;", "match count"],
  ] as const)("closes after cumulative resource exhaustion: %j", (options, text, message) => {
    const document = createJavaScriptDocument("", options);
    expect(() => document.edit({ revision: 0, start: 0, end: 0, text })).toThrow(message);
    expect(document.metrics.sourceLength).toBe(0); expect(document.metrics.retainedSegments).toBe(0);
    expect(() => document.snapshot()).toThrow("closed"); expect(() => document.edit({ revision: 0, start: 0, end: 0, text: "" })).toThrow("closed");
  });
  it("releases a disposed document and rejects invalid constructor options", () => {
    const document = createJavaScriptDocument("x"); document.dispose(); document.dispose();
    expect(() => document.snapshot()).toThrow("closed");
    expect(() => createJavaScriptDocument(1 as any)).toThrow(TypeError);
    expect(() => createJavaScriptDocument("x", { language: "tsx" as any })).toThrow(RangeError);
    expect(() => createJavaScriptDocument("x", { maxUpdates: Infinity })).toThrow(RangeError);
    expect(() => createJavaScriptDocument("x", { maxInputLength: 0 })).toThrow("maxInputLength");
  });
});
