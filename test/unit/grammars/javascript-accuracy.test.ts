import { describe, expect, it } from "vitest";
import { getPlainText, tokenize } from "../../../src/core/tokenizer";
import type { Grammar, Token } from "../../../src/core/types";
import { javascript } from "../../../src/grammars/javascript";
import { typescript } from "../../../src/grammars/typescript";
import { jsx } from "../../../src/grammars/jsx";
import { tsx } from "../../../src/grammars/tsx";

type Expected = readonly [type: string, text: string, occurrence?: number];
interface Fixture { name: string; code: string; spans: Expected[]; absent?: Expected[] }

// These expectations describe reviewed lexical spans, not another highlighter's output.
function spansOf(tokens: Token[], offset = 0): Array<{ type: string; text: string; start: number; end: number }> {
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

function verify(grammar: Grammar, fixture: Fixture): void {
  const tokens = tokenize(fixture.code, grammar);
  expect(getPlainText(tokens)).toBe(fixture.code);
  const spans = spansOf(tokens);
  for (const span of spans) expect(fixture.code.slice(span.start, span.end)).toBe(span.text);
  for (const [type, text, occurrence = 0] of fixture.spans) {
    let start = -1;
    for (let index = 0; index <= occurrence; index++) start = fixture.code.indexOf(text, start + 1);
    expect(start, `Fixture is missing occurrence ${occurrence} of ${text}`).toBeGreaterThanOrEqual(0);
    expect(spans, `${type}: ${text} at ${start}`).toContainEqual({ type, text, start, end: start + text.length });
  }
  for (const [type, text] of fixture.absent ?? []) expect(spans).not.toEqual(expect.arrayContaining([expect.objectContaining({ type, text })]));
}

const shared: Fixture[] = [
  {
    name: "balanced object expressions inside templates",
    code: 'const result = `value ${format({ nested: { value: 1 } })} tail`;',
    spans: [["string", '`value ${format({ nested: { value: 1 } })} tail`'], ["interpolation", '${format({ nested: { value: 1 } })}'], ["function", "format"], ["number", "1"]],
  },
  {
    name: "nested templates keep their own expression grammar",
    code: '`outer ${`inner ${true ? 1 : 2}`} tail`',
    spans: [["string", '`inner ${true ? 1 : 2}`'], ["interpolation", '${true ? 1 : 2}'], ["boolean", "true"], ["number", "2"]],
  },
  {
    name: "braces in regexes and quoted strings are inert",
    code: '`value ${/[}]/g.test(value) ? "}" : "{"} tail`',
    spans: [["interpolation", '${/[}]/g.test(value) ? "}" : "{"}'], ["regex", "/[}]/g"], ["string", '"}"'], ["string", '"{"']],
  },
  {
    name: "comments cannot close an interpolation",
    code: '`value ${/* } */ (() => { // }\nreturn 42; })()} tail`',
    spans: [["comment", "/* } */"], ["comment", "// }"], ["keyword", "return"], ["number", "42"]],
  },
  {
    name: "comment markers inside strings and regex character classes",
    code: 'const url = "https://example.com/*x*/"; const pattern = /["/]/g; // real',
    spans: [["string", '"https://example.com/*x*/"'], ["regex", '/["/]/g'], ["comment", "// real"]],
    absent: [["comment", "/*x*/"]],
  },
  {
    name: "escaped template delimiters stay literal",
    code: '`escaped \\${false} and \\` literal ${true}`',
    spans: [["interpolation", "${true}"], ["boolean", "true"]],
    absent: [["boolean", "false"], ["interpolation", "${false}"]],
  },
  {
    name: "unfinished templates keep expression tokens",
    code: '`unfinished ${format({ value: 1',
    spans: [["string", '`unfinished ${format({ value: 1'], ["interpolation", '${format({ value: 1'], ["function", "format"], ["number", "1"]],
  },
  {
    name: "unfinished quotes stop at a raw newline",
    code: 'const value = "unfinished\nconst next = 2;',
    spans: [["string", '"unfinished'], ["number", "2"]],
  },
  {
    name: "quoted line continuations include CRLF",
    code: 'const value = "first\\\r\nsecond";\r\nconst next = 2;',
    spans: [["string", '"first\\\r\nsecond"'], ["number", "2"]],
  },
  {
    name: "division after values and postfix expressions is not a regex",
    code: 'const result = (value + 1) / total / scale; count++ / 2; ({ value: 1 }) / 2;',
    spans: [["keyword", "const"], ["number", "2"]],
    absent: [["regex", "/ total /"], ["regex", "/ 2; ({ value: 1 }) /"], ["regex", "/ 2;"]],
  },
  {
    name: "regex literals after control parentheses and return",
    code: 'if (ready) /ab+/.test(value); function f() { return /[}]/v; }',
    spans: [["regex", "/ab+/"], ["regex", "/[}]/v"]],
  },
  {
    name: "keywords do not split Unicode or dollar identifiers",
    code: 'const café = 1; const λreturn = 2; const $false = 3; const returnValue = 4;',
    spans: [["keyword", "const"], ["number", "4"]],
    absent: [["keyword", "return"], ["boolean", "false"]],
  },
  {
    name: "member names keep identifier context across whitespace and comments",
    code: 'object.return / 2; object?. /* comment */\nfalse; object.\nclass;',
    spans: [["comment", "/* comment */"], ["number", "2"]],
    absent: [["keyword", "return"], ["keyword", "class"], ["boolean", "false"], ["regex", "/ 2; object?. "]],
  },
  {
    name: "decimal points, separators, exponents, and BigInt spans",
    code: 'const values = [.5, 1., 1_000.25, 1e-3, 0xFFn, 0b10_01n, 123n];',
    spans: [["number", ".5"], ["number", "1."], ["number", "1_000.25"], ["number", "1e-3"], ["number", "0xFFn"], ["number", "0b10_01n"], ["number", "123n"]],
  },
  {
    name: "hashbang and Unicode line terminators",
    code: '#!/usr/bin/env node\n// comment\u2028const value = true;\u2029const next = 2;',
    spans: [["comment", "#!/usr/bin/env node"], ["comment", "// comment"], ["boolean", "true"], ["number", "2"]],
  },
  {
    name: "Unicode function names and default-export regexes",
    code: 'function привет() { return true; } export default /[a&&b]/v;',
    spans: [["function", "привет"], ["regex", "/[a&&b]/v"]],
  },
];

for (const grammar of [javascript, typescript, jsx, tsx]) {
  describe(`${grammar.name} lexical accuracy`, () => {
    it.each(shared)("$name", fixture => verify(grammar, fixture));
  });
}

const markup: Fixture[] = [
  {
    name: "nested object attributes and body expressions",
    code: '<Button data-id={user.id} options={{ nested: { count: 2 } }}>{true ? render(1) : null}</Button>',
    spans: [["attr-name", "data-id"], ["expression", '{{ nested: { count: 2 } }}'], ["number", "2"], ["boolean", "true"], ["function", "render"], ["keyword", "null"]],
  },
  {
    name: "nested markup inside attributes and expression bodies",
    code: '<Panel render={() => <UI.Icon title="ok" />}><span>{count + 1}</span></Panel>',
    spans: [["tag", '<UI.Icon title="ok" />'], ["tag", "<span>"], ["expression", "{count + 1}"], ["number", "1"]],
  },
  {
    name: "JSX text is not JavaScript",
    code: '<div>return true // text "quotes" don\'t /* comment */ 123 `literal`</div>; const after = 2;',
    spans: [["plain-text", 'return true // text "quotes" don\'t /* comment */ 123 `literal`'], ["keyword", "const"], ["number", "2", 1]],
    absent: [["keyword", "return"], ["boolean", "true"], ["number", "123"], ["comment", "/* comment */"]],
  },
  {
    name: "fragments, namespaces, member names, and boolean attributes",
    code: '<><svg:path aria-hidden disabled/><UI.Button {...props}>hello</UI.Button></>',
    spans: [["tag", "<>"], ["tag", "</>"], ["attr-name", "aria-hidden"], ["attr-name", "disabled"], ["expression", "{...props}"], ["operator", "..."], ["plain-text", "hello"]],
  },
  {
    name: "braces and greater-than signs inside attribute strings",
    code: '<Widget title="} > // literal" onClick={() => { return /[}]/.test(value); }} />',
    spans: [["attr-value", '"} > // literal"'], ["regex", "/[}]/"], ["keyword", "return"]],
  },
  {
    name: "templates and markup nest in both directions",
    code: '`outer ${<Box title={`inner ${count + 1}`}>{true}</Box>}`',
    spans: [["string", '`inner ${count + 1}`'], ["expression", "{true}"], ["boolean", "true"], ["number", "1"]],
  },
  {
    name: "comparison operators do not start tags",
    code: 'const smaller = left < right && right > 0; const markup = ready ? <A/> : <B/>;',
    spans: [["tag", "<A/>"], ["tag", "<B/>"], ["operator", "<"]],
    absent: [["tag", "< right && right >"]],
  },
  {
    name: "unfinished attributes keep nested code",
    code: '<Widget options={{ value: 1',
    spans: [["tag", '<Widget options={{ value: 1'], ["expression", '{{ value: 1'], ["number", "1"]],
  },
];
for (const grammar of [jsx, tsx]) {
  describe(`${grammar.name} markup accuracy`, () => {
    it.each(markup)("$name", fixture => verify(grammar, fixture));
  });
}

for (const grammar of [typescript, tsx]) {
  describe(`${grammar.name} expression types`, () => {
    it("uses TypeScript keywords and builtins inside template expressions", () => verify(grammar, {
      name: "template types", code: '`value ${value satisfies Record<string, number>}`',
      spans: [["keyword", "satisfies"], ["builtin", "Record"], ["builtin", "string"], ["builtin", "number"]],
    }));
    it("does not confuse generic arrows or generic calls with JSX", () => verify(grammar, {
      name: "generics", code: 'const identity = <T,>(value: T): T => value; const constrained = <T extends Record<string, number>>(value: T) => value; identity<string>("ok");',
      spans: [["keyword", "extends"], ["class-name", "Record"], ["generic-function", "identity", 1]],
      absent: [["tag", "<string>"]],
    }));
    it("recognizes deeply nested generic calls and function type arguments", () => verify(grammar, {
      name: "nested generic calls", code: 'convert<Map<string, Array<Promise<number>>>>(value); call<(x: string) => number>(fn);',
      spans: [["generic-function", "convert"], ["generic-function", "call"], ["builtin", "Promise"], ["builtin", "number"]],
    }));
  });
}

it("uses TypeScript tokens inside TSX attributes and body expressions", () => verify(tsx, {
  name: "TSX types", code: '<Box value={input as string}>{value satisfies Record<string, number>}</Box>',
  spans: [["keyword", "as"], ["keyword", "satisfies"], ["builtin", "string"], ["builtin", "number"]],
}));

it("supports nested type arguments and function types on JSX components", () => verify(tsx, {
  name: "generic component", code: '<List<Record<string, Array<number>>> render={item => <Item<(x: number) => string> value={item} />} />',
  spans: [["type-arguments", "<Record<string, Array<number>>>"], ["type-arguments", "<(x: number) => string>"], ["builtin", "Record"], ["builtin", "number"], ["builtin", "string"], ["attr-name", "render"]],
}));

it("preserves immutable grammar reuse and applies resource limits in nested expressions", () => {
  const code = '`outer ${`inner ${true ? 1 : 2}`}`';
  for (const grammar of [javascript, typescript, jsx, tsx]) {
    const first = tokenize(code, grammar);
    expect(tokenize(code, grammar)).toEqual(first);
    for (const limit of ["maxMatchCount", "maxTokenCount", "maxTokenDepth"] as const) {
      expect(() => tokenize(code, grammar, { [limit]: 0 })).toThrow(limit);
    }
    const deep = '`value ${'.repeat(120) + '1' + '}`'.repeat(120);
    expect(() => tokenize(deep, grammar)).toThrow("maxTokenDepth");
    const raised = '`value ${'.repeat(55) + '1' + '}`'.repeat(55);
    expect(getPlainText(tokenize(raised, grammar, { maxTokenDepth: 200 }), { maxTokenDepth: 200 })).toBe(raised);
    expect(getPlainText(tokenize(code, grammar, { maxTokenDepth: Infinity }))).toBe(code);
    expect(getPlainText(tokenize(code, grammar))).toBe(code);
  }
});
