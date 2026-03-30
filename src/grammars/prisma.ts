import type { Grammar } from "../core/types";

export const prisma: Grammar = {
  name: "prisma",
  aliases: [],
  tokens: {
    comment: [
      { pattern: /\/\/.*/, greedy: true },
    ],
    "triple-comment": {
      pattern: /\/\/\/.*/,
      greedy: true,
      alias: "doc-comment",
    },
    string: {
      pattern: /"(?:\\[\s\S]|[^\\"])*"/,
      greedy: true,
    },
    keyword:
      /\b(?:datasource|generator|model|enum|type|view)\b/,
    attribute: {
      pattern: /@@?\w+/,
      alias: "annotation",
    },
    "type-name": {
      pattern: /\b(?:String|Boolean|Int|BigInt|Float|Decimal|DateTime|Json|Bytes|Unsupported)\b/,
      alias: "builtin",
    },
    boolean: /\b(?:true|false)\b/,
    "class-name": {
      pattern: /(\b(?:model|enum|type|view)\s+)\w+/,
      lookbehind: true,
    },
    function: /\b[a-zA-Z_]\w*(?=\s*\()/,
    number: /\b\d+(?:\.\d+)?\b/,
    operator: /[?![\]]/,
    punctuation: /[{}(),.:=@]/,
  },
};
