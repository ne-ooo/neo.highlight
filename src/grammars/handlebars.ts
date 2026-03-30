import type { Grammar } from "../core/types";
import { html } from "./html";

export const handlebars: Grammar = {
  name: "handlebars",
  aliases: ["hbs", "mustache"],
  tokens: {
    "handlebars-comment": {
      pattern: /\{\{!--[\s\S]*?--\}\}|\{\{![\s\S]*?\}\}/,
      greedy: true,
      alias: "comment",
    },
    "raw-block": {
      pattern: /\{\{\{\{[\s\S]*?\}\}\}\}/,
      greedy: true,
      inside: {
        punctuation: /^\{\{\{\{|\}\}\}\}$/,
      },
    },
    block: {
      pattern:
        /\{\{[#/~^]?\s*[\w.]+[^}]*\}\}/,
      greedy: true,
      inside: {
        punctuation: /^\{\{[#/~^]?|\}\}$/,
        keyword:
          /\b(?:if|else|unless|each|with|lookup|log|helper|blockHelperMissing|helperMissing)\b/,
        string: {
          pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
          greedy: true,
        },
        variable: /[\w.]+/,
      },
    },
    expression: {
      pattern: /\{\{[{]?[\s\S]*?[}]?\}\}/,
      greedy: true,
      inside: {
        punctuation: /^\{\{\{?|\}?\}\}$/,
        variable: /[\w.]+/,
      },
    },
    ...html.tokens,
  },
};
