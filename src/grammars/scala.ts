import type { Grammar } from "../core/types";

export const scala: Grammar = {
  name: "scala",
  aliases: ["sc"],
  tokens: {
    comment: [
      { pattern: /\/\/.*/, greedy: true },
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
    ],
    "triple-string": {
      pattern: /"""[\s\S]*?"""/,
      greedy: true,
      alias: "string",
      inside: {
        interpolation: {
          pattern: /\$(?:\{[^}]*\}|\w+)/,
          inside: {
            punctuation: /^\$\{?|\}$/,
          },
        },
      },
    },
    string: {
      pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
      greedy: true,
      inside: {
        interpolation: {
          pattern: /\$(?:\{[^}]*\}|\w+)/,
          inside: {
            punctuation: /^\$\{?|\}$/,
          },
        },
      },
    },
    symbol: {
      pattern: /'[a-zA-Z_]\w*/,
      alias: "atom",
    },
    annotation: {
      pattern: /@\w+/,
    },
    keyword:
      /\b(?:abstract|case|catch|class|def|derives|do|else|enum|export|extends|extension|final|finally|for|forSome|given|if|implicit|import|infix|inline|lazy|match|new|object|opaque|open|override|package|private|protected|return|sealed|super|then|this|throw|trait|transparent|try|type|using|val|var|while|with|yield)\b/,
    boolean: /\b(?:true|false)\b/,
    builtin: /\b(?:null|Nil|None|Some|Unit)\b/,
    "class-name": {
      pattern: /(\b(?:class|trait|object|extends|with|type)\s+)\w+/,
      lookbehind: true,
    },
    function: /\b[a-zA-Z_]\w*(?=\s*[\[(])/,
    number:
      /\b(?:0[xX][\dA-Fa-f]+[Ll]?|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[FfDdLl]?)\b/,
    operator:
      /[=!<>]=?|[-+*/%&|^~]|=>|<-|<:|>:|#|::|@/,
    punctuation: /[{}[\];(),.]/,
  },
};
