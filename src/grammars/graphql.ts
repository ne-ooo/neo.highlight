import type { Grammar } from "../core/types";

export const graphql: Grammar = {
  name: "graphql",
  aliases: ["gql"],
  tokens: {
    comment: {
      pattern: /#.*/,
      greedy: true,
    },
    "description-string": {
      pattern: /"""[\s\S]*?"""/,
      greedy: true,
      alias: "string",
    },
    string: {
      pattern: /"(?:\\[\s\S]|[^\\"\r\n])*"/,
      greedy: true,
    },
    directive: {
      pattern: /@\w+/,
      alias: "decorator",
    },
    "type-definition": {
      pattern:
        /(\b(?:type|interface|input|enum|union|scalar|extend)\s+)\w+/,
      lookbehind: true,
      alias: "class-name",
    },
    "field-type": {
      pattern: /:\s*\[?\w+!?\]?!?/,
      inside: {
        operator: /[![\]]/,
        "class-name": /\w+/,
        punctuation: /:/,
      },
    },
    keyword:
      /\b(?:query|mutation|subscription|fragment|on|type|interface|implements|input|enum|union|scalar|extend|schema|directive|repeatable)\b/,
    variable: /\$\w+/,
    boolean: /\b(?:true|false)\b/,
    keyword2: {
      pattern: /\bnull\b/,
      alias: "keyword",
    },
    number: /-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/,
    operator: /[!=|&]/,
    "fragment-spread": {
      pattern: /\.{3}\s*(?:on\b)?\s*\w*/,
      inside: {
        keyword: /\bon\b/,
        punctuation: /\.{3}/,
        "class-name": /\w+/,
      },
    },
    builtin:
      /\b(?:Int|Float|String|Boolean|ID)\b/,
    punctuation: /[{}()[\]:=,!@]/,
  },
};
