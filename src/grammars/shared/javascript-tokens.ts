import type { GrammarTokens, TokenPattern, TokenPatternMatch, TokenMatcherContext } from "../../core/types";
import { scanJavaScript, skipJavaScriptTrivia, type LexicalKind, type LexicalRange, type ScanMode } from "./javascript-scanner";

/** Give each language its own recursive expression grammar, without mutating its base. */
export function withJavaScriptExpressions(base: GrammarTokens, jsx = false): GrammarTokens {
  const typed = Boolean(base["generic-function"]);
  // All lexical rules in one grammar pass share a scan. Weak keys prevent an
  // input-keyed cache from retaining documents between tokenizer calls.
  const scans = new WeakMap<TokenMatcherContext, { source: string; mode: ScanMode; ranges: LexicalRange[] }>();
  const ranges = (source: string, mode: ScanMode, context?: TokenMatcherContext): readonly LexicalRange[] => {
    if (!context) return Array.from(scanJavaScript(source, jsx, mode, undefined, 0, 1, typed));
    const cached = scans.get(context);
    if (cached?.source === source && cached.mode === mode) return cached.ranges;
    const result = Array.from(scanJavaScript(source, jsx, mode, context, 0, 1, typed));
    scans.set(context, { source, mode, ranges: result });
    return result;
  };
  const match = (kind: LexicalKind, mode: ScanMode = "code") => function* (source: string, context?: TokenMatcherContext): Iterable<TokenPatternMatch> {
    for (const range of ranges(source, mode, context)) {
      if (range.kind === kind) yield { index: range.start, text: source.slice(range.start, range.end) };
    }
  };
  const lexical = (kind: LexicalKind, mode: ScanMode = "code"): TokenPattern => ({
    pattern: /[^]/, matcher: match(kind, mode), greedy: true,
  });
  const template: TokenPattern = { ...lexical("template"), alias: "template-string" };
  const expression = lexical("expression");
  const tagExpression = lexical("expression", "tag");
  const typeArguments = lexical("type-arguments", "tag");
  const tag: TokenPattern = {
    ...lexical("tag"),
    inside: {
      tag: {
        pattern: /^<\/?[\p{ID_Start}_$][\p{ID_Continue}$.:\-]*/u,
        inside: { punctuation: /^<\/?|[.:]/ },
      },
      expression: tagExpression,
      "type-arguments": typeArguments,
      "attr-value": lexical("attr-value", "tag"),
      "attr-name": /[\p{ID_Start}_$][\p{ID_Continue}$:\-]*/u,
      punctuation: /<\/?|\/?>|=/,
    },
  };
  const lexemes: GrammarTokens = {
    comment: lexical("comment"),
    string: [lexical("string"), template],
    regex: lexical("regex"),
    ...(jsx ? { tag, "plain-text": lexical("text"), expression } : {}),
  };
  const tokens = { ...lexemes, ...base, ...lexemes };

  for (const type of ["number", "punctuation"]) {
    const value = base[type];
    const definition = value instanceof RegExp ? value : value && !Array.isArray(value) ? value.pattern : undefined;
    if (!definition) continue;
    tokens[type] = {
      pattern: definition,
      matcher: function* (source, context) {
        const scanned = ranges(source, "code", context);
        let rangeIndex = 0;
        const pattern = new RegExp(definition.source, definition.flags.replace(/[gy]/g, "") + "g");
        for (const candidate of source.matchAll(pattern)) {
          const start = candidate.index;
          const end = start + candidate[0].length;
          while (scanned[rangeIndex] && scanned[rangeIndex]!.end <= start) rangeIndex++;
          const range = scanned[rangeIndex];
          if (range?.kind === "identifier" && range.start < end && (range.start < start || range.end > end)) continue;
          yield { index: start, text: candidate[0] };
        }
      },
    };
  }

  if (base["function"]) tokens["function"] = {
    pattern: /[^]/,
    matcher: function* (source, context) {
      for (const range of ranges(source, "code", context)) {
        if (range.kind === "identifier" && source[skipJavaScriptTrivia(source, range.end)] === "(") {
          yield { index: range.start, text: source.slice(range.start, range.end) };
        }
      }
    },
  };
  if (base["class-name"]) tokens["class-name"] = {
    pattern: /[^]/,
    matcher: function* (source, context) {
      const scanned = ranges(source, "code", context);
      let expectedAt = -1;
      for (let index = 0; index < scanned.length; index++) {
        const range = scanned[index]!;
        if (range.kind === "comment") continue;
        if (range.kind === "identifier" && range.start === expectedAt) {
          let end = range.end;
          while (scanned[index + 1]?.kind === "identifier" && /^\s*\.\s*$/.test(source.slice(end, scanned[index + 1]!.start))) {
            end = scanned[++index]!.end;
          }
          yield { index: range.start, text: source.slice(range.start, end) };
          expectedAt = -1;
          continue;
        }
        const word = source.slice(range.start, range.end);
        expectedAt = range.kind === "identifier" && !range.property
          && (/^(?:class|extends|implements|instanceof|interface|new)$/.test(word) || typed && word === "type")
          ? skipJavaScriptTrivia(source, range.end) : -1;
      }
    },
  };

  // An identifier's spelling alone does not make obj.return or $return a keyword.
  for (const type of ["keyword", "boolean", "builtin", "constant"]) {
    const value = base[type];
    const definition = value instanceof RegExp ? value : value && !Array.isArray(value) ? value.pattern : undefined;
    if (!definition) continue;
    const wordPattern = new RegExp(`^(?:${definition.source})$`, definition.flags.replace(/[gy]/g, ""));
    tokens[type] = {
      pattern: definition,
      matcher: function* (source, context) {
        for (const range of ranges(source, "code", context)) {
          if (range.kind !== "identifier" || range.property) continue;
          const text = source.slice(range.start, range.end);
          if (wordPattern.test(text)) yield { index: range.start, text };
        }
      },
    };
  }

  const generic = base["generic-function"];
  if (generic && !Array.isArray(generic) && !(generic instanceof RegExp)) {
    tokens["generic-function"] = {
      ...generic,
      matcher: function* (source, context) {
        const lexicalRanges = ranges(source, "code", context);
        const closes = new Map<number, number>();
        const opens: number[] = [];
        let rangeIndex = 0;
        // Pair angle brackets once, including failed candidates. A search from
        // every name would rescan malformed `fn<fn<...` input quadratically.
        for (let index = 0; index < source.length; index++) {
          while (lexicalRanges[rangeIndex] && lexicalRanges[rangeIndex]!.end <= index) rangeIndex++;
          const range = lexicalRanges[rangeIndex];
          if (range && range.kind !== "identifier" && index === range.start) {
            index = range.end - 1;
            continue;
          }
          if (source[index] === "<") opens.push(index);
          else if (source[index] === ">" && source[index - 1] !== "=") {
            const open = opens.pop();
            if (open !== undefined) closes.set(open, index);
          }
        }
        for (const range of lexicalRanges) {
          if (range.kind !== "identifier") continue;
          let next = range.end;
          while (/\s/.test(source[next] ?? "")) next++;
          const close = closes.get(next);
          if (close === undefined) continue;
          next = close + 1;
          while (/\s/.test(source[next] ?? "")) next++;
          if (source[next] === "(") yield { index: range.start, text: source.slice(range.start, range.end) };
        }
      },
    };
  }

  // The delimiters have their own tokens; the expression body uses this language.
  const expressionTokens = { "interpolation-punctuation": { pattern: /^\$?\{|\}$/, alias: "punctuation" }, ...tokens };
  expression.inside = expressionTokens;
  tagExpression.inside = expressionTokens;
  if (jsx) typeArguments.inside = withJavaScriptExpressions(base);
  template.inside = {
    interpolation: { ...lexical("interpolation", "template"), inside: expressionTokens },
  };
  return tokens;
}
