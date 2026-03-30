import type { Grammar } from "../core/types";

export const latex: Grammar = {
  name: "latex",
  aliases: ["tex"],
  tokens: {
    comment: {
      pattern: /%.*/,
      greedy: true,
    },
    command: {
      pattern: /\\(?:[a-zA-Z@]+\*?|[^a-zA-Z\s])/,
      alias: "keyword",
    },
    "math-inline": {
      pattern: /\$(?:\\[\s\S]|[^$\\])+\$/,
      greedy: true,
      alias: "string",
      inside: {
        command: {
          pattern: /\\(?:[a-zA-Z@]+\*?|[^a-zA-Z\s])/,
          alias: "keyword",
        },
        punctuation: /[{}[\]^_&]/,
      },
    },
    "math-display": {
      pattern: /\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]/,
      greedy: true,
      alias: "string",
      inside: {
        command: {
          pattern: /\\(?:[a-zA-Z@]+\*?|[^a-zA-Z\s])/,
          alias: "keyword",
        },
        punctuation: /[{}[\]^_&]/,
      },
    },
    argument: {
      pattern: /\{[^{}]*\}/,
      inside: {
        punctuation: /[{}]/,
      },
    },
    "optional-argument": {
      pattern: /\[[^\]]*\]/,
      inside: {
        punctuation: /[[\]]/,
      },
    },
    punctuation: /[{}[\]&$^_~#]/,
  },
};
