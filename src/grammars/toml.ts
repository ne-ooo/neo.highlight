import type { Grammar } from "../core/types";

export const toml: Grammar = {
  name: "toml",
  aliases: [],
  tokens: {
    comment: {
      pattern: /#.*/,
      greedy: true,
    },
    table: {
      pattern: /^[^\S\r\n]*\[{1,2}[^\[\]\r\n]*\]{1,2}/m,
      alias: "selector",
      inside: {
        punctuation: /^\[{1,2}|\]{1,2}$/,
        key: /[^\][\s.]+/,
        "table-sep": {
          pattern: /\./,
          alias: "punctuation",
        },
      },
    },
    string: [
      {
        pattern: /"""[\s\S]*?"""|'''[\s\S]*?'''/,
        greedy: true,
      },
      {
        pattern: /"(?:\\[\s\S]|[^\\"\r\n])*"|'[^'\r\n]*'/,
        greedy: true,
      },
    ],
    datetime: {
      pattern:
        /\b\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?\b|\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/,
      alias: "number",
    },
    boolean: /\b(?:true|false)\b/,
    number:
      /[+-]?(?:0x[\da-fA-F]+(?:_[\da-fA-F]+)*|0o[0-7]+(?:_[0-7]+)*|0b[01]+(?:_[01]+)*|(?:\d+(?:_\d+)*\.?\d*(?:_\d+)*|\.\d+(?:_\d+)*)(?:[eE][+-]?\d+(?:_\d+)*)?|inf|nan)\b/,
    key: {
      pattern: /(?:^|[,{])[^\S\r\n]*(?:"(?:\\[\s\S]|[^\\"\r\n])*"|'[^'\r\n]*'|[\w-]+)[^\S\r\n]*(?==)/m,
      lookbehind: true,
      alias: "property",
    },
    operator: /=/,
    punctuation: /[{}\[\],]/,
  },
};
