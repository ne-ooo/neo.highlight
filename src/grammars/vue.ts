import type { Grammar } from "../core/types";
import { html } from "./html";

export const vue: Grammar = {
  name: "vue",
  aliases: ["vue-html"],
  tokens: {
    ...html.tokens,
    directive: {
      pattern:
        /(?:v-[\w-]+|[:@#][\w-]+)(?:\.[\w-]+)*(?:\s*=\s*(?:"[^"]*"|'[^']*'))?/,
      inside: {
        "attr-name": {
          pattern: /^(?:v-[\w-]+|[:@#][\w-]+)(?:\.[\w-]+)*/,
          alias: "keyword",
        },
        "attr-value": {
          pattern: /=[\s\S]+/,
          inside: {
            punctuation: [
              /^=/,
              { pattern: /^["']|["']$/, alias: "attr-equals" },
            ],
          },
        },
      },
    },
    interpolation: {
      pattern: /\{\{[^}]*\}\}/,
      inside: {
        punctuation: /^\{\{|\}\}$/,
      },
    },
  },
};
