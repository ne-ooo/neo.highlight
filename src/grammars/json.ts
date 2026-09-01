import type { Grammar } from "../core/types";
import { createNonNestingDelimitedPattern } from "../core/grammar-utils";

export const json: Grammar = {
  name: "json",
  aliases: ["jsonc", "json5"],
  tokens: {
    comment: [
      { pattern: /\/\/.*/, greedy: true },
      { pattern: createNonNestingDelimitedPattern("/*", "*/"), greedy: true },
    ],
    property: {
      pattern: /(^|[,{\[])[^\S\r\n]*"(?:\\[\s\S]|[^\\"])*"(?=[^\S\r\n]*:)/m,
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
