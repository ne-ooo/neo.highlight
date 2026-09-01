import type { Grammar } from "../core/types";
import { createNonNestingDelimitedPattern } from "../core/grammar-utils";
import { css } from "./css";

export const less: Grammar = {
  name: "less",
  aliases: [],
  tokens: {
    mixin: {
      pattern: /((?:^|[{;])[^\S\r\n]*)\.[\w-]+[^\S\r\n]*(?:\([^()\r\n]*\))?[^\S\r\n]*(?=[;{])/m,
      lookbehind: true,
      alias: "function",
    },
    ...css.tokens,
    comment: [
      { pattern: createNonNestingDelimitedPattern("/*", "*/"), greedy: true },
      { pattern: /\/\/.*/, greedy: true },
    ],
    atrule: [
      {
        pattern:
          /@[\w-](?:\([^(){}\r\n]*\)|[^(){};@\r\n])*(?=[^\S\r\n]*\{)/,
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
    "string-interpolation": {
      pattern: /@\{[\w-]+\}/,
      alias: "variable",
    },
  },
};
