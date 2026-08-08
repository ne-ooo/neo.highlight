import type { Grammar, TokenPattern } from "../core/types";
import { html } from "./html";

const directive: TokenPattern = {
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
};

const htmlTag = html.tokens["tag"] as TokenPattern;

export const vue: Grammar = {
  name: "vue",
  aliases: ["vue-html"],
  tokens: {
    ...html.tokens,
    tag: {
      ...htmlTag,
      inside: {
        directive,
        ...htmlTag.inside,
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
