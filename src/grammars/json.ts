import type { Grammar } from "../core/types";

export const json: Grammar = {
  name: "json",
  aliases: ["jsonc", "json5"],
  tokens: {
    comment: [
      { pattern: /\/\/.*/, greedy: true },
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
    ],
    property: {
      pattern: /(^|[,{\[])\s*"(?:\\[\s\S]|[^\\"])*"(?=\s*:)/m,
      lookbehind: true,
      greedy: true,
    },
    string: {
      pattern: /"(?:\\[\s\S]|[^\\"])*"/,
      greedy: true,
    },
    number: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,
    boolean: /\b(?:true|false)\b/,
    keyword: /\bnull\b/,
    operator: /:/,
    punctuation: /[{}[\],]/,
  },
};
