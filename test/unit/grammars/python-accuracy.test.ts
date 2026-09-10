import { describe, expect, it } from "vitest";
import { getPlainText, tokenize } from "../../../src/core/tokenizer";
import type { Token } from "../../../src/core/types";
import { python } from "../../../src/grammars/python";

function spans(tokens: Token[], start = 0): Array<{ type: string; text: string; start: number }> {
  const result = [];
  for (const token of tokens) {
    if (typeof token === "string") { start += token.length; continue; }
    const text = getPlainText([token]);
    expect(token.length).toBe(text.length);
    result.push({ type: token.type, text, start });
    if (Array.isArray(token.content)) result.push(...spans(token.content, start));
    start += text.length;
  }
  return result;
}
const fixtures: Array<{ name: string; code: string; expected: [string, string][]; absent?: [string, string][] }> = [
  { name: "named Unicode escapes inside format specs", code: 'f"{value:\\N{GREATER-THAN SIGN}10}"', expected: [["format-specifier", ":\\N{GREATER-THAN SIGN}10"]], absent: [["interpolation", "{GREATER-THAN SIGN}"]] },
  { name: "raw named escapes still contain fields", code: 'rf"{value:\\N{width}}"', expected: [["format-specifier", ":\\N{width}"], ["interpolation", "{width}"]] },
  {"name": "nested format expressions with strings", "code": "f\"{value:{len('x')}d}\"", "expected": [["interpolation", "{len('x')}"], ["builtin", "len"], ["string", "'x'"]]},
  { name: "escaped backslash before format field", code: 'f"{value:\\\\{width}}"', expected: [["interpolation", "{width}"]] },
  {"name": "literal quote inside format spec", "code": "f\"{value:'>10}\"", "expected": [["format-specifier", ":'>10"]]},
  { name: "incomplete nested format", code: 'f"{value:>{width', expected: [["format-specifier", ":>{width"], ["interpolation", "{width"]] },
  { name: "all conversions", code: 'f"{one!s} {two!a} {three!r}"', expected: [["conversion", "!s"], ["conversion", "!a"], ["conversion", "!r"]] },
  { name: "ordinary replacement expressions", code: 'f"Hello {name.upper()} {len(items) + 1}"', expected: [["interpolation", "{name.upper()}"], ["function", "upper"], ["builtin", "len"], ["number", "1"]] },
  { name: "nested braces and strings", code: 'f"{lookup({\'key\': [1, 2]})[\'key\']}"', expected: [["interpolation", "{lookup({'key': [1, 2]})['key']}"], ["function", "lookup"], ["string", "'key'"], ["number", "2"]] },
  { name: "same quote reuse from Python 3.12", code: 'f"{data["name"]} {"}"}"', expected: [["string", '"name"'], ["string", '"}"'], ["interpolation", '{data["name"]}']] },
  { name: "nested formatted strings", code: 'f"outer {f"inner {value + 1}"} tail"', expected: [["string", 'f"inner {value + 1}"'], ["interpolation", "{value + 1}"], ["number", "1"]] },
  { name: "format fields and conversions", code: 'f"{value!r:>{width}.{precision}f}"', expected: [["conversion", "!r"], ["format-specifier", ":>{width}.{precision}f"], ["interpolation", "{width}"], ["interpolation", "{precision}"]] },
  { name: "debug expressions", code: 'f"{value = !s:>10} {x==2} {x!=3}"', expected: [["expression", "value "], ["interpolation-punctuation", "="], ["conversion", "!s"], ["number", "2"], ["number", "3"]] },
  { name: "parenthesized lambda, walrus, and slice colons", code: 'f"{(lambda x: x + 1)(2)} {(x := 3)} {items[1:4]}"', expected: [["keyword", "lambda"], ["operator", ":="], ["number", "4"]], absent: [["format-specifier", ": x + 1)(2)"], ["format-specifier", ":4]"]] },
  { name: "escaped braces stay literal", code: 'f"{{not_expression}} {{{value}}}"', expected: [["interpolation", "{value}"]], absent: [["interpolation", "{not_expression}"]] },
  { name: "raw f prefixes and literal backslashes", code: 'RF"\\{value} {{literal}}"', expected: [["interpolation", "{value}"]], absent: [["interpolation", "{literal}"]] },
  { name: "named Unicode escapes do not open fields", code: 'f"\\N{GREEK CAPITAL LETTER DELTA} {value}"', expected: [["interpolation", "{value}"]], absent: [["interpolation", "{GREEK CAPITAL LETTER DELTA}"]] },
  { name: "comments and newlines inside single-quoted f fields", code: 'f"{value # } ignored\n + 1}"', expected: [["comment", "# } ignored"], ["number", "1"], ["interpolation", "{value # } ignored\n + 1}"]] },
  { name: "triple f strings across CRLF and Unicode", code: "f'''café 😀\r\n{True if λ else False}\r\n'''", expected: [["boolean", "True"], ["keyword", "if"], ["boolean", "False"]] },
  { name: "comment markers inside ordinary strings", code: 'text = "# not comment" # real\nr"raw\\\"quote"', expected: [["string", '"# not comment"'], ["comment", "# real"], ["string", 'r"raw\\\"quote"']] },
  { name: "ordinary triple strings and prefixes", code: "r'''# literal'''\nBR\"\"\"bytes\"\"\"", expected: [["triple-string", "r'''# literal'''"], ["triple-string", 'BR"""bytes"""']] },
  { name: "unfinished fields retain context", code: 'f"start {format({"key": 1', expected: [["string", 'f"start {format({"key": 1'], ["interpolation", '{format({"key": 1'], ["number", "1"]] },
  { name: "unfinished single strings stop at raw newline", code: '"broken\nnext = 42', expected: [["string", '"broken'], ["number", "42"]] },
  { name: "decimal boundaries in fields", code: 'f"{.5 + 1. + 1e-3 + 2j}"', expected: [["number", ".5"], ["number", "1."], ["number", "1e-3"], ["number", "2j"]] },
  { name: "Unicode names do not split keywords or prefixes", code: 'f"{λreturn + TrueValue + café(1)}"\nnotf"{plain}"', expected: [["function", "café"]], absent: [["keyword", "return"], ["boolean", "True"], ["interpolation", "{plain}"]] },
];

describe("Python lexical accuracy", () => {
  it.each(fixtures)("$name", ({ code, expected, absent = [] }) => {
    const tokens = tokenize(code, python);
    expect(getPlainText(tokens)).toBe(code);
    const actual = spans(tokens);
    for (const span of actual) expect(code.slice(span.start, span.start + span.text.length)).toBe(span.text);
    for (const [type, text] of expected) expect(actual).toEqual(expect.arrayContaining([expect.objectContaining({ type, text, start: code.indexOf(text) })]));
    for (const [type, text] of absent) expect(actual).not.toEqual(expect.arrayContaining([expect.objectContaining({ type, text })]));
    expect(tokenize(code, python)).toEqual(tokens);
  });
  it("enforces shared limits for nested fields", () => {
    for (const limit of ["maxTokenDepth", "maxMatchCount", "maxTokenCount"] as const) {
      expect(() => tokenize('f"{value + 1}"', python, { [limit]: 0 })).toThrow(limit);
    }
    expect(() => tokenize('f"{'.repeat(10_000), python)).toThrow(/maxTokenDepth/);
  });
});
