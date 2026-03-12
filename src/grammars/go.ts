import type { Grammar } from "../core/types";

export const go: Grammar = {
  name: "go",
  aliases: ["golang"],
  tokens: {
    comment: [
      { pattern: /\/\/.*/, greedy: true },
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
    ],
    string: [
      {
        pattern: /"(?:\\[\s\S]|[^\\"\r\n])*"/,
        greedy: true,
      },
      {
        pattern: /`[^`]*`/,
        greedy: true,
        alias: "template-string",
      },
    ],
    char: {
      pattern: /'(?:\\[\s\S]|[^\\'\r\n])'/,
      greedy: true,
      alias: "string",
    },
    "class-name": {
      pattern:
        /(\b(?:type|struct|interface)\s+)\w+/,
      lookbehind: true,
    },
    keyword:
      /\b(?:break|case|chan|const|continue|default|defer|else|fallthrough|for|func|go|goto|if|import|interface|map|package|range|return|select|struct|switch|type|var)\b/,
    builtin:
      /\b(?:append|cap|close|complex|copy|delete|imag|len|make|new|panic|print|println|real|recover)\b/,
    boolean: /\b(?:true|false|iota)\b/,
    number:
      /\b(?:0[xX][\da-fA-F]+(?:_[\da-fA-F]+)*|0[oO][0-7]+(?:_[0-7]+)*|0[bB][01]+(?:_[01]+)*|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+(?:_\d+)*)?i?)\b/,
    constant: /\b(?:nil)\b/,
    function: /\b\w+(?=\s*\()/,
    operator:
      /:=|<-|&&|\|\||[!=<>]=?|[-+*/%&|^]=?|<<=?|>>=?|&\^=?/,
    punctuation: /[{}[\]();,.:]/,
    "type-keyword": {
      pattern:
        /\b(?:bool|byte|complex64|complex128|error|float32|float64|int|int8|int16|int32|int64|rune|string|uint|uint8|uint16|uint32|uint64|uintptr|any|comparable)\b/,
      alias: "builtin",
    },
  },
};
