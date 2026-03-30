import type { Grammar } from "../core/types";

export const csv: Grammar = {
  name: "csv",
  aliases: ["tsv"],
  tokens: {
    header: {
      pattern: /^.+$/m,
      greedy: true,
      alias: "important",
      inside: {
        string: {
          pattern: /"(?:[^"]|"")*"/,
          greedy: true,
        },
        punctuation: /[,\t|;]/,
      },
    },
    string: {
      pattern: /"(?:[^"]|"")*"/,
      greedy: true,
    },
    number: {
      pattern: /(?:^|(?<=[,\t|;]))[-+]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?=[,\t|;\r\n]|$)/m,
    },
    boolean: {
      pattern: /(?:^|(?<=[,\t|;]))(?:true|false|yes|no)(?=[,\t|;\r\n]|$)/mi,
    },
    punctuation: /[,\t|;]/,
  },
};
