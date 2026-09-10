import type { GrammarTokens, TokenMatcherContext, TokenPattern } from "../../core/types";
import { scanPython, type PythonMode, type PythonRange } from "./python-scanner";

export function withPythonExpressions(base: GrammarTokens): GrammarTokens {
  const scans = new WeakMap<TokenMatcherContext, { source: string; mode: PythonMode; ranges: PythonRange[] }>();
  const lexical = (kind: PythonRange["kind"], mode: PythonMode = "code"): TokenPattern => ({
    pattern: /[^]/,
    greedy: true,
    matcher: function* (source, context) {
      const cached = context && scans.get(context);
      const ranges = cached?.source === source && cached.mode === mode ? cached.ranges : Array.from(scanPython(source, mode, context));
      if (context && ranges !== cached?.ranges) scans.set(context, { source, mode, ranges });
      for (const range of ranges) if (range.kind === kind) yield { index: range.start, text: source.slice(range.start, range.end) };
    },
  });
  const formatted: TokenPattern = { ...lexical("f-string"), alias: "f-string" };
  const rawFormatted: TokenPattern = { ...lexical("raw-f-string"), alias: "f-string" };
  const tokens: GrammarTokens = {
    comment: lexical("comment"),
    "triple-string": { ...lexical("triple-string"), alias: "string" },
    string: [lexical("string"), formatted, rawFormatted],
    ...base,
  };
  for (const [pattern, raw] of [[formatted, false], [rawFormatted, true]] as const) {
    const fieldMode = raw ? "raw-field" : "field";
    const interpolation: TokenPattern = lexical("interpolation", "f-string");
    const nested: TokenPattern = lexical("interpolation", raw ? "raw-format" : "format");
    const fields: GrammarTokens = {
      "interpolation-punctuation": { ...lexical("punctuation", fieldMode), alias: "punctuation" },
      expression: { ...lexical("expression", fieldMode), inside: tokens },
      conversion: { ...lexical("conversion", fieldMode), alias: "punctuation" },
      "format-specifier": { ...lexical("format-specifier", fieldMode), alias: "string", inside: {
        punctuation: /^:/, interpolation: nested,
      } },
    };
    interpolation.inside = fields;
    nested.inside = fields;
    pattern.inside = { interpolation };
  }
  return tokens;
}
