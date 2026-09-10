import { expect, it } from "vitest";
import { applyJavaScriptTokenUpdate } from "../../../src/experimental/token-update";
import { createJavaScriptStream } from "../../../src/experimental/javascript-stream";
import { createJavaScriptDocument } from "../../../src/experimental/javascript-document";
import { tokenize } from "../../../src/core/tokenizer";
import { javascript } from "../../../src/grammars/javascript";
import type { Token } from "../../../src/core/types";

it("applies stream and document patches to exact complete-input tokens", () => {
  const source = "const first = `😀 ${true}`;\nconst last = 2;\n";
  const stream = createJavaScriptStream(); let tokens: Token[] = [];
  for (let index = 0; index < source.length; index++) {
    tokens = applyJavaScriptTokenUpdate(tokens, stream.append(source[index]!));
    expect(tokens).toEqual(tokenize(source.slice(0, index + 1), javascript));
  }
  tokens = applyJavaScriptTokenUpdate(tokens, stream.finish());
  const document = createJavaScriptDocument(source);
  const patch = document.edit({ revision: 0, start: source.indexOf("last"), end: source.indexOf("last") + 4, text: "changed" });
  tokens = applyJavaScriptTokenUpdate(tokens, patch);
  expect(tokens).toEqual(tokenize(source.replace("last", "changed"), javascript));
});
it("coalesces plain text, deletes ranges, and preserves the empty source shape", () => {
  expect(applyJavaScriptTokenUpdate(["hello"], { from: 1, to: 4, tokens: ["i", ""], sourceLength: 3 })).toEqual(["hio"]);
  expect(applyJavaScriptTokenUpdate(["hello"], { from: 0, to: 5, tokens: [], sourceLength: 0 })).toEqual([""]);
});
it("rejects malformed lengths, incompatible ranges, and structural token splits", () => {
  const token = { type: "keyword", content: "const", length: 5 };
  expect(() => applyJavaScriptTokenUpdate([token], { from: 1, to: 4, tokens: ["x"], sourceLength: 3 })).toThrow("splits");
  expect(() => applyJavaScriptTokenUpdate(["x"], { replaceFrom: -1, tokens: [], sourceLength: 0 })).toThrow("range");
  expect(() => applyJavaScriptTokenUpdate(["x"], { replaceFrom: 0, tokens: ["abc"], sourceLength: 2 })).toThrow("length");
  expect(() => applyJavaScriptTokenUpdate([{ ...token, length: NaN }], { replaceFrom: 0, tokens: [], sourceLength: 0 })).toThrow("length");
});
