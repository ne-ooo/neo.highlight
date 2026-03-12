import type { Grammar } from "../core/types";
import { javascript } from "./javascript";

export const jsx: Grammar = {
  name: "jsx",
  aliases: ["react"],
  tokens: {
    ...javascript.tokens,
    tag: {
      pattern:
        /<\/?(?:[a-z]\w*(?:\.\w+)*|\{[^{}]*\})(?:\s+(?:[\w$]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}))?|\{\.{3}\w+\}))*\s*\/?>/i,
      greedy: true,
      inside: {
        tag: {
          pattern: /^<\/?[^\s>/]+/,
          inside: {
            punctuation: /^<\/?/,
            namespace: /^[a-z]\w*(?=\.)/,
          },
        },
        "attr-value": {
          pattern: /=\s*(?:"[^"]*"|'[^']*'|\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/,
          inside: {
            punctuation: [
              /^=/,
              { pattern: /^["']|["']$/, alias: "attr-equals" },
            ],
          },
        },
        "attr-name": /\b[\w$]+(?=\s*=)/,
        "spread-operator": {
          pattern: /\{\.{3}\w+\}/,
          alias: "operator",
        },
        punctuation: /\/?>/,
      },
    },
  },
};
