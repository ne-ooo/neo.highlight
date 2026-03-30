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
