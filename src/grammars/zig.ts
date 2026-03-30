import type { Grammar } from "../core/types";

export const zig: Grammar = {
  name: "zig",
  aliases: [],
  tokens: {
    comment: [
      { pattern: /\/\/\/.*/, greedy: true, alias: "doc-comment" },
      { pattern: /\/\/.*/, greedy: true },
    ],
    string: [
      {
        pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
        greedy: true,
      },
      {
        pattern: /\\\\[^\n]*/,
        alias: "multiline-string",
      },
    ],
    char: {
      pattern: /'(?:\\[\s\S]|[^\\'])'/,
      alias: "string",
    },
    builtin: {
      pattern: /@[a-zA-Z_]\w*/,
      alias: "function",
    },
    keyword:
      /\b(?:addrspace|align|allowzero|and|anyframe|anytype|asm|async|await|break|callconv|catch|comptime|const|continue|defer|else|enum|errdefer|error|export|extern|fn|for|if|inline|linksection|noalias|nosuspend|orelse|packed|pub|resume|return|struct|suspend|switch|test|threadlocal|try|union|unreachable|var|volatile|while)\b/,
    boolean: /\b(?:true|false)\b/,
    builtin_type:
      /\b(?:i\d+|u\d+|f16|f32|f64|f80|f128|isize|usize|bool|void|noreturn|type|anyerror|comptime_int|comptime_float|c_short|c_ushort|c_int|c_uint|c_long|c_ulong|c_longlong|c_ulonglong|c_longdouble|c_char)\b/,
    "class-name": {
      pattern: /(\b(?:struct|enum|union|error)\s+)\w+/,
      lookbehind: true,
    },
    function: /\b[a-zA-Z_]\w*(?=\s*\()/,
    number:
      /\b(?:0[xX][\dA-Fa-f]+(?:\.[\dA-Fa-f]+)?(?:[pP][+-]?\d+)?|0[oO][0-7]+|0[bB][01]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/,
    operator:
      /[-+*/%]=?|[=!<>]=?|&&?|\|\|?|\^|<<?=?|>>?=?|\.{2,3}|\+\+|~/,
    punctuation: /[{}[\];(),.:|]/,
  },
};
