import type { Grammar } from "../core/types";
import { createCssTokens } from "./shared/css-tokens";

export const less: Grammar = {
  name: "less",
  aliases: [],
  tokens: {
    mixin: {
      pattern: /((?:^|[{;])[^\S\r\n]*)\.[\w-]+[^\S\r\n]*(?:\([^()\r\n]*\))?[^\S\r\n]*(?=[;{])/m,
      lookbehind: true,
      alias: "function",
    },
    ...createCssTokens("less"),
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
