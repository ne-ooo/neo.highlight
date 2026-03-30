import type { Grammar } from "../core/types";
import { html } from "./html";

export const astro: Grammar = {
  name: "astro",
  aliases: [],
  tokens: {
    frontmatter: {
      pattern: /^---[\s\S]*?^---/m,
      greedy: true,
      alias: "important",
      inside: {
        punctuation: /^---|---$/,
      },
    },
    ...html.tokens,
    expression: {
      pattern: /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/,
      greedy: true,
      inside: {
        punctuation: /^\{|\}$/,
      },
    },
  },
};
