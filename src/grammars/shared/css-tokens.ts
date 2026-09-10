import type { GrammarTokens, TokenMatcherContext, TokenPattern } from "../../core/types";
import { scanCSS, CSS_IDENTIFIER, type CssRange } from "./css-scanner";

export function createCssTokens(dialect: "css" | "scss" | "less" = "css"): GrammarTokens {
  const scans = new WeakMap<TokenMatcherContext, { source: string; ranges: CssRange[] }>();
  const lexical = (kind: CssRange["kind"]): TokenPattern => ({
    pattern: /[^]/, greedy: true,
    matcher: function* (source, context) {
      const cached = context && scans.get(context);
      const ranges = cached?.source === source ? cached.ranges : scanCSS(source, context, dialect);
      if (context && ranges !== cached?.ranges) scans.set(context, { source, ranges });
      for (const range of ranges) if (range.kind === kind) yield { index: range.start, text: source.slice(range.start, range.end) };
    },
  });
  // These lexical rules also protect nested selector/at-rule strings and comments.
  const comment = lexical("comment");
  const string = lexical("string");
  const identifier = (prefix: string): RegExp => new RegExp(prefix + CSS_IDENTIFIER, "u");
  const url: TokenPattern = { ...lexical("url"), inside: {
    function: /^url/i, string, punctuation: /[()]/,
  } };
  const selector: TokenPattern = { ...lexical("selector"), inside: {
    comment, string,
    "attribute-selector": { pattern: /\[(?:\\[\s\S]|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|[^\]"'\\])*\]/, greedy: true,
      inside: { string, "attr-name": { pattern: new RegExp(`^(\\[\\s*)${CSS_IDENTIFIER}`, "u"), lookbehind: true }, operator: /[~|^$*]?=/, punctuation: /[\[\]]/ } },
    "pseudo-element": identifier("::"),
    "pseudo-class": identifier(":"),
    "class-name": identifier("\\."),
    "id-selector": identifier("#"),
    combinator: /[>+~]|\|\|/,
    punctuation: /[(),&]/,
  } };
  return {
    comment, string,
    atrule: { ...lexical("atrule"), inside: { comment, string, url, keyword: identifier("^@"), function: new RegExp(`${CSS_IDENTIFIER}(?=\\()`, "u"), punctuation: /[():;,]/ } },
    url, selector, property: lexical("property"),
    variable: /--[\w-]+/,
    important: /!\s*important\b/i,
    function: { pattern: new RegExp(`(^|[^\\w-])${CSS_IDENTIFIER}(?=\\()`, "u"), lookbehind: true, alias: "builtin" },
    "hex-color": { pattern: /#(?:[\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})(?![\w-])/i, alias: "number" },
    number: /(?<![\w-])[+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?(?:%|[a-z]+)?(?![\w-])/i,
    operator: /[+*/%~-]/,
    keyword: /\b(?:and|not|only|or|from|to|inherit|initial|unset|revert|revert-layer)\b/,
    punctuation: /[{}();:,]/,
  };
}
