import type { Grammar } from "../core/types";

export const diff: Grammar = {
  name: "diff",
  aliases: ["patch"],
  tokens: {
    "diff-header": {
      pattern: /^(?:diff|index|---|\+\+\+|@@).*$/m,
      alias: "important",
      inside: {
        "file-path": {
          pattern: /(?:a|b)\/[^\s]+|\/dev\/null/,
          alias: "string",
        },
        range: {
          pattern: /@@\s*-\d+(?:,\d+)?\s*\+\d+(?:,\d+)?\s*@@/,
          alias: "property",
          inside: {
            number: /-?\d+/,
            punctuation: /@@/,
          },
        },
        "commit-hash": {
          pattern: /[\da-f]{7,40}/,
          alias: "constant",
        },
        punctuation: /---|\+\+\+/,
      },
    },
    comment: {
      pattern: /^[#\\].*/m,
      greedy: true,
    },
    inserted: {
      pattern: /^\+.*/m,
    },
    deleted: {
      pattern: /^-.*/m,
    },
    changed: {
      pattern: /^!.*/m,
    },
    "context-line": {
      pattern: /^ .*/m,
      alias: "punctuation",
    },
    "no-newline": {
      pattern: /^\\ No newline at end of file$/m,
      alias: "comment",
    },
  },
};
