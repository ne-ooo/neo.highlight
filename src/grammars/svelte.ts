import type { Grammar } from "../core/types";
import { html } from "./html";

export const svelte: Grammar = {
  name: "svelte",
  aliases: [],
  tokens: {
    ...html.tokens,
    block: {
      pattern:
        /\{[#:/](?:if|else|each|await|then|catch|key|snippet|html|debug|const|render)\b[^}]*\}/,
      greedy: true,
      inside: {
        punctuation: /^\{[#/:]|\}$/,
        keyword:
          /\b(?:if|else|each|await|then|catch|key|snippet|html|debug|const|render|as)\b/,
      },
    },
    expression: {
      pattern: /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/,
      greedy: true,
      inside: {
        punctuation: /^\{|\}$/,
      },
    },
  },
};
