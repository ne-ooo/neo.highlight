import { describe, expect, it } from "vitest";
import { tokenize } from "../../../src/core/tokenizer";
import { css } from "../../../src/grammars/css";
import { scss } from "../../../src/grammars/scss";
import { less } from "../../../src/grammars/less";
import { verify, type AccuracyFixture } from "./accuracy-helpers";

const fixtures: AccuracyFixture[] = [
  { name: "multiline selector lists", code: '.card,\n#main > article:hover::before { color: red; }', spans: [["selector", ".card,\n#main > article:hover::before"], ["class-name", ".card"], ["id-selector", "#main"], ["pseudo-class", ":hover"], ["pseudo-element", "::before"], ["property", "color"]] },
  { name: "quoted braces and comment markers in selectors", code: '[data-label="{/* literal */}"]:is(.one, :not(.two)) { content: "/* not a comment */"; }', spans: [["attr-name", "data-label"], ["string", '"{/* literal */}"'], ["pseudo-class", ":not"], ["class-name", ".two"], ["string", '"/* not a comment */"']], absent: [["comment", "/* literal */"], ["comment", "/* not a comment */"]] },
  { name: "comments between selector and declaration parts", code: '.a /* { */ > .b { /* x */ color: red; margin /* gap */: 0; }', spans: [["selector", ".a /* { */ > .b"], ["comment", "/* { */"], ["comment", "/* x */"], ["property", "color"], ["property", "margin"]] },
  { name: "nested rules and declarations", code: '.a { color: red; &:hover { color: blue; } padding: 1rem; }', spans: [["selector", "&:hover"], ["property", "color", 1], ["property", "padding"]] },
  { name: "custom property blocks do not become selectors", code: ':root { --theme: { foreground: red; nested: { value: 1 }; }; color: var(--theme); }', spans: [["property", "--theme"], ["property", "color"], ["variable", "--theme", 1]], absent: [["selector", "--theme:"], ["selector", "nested:"]] },
  { name: "multiline at-rules with functions", code: '@supports\n(selector(:is(a, b))) { @media (width >= 30rem) { .a { display: grid; } } }', spans: [["atrule", "@supports\n(selector(:is(a, b)))"], ["function", "selector"], ["keyword", "@media"], ["property", "display"]] },
  { name: "import strings and URLs", code: '@import url("theme.css") layer(base); a { background: URL(data:image/svg+xml,%3Csvg%3E); }', spans: [["string", '"theme.css"'], ["url", 'url("theme.css")'], ["url", "URL(data:image/svg+xml,%3Csvg%3E)"]] },
  { name: "escaped URL parentheses and literal comment markers", code: 'a { background: url(a\\)b/*literal*/.png); color: red; }', spans: [["url", "url(a\\)b/*literal*/.png)"], ["property", "color"]], absent: [["comment", "/*literal*/"]] },
  { name: "escaped and Unicode identifiers", code: '.caf\\e9, .λ { --色: 1; c\\6f lor: red; }', spans: [["class-name", ".caf\\e9"], ["class-name", ".λ"], ["property", "--色"], ["property", "c\\6f lor"]] },
  { name: "signed numbers dimensions and hex colors", code: 'a { x: -.5rem +1e-3s 0% #abcd #AABBCCDD #123; }', spans: [["number", "-.5rem"], ["number", "+1e-3s"], ["number", "0%"], ["hex-color", "#abcd"], ["hex-color", "#AABBCCDD"], ["hex-color", "#123"]] },
  { name: "declaration fragments for style attributes", code: 'color: red; margin: calc(100% - var(--gap));', spans: [["property", "color"], ["property", "margin"], ["function", "calc"], ["variable", "--gap"]] },
  { name: "strings stop at unescaped newlines", code: 'a { content: "broken\n; color: red; }', spans: [["string", '"broken'], ["property", "color"]] },
  { name: "escaped CRLF within strings", code: 'a { content: "first\\\r\nlast"; }', spans: [["string", '"first\\\r\nlast"']] },
  { name: "unfinished comment", code: 'a { color: red; /* unfinished', spans: [["comment", "/* unfinished"], ["property", "color"]] },
  { name: "unfinished URL", code: 'a { background: url("unfinished', spans: [["url", 'url("unfinished'], ["string", '"unfinished']] },
];
describe("CSS lexical accuracy", () => {
  it.each(fixtures)("$name", fixture => verify(css, fixture));
  it.each([scss, less])("preserves inherited declaration handling in $name", grammar => verify(grammar, fixtures[3]!));
  it("preserves SCSS variables, comments and interpolation", () => verify(scss, { name: "scss", code: '$tone: red; // comment\n.a { color: $tone; content: "#{$tone}"; }', spans: [["variable", "$tone"], ["comment", "// comment"], ["property", "color"]] }));
  it("enforces nesting and shared token budgets", () => {
    for (const limit of ["maxTokenDepth", "maxMatchCount", "maxTokenCount"] as const) expect(() => tokenize('a { color: red; }', css, { [limit]: 0 })).toThrow(limit);
    expect(() => tokenize('a { x: fn('.repeat(1000), css)).toThrow("maxTokenDepth");
  });
});
