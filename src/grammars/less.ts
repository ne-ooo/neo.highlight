import type { Grammar } from "../core/types";
import { css } from "./css";

export const less: Grammar = {
  name: "less",
  aliases: [],
  tokens: {
    ...css.tokens,
    comment: [
      { pattern: /\/\*(?:(?!\/\*|\*\/)[\s\S])*\*\//, greedy: true },
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
    mixin: {
      pattern: /(?:^|[{;])[^\S\r\n]*\.[\w-]+[^\S\r\n]*(?:\([^()\r\n]*\))?[^\S\r\n]*[;{]/m,
      lookbehind: true,
      alias: "function",
    },
    "string-interpolation": {
      pattern: /@\{[\w-]+\}/,
      alias: "variable",
    },
  },
};
