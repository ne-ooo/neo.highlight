import type { Grammar } from "../core/types";

export const yaml: Grammar = {
  name: "yaml",
  aliases: ["yml"],
  tokens: {
    comment: {
      pattern: /#.*/,
      greedy: true,
    },
    directive: {
      pattern: /^%[^\r\n]+/m,
      alias: "important",
    },
    "document-marker": {
      pattern: /^(?:---|\.\.\.)\s*$/m,
      alias: "punctuation",
    },
    tag: {
      pattern: /!(?:![\w-]*)?(?:![\w-]+)?(?:\/[\w-]+)*/,
      alias: "builtin",
    },
    anchor: {
      pattern: /[&*][\w-]+/,
      alias: "variable",
    },
    string: [
      {
        pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
        greedy: true,
      },
      {
        pattern: /[|>][-+]?(?:\d+)?[ \t]*\n(?:[ \t]+[^\r\n]*(?:\n|$))*/,
        greedy: true,
        alias: "string",
      },
    ],
    datetime: {
      pattern:
        /\b\d{4}-\d{2}-\d{2}(?:[Tt ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{1,2}(?::\d{2})?)?)?\b/,
      alias: "number",
    },
    boolean: /\b(?:true|false|yes|no|on|off)\b/i,
    keyword: /\bnull\b/i,
    number:
      /[+-]?(?:0x[\da-fA-F]+|0o[0-7]+|(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|\.inf|\.Inf|\.INF|\.nan|\.NaN|\.NAN))\b/,
    key: {
      pattern:
        /(?:^|[:\-,[\]{}&*!|>'"%@`])[ \t]*(?:[^\s\-?:,[\]{}#&*!|>'"% \t\r\n][^\s:,[\]{}#\r\n]*)?[^\s#,[\]{}:]\s*(?=\s*:(?:\s|$))/m,
      alias: "property",
    },
    punctuation: /[-:[\]{},|>?]/,
  },
};
