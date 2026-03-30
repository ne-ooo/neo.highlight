import type { Grammar } from "../core/types";

export const erlang: Grammar = {
  name: "erlang",
  aliases: ["erl"],
  tokens: {
    comment: {
      pattern: /%.*/,
      greedy: true,
    },
    string: {
      pattern: /"(?:\\[\s\S]|[^\\"])*"/,
      greedy: true,
    },
    atom: [
      {
        pattern: /'(?:\\[\s\S]|[^\\'])*'/,
        alias: "symbol",
      },
      {
        pattern: /\b[a-z]\w*/,
        alias: "symbol",
      },
    ],
    keyword:
      /\b(?:after|begin|case|catch|end|fun|if|of|receive|try|when|query|not|and|or|xor|band|bor|bxor|bnot|bsl|bsr|div|rem|let)\b/,
    boolean: /\b(?:true|false)\b/,
    function: {
      pattern: /\b[a-z]\w*(?=\s*\()/,
    },
    variable: /\b[A-Z_]\w*/,
    number:
      /\b(?:\d+#[\dA-Za-z]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/,
    operator:
      /->|<-|::|!|\|{1,2}|={1,2}|\/={1,2}|[<>]=?|=<|\+\+|--|[+\-*\/]/,
    punctuation: /[{}[\];(),.:#|]/,
  },
};
