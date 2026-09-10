import type { Grammar, GrammarTokens, TokenMatcherContext, TokenPattern } from "../../core/types";
import { javascriptExpressionEnd } from "./javascript-scanner";
import { markupAttributes, markupTag, scanMarkup, svelteContentStart, type Attribute, type MarkupMode, type MarkupRange } from "./markup-scanner";

const entity: TokenPattern = { pattern: /&(?:[a-zA-Z][a-zA-Z\d]{1,31}|#[\d]{1,7}|#[xX][\da-fA-F]{1,6});/, alias: "builtin" };
interface EmbeddedGrammars { javascript: Grammar; typescript?: Grammar; json: Grammar; css: Grammar; scss?: Grammar }

function valueBounds(source: string): { start: number; end: number } {
  let start = /^=\s*/.exec(source)?.[0].length ?? 0;
  const quote = source[start];
  const quoted = quote === '"' || quote === "'";
  if (quoted) start++;
  return { start, end: quoted && source.length > start && source.at(-1) === quote ? source.length - 1 : source.length };
}
function bodyPattern(inside: GrammarTokens, bounds: (source: string) => { start: number; end: number }): TokenPattern {
  return { pattern: /[^]/, greedy: true, inside,
    matcher: function* (source) { const { start, end } = bounds(source); if (end > start) yield { index: start, text: source.slice(start, end) }; },
  };
}
function expressionTokens(grammar: Grammar, vue = false, block = false): GrammarTokens {
  return {
    punctuation: vue ? /^\{\{|\}\}$/ : /^\{[#:/@]?|\}$/,
    ...(block ? { keyword: { pattern: /(^\{[#:/@])\w+/, lookbehind: true } } : {}),
    expression: bodyPattern(grammar.tokens, source => {
      const start = vue ? 2 : block ? svelteContentStart(source, 0) : 1;
      const closing = vue ? "}}" : "}";
      return { start, end: source.endsWith(closing) ? source.length - closing.length : source.length };
    }),
  };
}

export function createMarkupTokens(mode: MarkupMode, grammars: EmbeddedGrammars): GrammarTokens {
  const scans = new WeakMap<TokenMatcherContext, { source: string; ranges: MarkupRange[] }>();
  const host = (kind: MarkupRange["kind"], language?: string): TokenPattern => ({
    pattern: /[^]/, greedy: true,
    matcher: function* (source, context) {
      const cached = context && scans.get(context);
      const ranges = cached?.source === source ? cached.ranges : scanMarkup(source, mode, context);
      if (context && ranges !== cached?.ranges) scans.set(context, { source, ranges });
      for (const range of ranges) if (range.kind === kind && (language === undefined || range.language === language)) {
        yield { index: range.start, text: source.slice(range.start, range.end) };
      }
    },
  });

  const textExpressions = (grammar: Grammar): GrammarTokens => ({
    [mode === "vue" ? "interpolation" : "expression"]: {
      pattern: /[^]/, greedy: true, inside: expressionTokens(grammar, mode === "vue"),
      matcher: function* (source, context) {
        for (let index = 0; index < source.length;) {
          if (mode === "vue" ? !source.startsWith("{{", index) : source[index] !== "{") { index++; continue; }
          const start = index;
          index = mode === "vue" ? javascriptExpressionEnd(source, index, context, index + 2, "}}")
            : javascriptExpressionEnd(source, index, context);
          yield { index: start, text: source.slice(start, index) };
        }
      },
    },
  });
  const tagTokens = (grammar: Grammar, tagMode: MarkupMode): GrammarTokens => {
    const tagScans = new WeakMap<TokenMatcherContext, { source: string; attributes: Attribute[]; nameEnd: number }>();
    const attributes = (source: string, context?: TokenMatcherContext) => {
      const cached = context && tagScans.get(context);
      if (cached?.source === source) return cached;
      const tag = source[0] === "<" ? markupTag(source, 0, tagMode, context) : undefined;
      const result = { source, attributes: tag?.attributes ?? markupAttributes(source, 0, tagMode, context).attributes, nameEnd: tag?.nameEnd ?? 0 };
      if (context) tagScans.set(context, result);
      return result;
    };
    const kindOf = (attribute: Attribute, source: string): string => attribute.expression ? "expression"
      : tagMode === "vue" && /^(?:v-|[:@#])/.test(attribute.name) ? "directive"
      // Mixed Svelte styles use host expressions. CSS strings and url() must
      // not consume those expressions as opaque CSS values.
      : tagMode === "svelte" && attribute.name.toLowerCase() === "style" && attribute.contentStart !== undefined
        && source.slice(attribute.contentStart, attribute.contentEnd).includes("{") ? "attribute"
      : attribute.name.toLowerCase() === "style" && attribute.valueStart !== undefined ? "style" : "attribute";
    const attrPattern = (part: "name" | "value" | "whole", kind?: string): TokenPattern => ({ pattern: /[^]/, greedy: true,
      matcher: function* (source, context) {
        for (const attribute of attributes(source, context).attributes) {
          if (kind !== undefined && kindOf(attribute, source) !== kind) continue;
          const start = part === "value" ? attribute.valueStart : attribute.start;
          const end = part === "name" ? attribute.nameEnd : attribute.end;
          if (start !== undefined && end > start) yield { index: start, text: source.slice(start, end) };
        }
      },
    });
    const valueTokens = (embedded?: Grammar): GrammarTokens => ({
      punctuation: [/^=/, { pattern: /(^=\s*)["']|["']$/, lookbehind: true, alias: "attr-equals" }],
      ...(embedded ? { expression: bodyPattern(embedded.tokens, valueBounds) } : {}),
      ...(tagMode === "svelte" && !embedded ? { expression: { pattern: /[^]/, greedy: true, inside: expressionTokens(grammar),
        matcher: function* (source: string, context?: TokenMatcherContext) {
          const bounds = valueBounds(source);
          for (let index = bounds.start; index < bounds.end;) {
            if (source[index] !== "{") { index++; continue; }
            const end = javascriptExpressionEnd(source, index, context);
            yield { index, text: source.slice(index, end) }; index = end;
          }
        },
      } } : {}), entity,
    });
    return {
      tag: { pattern: /[^]/, greedy: true,
        matcher: function* (source, context) {
          const end = attributes(source, context).nameEnd;
          if (end) yield { index: 0, text: source.slice(0, end) };
        }, inside: { punctuation: /^<\/?/, namespace: { pattern: /(^<\/?)[\w-]+(?=:)/, lookbehind: true } },
      },
      ...(tagMode === "vue" ? { directive: { ...attrPattern("whole", "directive"), inside: {
        "attr-name": { ...attrPattern("name"), alias: "keyword" },
        "attr-value": { ...attrPattern("value"), inside: valueTokens(grammar) },
      } } } : {}),
      ...(tagMode === "svelte" ? { expression: { ...attrPattern("whole", "expression"), inside: expressionTokens(grammar) } } : {}),
      "special-attr": { ...attrPattern("whole", "style"), inside: {
        "attr-name": attrPattern("name"), "attr-value": { ...attrPattern("value"), inside: valueTokens(grammars.css) },
      } },
      "attr-value": { ...attrPattern("value", "attribute"), inside: valueTokens() },
      "attr-name": attrPattern("name", "attribute"),
      punctuation: /\/?>$/,
    };
  };

  const scripts = { javascript: grammars.javascript, ...(grammars.typescript ? { typescript: grammars.typescript } : {}), json: grammars.json };
  const styles = { css: grammars.css, ...(grammars.scss ? { scss: grammars.scss } : {}) };
  const expressions = { javascript: grammars.javascript, typescript: grammars.typescript ?? grammars.javascript };
  return {
    comment: host("comment"),
    doctype: { ...host("doctype"), alias: "important", inside: { string: /"[^"]*"|'[^']*'/, punctuation: /^<!|>$/, "doctype-tag": /DOCTYPE/i } },
    cdata: host("cdata"), prolog: { ...host("prolog"), alias: "important" },
    script: [...Object.entries(scripts).map(([language, grammar]) => ({ ...host("script", language), alias: `language-${language}`, inside: grammar.tokens })), host("script", "plain")],
    style: [...Object.entries(styles).map(([language, grammar]) => ({ ...host("style", language), alias: `language-${language}`, inside: grammar.tokens })), host("style", "plain")],
    "plain-text": [
      { ...host("plain-text", "entities"), inside: { entity } },
      { ...host("plain-text", "entities-verbatim"), inside: { entity } },
      ...Object.entries(expressions).map(([language, grammar]) => ({ ...host("plain-text", `entities-${language}`), inside: { ...textExpressions(grammar), entity } })),
      host("plain-text", "plain"),
    ],
    tag: mode === "html" ? { ...host("tag"), inside: tagTokens(grammars.javascript, "html") }
      : [...Object.entries(expressions).map(([language, grammar]) => ({ ...host("tag", language), inside: tagTokens(grammar, mode) })), { ...host("tag", "plain"), inside: tagTokens(grammars.javascript, "html") }],
    ...(mode === "vue" ? { interpolation: Object.entries(expressions).map(([language, grammar]) => ({ ...host("interpolation", language), inside: expressionTokens(grammar, true) })) } : {}),
    ...(mode === "svelte" ? {
      block: Object.entries(expressions).map(([language, grammar]) => ({ ...host("block", language), inside: expressionTokens(grammar, false, true) })),
      expression: Object.entries(expressions).map(([language, grammar]) => ({ ...host("expression", language), inside: expressionTokens(grammar) })),
    } : {}),
    entity,
  };
}
