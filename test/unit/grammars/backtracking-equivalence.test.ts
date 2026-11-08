import { describe, expect, it } from "vitest";
import { bash } from "../../../src/grammars/bash";
import { CSS_IDENTIFIER } from "../../../src/grammars/shared/css-scanner";
import { toml } from "../../../src/grammars/toml";
import type { TokenPattern } from "../../../src/core/types";

// The patterns these replaced, which backtracked on crafted input. The
// replacements must match the same text, and the same first group, which the
// tokenizer's lookbehind and the CSS property scan read. Inputs here are short,
// so the old patterns finish quickly.
const OLD_CSS_IDENTIFIER = String.raw`(?:--|-?(?:[_a-zA-Z\u0080-\uffff]|\\(?:[\da-fA-F]{1,6}\s?|[^\r\n\da-fA-F])))(?:[-\w\u0080-\uffff]|\\(?:[\da-fA-F]{1,6}\s?|[^\r\n\da-fA-F]))*`;
const OLD_BASH_STRING = /"(?:\\[\s\S]|\$(?:\([^()\r\n]+\)|\{[^{}\r\n]+\}|\w+)|[^\\$"\r\n])*"/;
const OLD_TOML_NUMBER =
  /[+-]?(?:0x[\da-fA-F]+(?:_[\da-fA-F]+)*|0o[0-7]+(?:_[0-7]+)*|0b[01]+(?:_[01]+)*|(?:\d+(?:_\d+)*\.?\d*(?:_\d+)*|\.\d+(?:_\d+)*)(?:[eE][+-]?\d+(?:_\d+)*)?|inf|nan)\b/;

/** Every match a global search finds, with its first group. */
function matches(pattern: RegExp, text: string): string[] {
  const global = new RegExp(pattern.source, pattern.flags.replace("g", "") + "g");
  const found: string[] = [];
  for (let match = global.exec(text); match; match = global.exec(text)) {
    found.push(`${match.index}:${JSON.stringify(match[0])}:${JSON.stringify(match[1])}`);
    if (match[0] === "") global.lastIndex = match.index + 1;
  }
  return found;
}

/** Deterministic strings over `alphabet`, up to `maxLength` long. */
function* corpus(alphabet: string, count: number, maxLength: number, seed: number): Generator<string> {
  let state = seed;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  for (let index = 0; index < count; index++) {
    let text = "";
    const length = Math.floor(next() * maxLength);
    for (let char = 0; char < length; char++) text += alphabet[Math.floor(next() * alphabet.length)];
    yield text;
  }
}

function patternOf(token: TokenPattern | TokenPattern[] | RegExp | undefined, index = 0): RegExp {
  const entry = Array.isArray(token) ? token[index] : token;
  return entry instanceof RegExp ? entry : (entry as { pattern: RegExp }).pattern;
}

function expectSameMatches(current: RegExp, previous: RegExp, inputs: Iterable<string>): void {
  for (const text of inputs) {
    expect(matches(current, text), JSON.stringify(text)).toEqual(matches(previous, text));
  }
}

describe("patterns rewritten to stop backtracking match as before", () => {
  // Each place the identifier is composed, with and without the u flag.
  const compositions: Array<[string, (identifier: string) => RegExp]> = [
    ["function", (identifier) => new RegExp(String.raw`(^|[^\w-])${identifier}(?=\()`, "u")],
    ["at-rule function", (identifier) => new RegExp(String.raw`${identifier}(?=\()`, "u")],
    ["class name", (identifier) => new RegExp(String.raw`\.${identifier}`, "u")],
    ["attribute name", (identifier) => new RegExp(String.raw`^(\[\s*)${identifier}`, "u")],
    ["property", (identifier) => new RegExp(String.raw`^(${identifier})(?:\s|/\*[^*]*(?:\*(?!/)[^*]*)*\*/)*:`)],
  ];
  const cssEdges = [
    "a{color:rgb(1,2,3)}",
    "translate\\e9 (x)",
    "--var: f(x)",
    "\\31 f(a)",
    "\\0000e9(x)",
    "\\1234567(",
    "\\abcdefa(",
    "\\e9\u00a0x(",
    "\\e9\u2028(",
    "\n \n\\Af99Afa(",
    ".c\\31 23 x",
    "[ \\41 b]",
    "\\FFFFFF0(",
    "--x\\0  :y",
    "a\\\r\nb(",
    "\\e9\r\n(x)",
    "\ud83d\ude00\\41(",
  ];

  it.each(compositions)("CSS identifier in the %s pattern", (_name, compose) => {
    expectSameMatches(compose(CSS_IDENTIFIER), compose(OLD_CSS_IDENTIFIER), [
      ...cssEdges,
      ...corpus("\\0aAfF9_- \t\n\r\f\v\u00a0\u2028\u3000\u0080(x{.[:", 20_000, 16, 7),
    ]);
  });

  it("bash double-quoted string", () => {
    expectSameMatches(patternOf(bash.tokens.string, 1), OLD_BASH_STRING, [
      'echo "hello $USER ${HOME} $(date) \\" done"',
      '"$"',
      '"a$"',
      '"$a$b"',
      'x="$HOME:$PATH"',
      'echo "unterminated $00',
      ...corpus('"\\$(){}a0_ \t\n\r\'x', 20_000, 16, 11),
    ]);
  });

  it("TOML number", () => {
    expectSameMatches(patternOf(toml.tokens.number), OLD_TOML_NUMBER, [
      "a = 1_000",
      "b = 3.14",
      "c = 1.5e-3",
      "d = 0xDEAD_BEEF",
      "e = 0o755",
      "f = 0b1101",
      "g = inf",
      "h = 1._2",
      "i = 1.",
      "j = .5_1",
      ...corpus("0123456789_.eE+-xobfinaG ", 20_000, 14, 3),
    ]);
  });
});
