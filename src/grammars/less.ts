import type { Grammar } from "../core/types";
import { css } from "./css";

export const less: Grammar = {
  name: "less",
  aliases: [],
  tokens: {
    ...css.tokens,
    comment: [
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
      { pattern: /\/\/.*/, greedy: true },
    ],
    atrule: [
      {
        pattern:
          /@[\w-](?:\((?:[^(){}]|\([^(){}]*\))*\)|[^(){};\s]|\s+(?!\s))*?(?=\s*\{)/,
        greedy: true,
        inside: {
          punctuation: /[:()]/,
        },
      },
      {
        pattern:
          /@(?:charset|import|namespace|plugin|use|forward)\b[^;{}]*(?:;|$)/i,
        greedy: true,
        inside: {
          keyword: /^@[\w-]+/,
          string: {
            pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
            greedy: true,
          },
          punctuation: /[;:,]/,
        },
      },
    ],
    variable: /@[\w-]+/,
    mixin: {
      pattern: /(?:^|[{;])\s*\.[\w-]+\s*(?:\([^)]*\))?\s*[;{]/m,
      lookbehind: true,
      alias: "function",
    },
    "string-interpolation": {
      pattern: /@\{[\w-]+\}/,
      alias: "variable",
    },
  },
};
