import type { Grammar } from "../core/types";

export const ini: Grammar = {
  name: "ini",
  aliases: ["conf", "cfg", "env", "properties"],
  tokens: {
    comment: [
      { pattern: /[;#].*/, greedy: true },
    ],
    section: {
      pattern: /^[^\S\r\n]*\[[^\[\]\r\n]*\]/m,
      alias: "selector",
      inside: {
        punctuation: /^\[|\]$/,
      },
    },
    string: {
      pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
      greedy: true,
    },
    key: {
      pattern: /^[^\s=;#][^=]*(?=\s*=)/m,
      alias: "property",
    },
    value: {
      pattern: /(=\s*).+/,
      lookbehind: true,
      inside: {
        number: /\b\d+(?:\.\d+)?\b/,
        boolean: /\b(?:true|false|yes|no|on|off)\b/i,
        string: {
          pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
          greedy: true,
        },
      },
    },
    operator: /=/,
    punctuation: /[.\\]/,
  },
};
