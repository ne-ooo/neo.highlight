import { describe, expect, it } from "vitest";
import { createJavaScriptStream } from "../../../src/experimental/javascript-stream";
import type { JavaScriptStreamUpdate } from "../../../src/experimental/javascript-stream";
import { createJavaScriptInput } from "../../../src/experimental/javascript-input";
import { scanJavaScript } from "../../../src/grammars/shared/javascript-scanner";
import { getPlainText, tokenize, tokenizeWithMetrics } from "../../../src/core/tokenizer";
import type { Token } from "../../../src/core/types";
import { renderToHTML } from "../../../src/core/renderer";
import { javascript } from "../../../src/grammars/javascript";
import { typescript } from "../../../src/grammars/typescript";
import fixtures from "../../fixtures/javascript-context.json";

function before(tokens: Token[], end: number): Token[] {
  const result: Token[] = [];
  let offset = 0;
  for (const token of tokens) {
    const size = typeof token === "string" ? token.length : token.length;
    if (offset >= end) break;
    if (offset + size > end) {
      expect(typeof token).toBe("string"); result.push((token as string).slice(0, end - offset)); break;
    }
    result.push(token); offset += size;
  }
  return result;
}
function apply(tokens: Token[], update: JavaScriptStreamUpdate): Token[] {
  const result = before(tokens, update.replaceFrom);
  for (const token of update.tokens) {
    if (typeof token === "string" && typeof result.at(-1) === "string") result[result.length - 1] += token;
    else result.push(token);
  }
  return result;
}
function spans(tokens: Token[], source: string, offset = 0): void {
  for (const token of tokens) {
    if (typeof token === "string") { offset += token.length; continue; }
    expect(getPlainText([token])).toBe(source.slice(offset, offset + token.length));
    if (Array.isArray(token.content)) spans(token.content, source, offset);
    offset += token.length;
  }
}
const boundaries = [
  "const value = 1;\nconst second = 2;\n",
  "name /* lookahead */\n();\nnew /* comment */ Thing;\n",
  "call<A;\nB>();\nnext();\n",
  "a < b;\nconst value = `nested ${`inner ${/[}]/.test('}')}`}`;\n",
  "const f = function(): {x: number} { return {x: 1}; };\n/ok/.test('x');\n",
  "const string = 'escaped\\\r\nnewline';\n",
  "const value = `escaped \\` \\${x};\n ${/* } */ {x: 1}}`;\n",
  "// line\r\n/* block *" + "/\nconst x = /[\\]/]/giu;\n",
  "const 😀value = 𐐀name?.member / 2;\r\n#!notAShebang\n",
  String.raw`const \u0061 = \u{10400}foo + \u0 + \u{1234567};` + "\n",
  "function f(a = (1), b = 2) { return a;\n};\nfoo();\n",
  "function f() {}\n/regex/.test('x');\nclass C {}\nnext();\n",
  "const f = () => {}\n/ 2;\nconst C = class {}\n/ 2;\n",
  "const t = `unfinished ${new /* x */ Object({ x: /open[",
  "/* unfinished *", "'unfinished\\", "/unfinished\\", "`unfinished$", "foo\\u{", "\ud801", "", "#!node\nconst x=1;\n",
];

for (const language of ["javascript", "typescript"] as const) {
  const grammar = language === "javascript" ? javascript : typescript;
  const cases = [...fixtures.shared.map(f => f.code), ...boundaries, ...(language === "typescript" ? fixtures.typed.map(f => f.code) : [])];
  describe(`${language} streaming`, () => {
    it.each(cases)("matches full tokenization at every UTF-16 split: %s", code => {
      const expected = tokenize(code, grammar);
      for (let split = 0; split <= code.length; split++) {
        const stream = createJavaScriptStream({ language });
        let tokens = apply([], stream.append(code.slice(0, split)));
        expect(getPlainText(tokens)).toBe(code.slice(0, split));
        if (split) expect(tokens).toEqual(tokenize(code.slice(0, split), grammar));
        tokens = apply(tokens, stream.append(code.slice(split)));
        expect(getPlainText(tokens)).toBe(code);
        if (code) expect(tokens).toEqual(expected);
        tokens = apply(tokens, stream.finish());
        expect(tokens, `split ${split}`).toEqual(expected);
        spans(tokens, code);
        expect(stream.metrics.pendingCodeUnits).toBe(0);
        expect(stream.metrics.tokenizedCodeUnits).toBeGreaterThanOrEqual(code.length);
      }
    });
    it("preserves lexer ranges and final token spans with one-code-unit chunks", () => {
      for (const code of cases) {
        const input = createJavaScriptInput("");
        const cursor = scanJavaScript("", false, "code", undefined, 0, 1, language === "typescript", "}", input)[Symbol.iterator]();
        const ranges = [];
        const drain = () => {
          for (;;) { const event = cursor.next(); if (event.done || event.value.kind === "input") return;
            if (event.value.kind !== "checkpoint") ranges.push(event.value); }
        };
        const stream = createJavaScriptStream({ language }); let tokens: Token[] = [];
        for (let index = 0; index < code.length; index++) {
          input.source += code[index]; drain();
          const update = stream.append(code[index]!); tokens = apply(tokens, update);
          expect(getPlainText(tokens)).toBe(code.slice(0, index + 1));
          const current = tokenize(code.slice(0, index + 1), grammar);
          expect(tokens).toEqual(current);
          expect(before(tokens, update.committedThrough)).toEqual(before(current, update.committedThrough));
        }
        input.final = true; drain();
        expect(ranges).toEqual([...scanJavaScript(code, false, "code", undefined, 0, 1, language === "typescript")]);
        tokens = apply(tokens, stream.finish()); expect(tokens).toEqual(tokenize(code, grammar));
        expect(renderToHTML(tokens)).toBe(renderToHTML(tokenize(code, grammar)));
      }
    });
  });
}

describe("stream retention and cumulative budgets", () => {
  it("preserves complete output for deterministic malformed combinations and uneven chunks", { timeout: 15_000 }, () => {
    let seed = 928173;
    const random = (n: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
    const parts = [...boundaries, "function", "/*", "*/", "'", "`", "\\u", ";\n", ";\r\n", "}", "(", "<", ">", "=>", "?.", "++", "--", "/", "[]", "//\n", "a", "0", "#", "!", "\\", "😀"];
    for (const language of ["javascript", "typescript"] as const) {
      const grammar = language === "javascript" ? javascript : typescript;
      for (let sample = 0; sample < 1500; sample++) {
        const code = Array.from({ length: 2 + random(8) }, () => parts[random(parts.length)]).join("");
        const stream = createJavaScriptStream({ language }); let tokens: Token[] = [];
        for (let offset = 0; offset < code.length;) {
          const size = 1 + random(31); tokens = apply(tokens, stream.append(code.slice(offset, offset + size))); offset += size;
        }
        tokens = apply(tokens, stream.finish());
        expect(tokens, `${language} sample ${sample}: ${JSON.stringify(code)}`).toEqual(tokenize(code, grammar));
      }
    }
  });
  it("commits complete statements and keeps the suffix provisional", () => {
    const stream = createJavaScriptStream({ preview: "plain" }); const first = stream.append("const value = 1;\nname");
    expect(first.committedThrough).toBe(16); expect(first.tokens.at(-1)).toBe("\nname");
    const second = stream.append("();\n"); expect(second.replaceFrom).toBe(16);
    expect(second.tokens).toEqual([...tokenize("\nname();", javascript), "\n"]);
    expect(stream.metrics.tokenizedCodeUnits).toBe(second.committedThrough);
    stream.dispose(); stream.dispose(); expect(stream.metrics.pendingCodeUnits).toBe(0);
    expect(() => stream.finish()).toThrow("closed");
  });
  it("uses cumulative tokenizer match and node budgets across chunks", () => {
    const code = "const x = 1;"; const cost = tokenizeWithMetrics(code, javascript, {});
    for (const name of ["maxMatchCount", "maxTokenCount"] as const) {
      const stream = createJavaScriptStream({ [name]: name === "maxMatchCount" ? cost.matchCount : cost.tokenCount });
      stream.append(code + "\n"); expect(() => stream.append(code + "\n")).toThrow(/count/i);
      expect(stream.metrics.pendingCodeUnits).toBe(0); expect(() => stream.append("x")).toThrow("closed");
    }
  });
  it.each([
    [{ maxInputLength: 2 }, "abc", "maxInputLength"],
    [{ maxRetainedCodeUnits: 2 }, "'abc", "maxRetainedCodeUnits"],
    [{ maxWorkCodeUnits: 2 }, "abc", "maxWorkCodeUnits"],
    [{ maxUpdates: 0 }, "", "maxUpdates"],
    [{ maxTokenDepth: 0 }, "`x ${`nested`}`", "maxTokenDepth"],
  ] as const)("closes and releases state after a resource limit: %j", (options, code, message) => {
    const stream = createJavaScriptStream(options);
    expect(() => { stream.append(code); stream.finish(); }).toThrow(message);
    expect(stream.metrics.pendingCodeUnits).toBe(0);
    expect(() => stream.append("x")).toThrow("closed");
  });
  it("charges unfinished suffix copies instead of allowing unbounded repeated work", () => {
    const stream = createJavaScriptStream({ preview: "plain", maxWorkCodeUnits: 100, maxInputLength: 1000 });
    stream.append("'abcdefghij");
    expect(() => { for (let i = 0; i < 10; i++) stream.append("a"); }).toThrow("maxWorkCodeUnits");
    expect(stream.metrics.tokenizations).toBe(0);
  });
  it("does not retain returned token trees", () => {
    const stream = createJavaScriptStream(); const first = stream.append("const x=1;\n");
    first.tokens.length = 0;
    expect(getPlainText(stream.append("let y=2;\n").tokens)).toBe("\nlet y=2;\n"); stream.dispose();
  });
  it("rejects invalid options and closes completed streams", () => {
    for (const options of [{ language: "tsx" }, { maxUpdates: Infinity }, { maxInputLength: -1 }, { maxRetainedCodeUnits: 1.5 }]) {
      expect(() => createJavaScriptStream(options as any)).toThrow(RangeError);
    }
    const stream = createJavaScriptStream(); expect(() => stream.append(1 as any)).toThrow(TypeError);
    expect(stream.finish().tokens).toEqual([""]); expect(() => stream.append("")).toThrow("closed");
  });
});
