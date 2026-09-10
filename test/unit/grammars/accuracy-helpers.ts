import { expect } from "vitest";
import { getPlainText, tokenize } from "../../../src/core/tokenizer";
import type { Grammar, Token } from "../../../src/core/types";

export type ExpectedSpan = readonly [type: string, text: string, occurrence?: number];
export interface AccuracyFixture { name: string; code: string; spans: ExpectedSpan[]; absent?: ExpectedSpan[] }
export function spansOf(tokens: Token[], offset = 0): Array<{ type: string; text: string; start: number; end: number }> {
  const spans = [];
  for (const token of tokens) {
    if (typeof token === "string") { offset += token.length; continue; }
    const text = getPlainText([token]);
    expect(token.length).toBe(text.length);
    spans.push({ type: token.type, text, start: offset, end: offset + text.length });
    if (Array.isArray(token.content)) spans.push(...spansOf(token.content, offset));
    offset += text.length;
  }
  return spans;
}
export function verify(grammar: Grammar, fixture: AccuracyFixture): void {
  const tokens = tokenize(fixture.code, grammar);
  expect(getPlainText(tokens)).toBe(fixture.code);
  const spans = spansOf(tokens);
  for (const span of spans) expect(fixture.code.slice(span.start, span.end)).toBe(span.text);
  for (const [type, text, occurrence = 0] of fixture.spans) {
    let start = -1;
    for (let index = 0; index <= occurrence; index++) start = fixture.code.indexOf(text, start + 1);
    expect(start, `Missing occurrence ${occurrence} of ${text}`).toBeGreaterThanOrEqual(0);
    expect(spans, `${type}: ${text} at ${start}`).toContainEqual({ type, text, start, end: start + text.length });
  }
  for (const [type, text] of fixture.absent ?? []) expect(spans).not.toEqual(expect.arrayContaining([expect.objectContaining({ type, text })]));
  expect(tokenize(fixture.code, grammar)).toEqual(tokens);
}
