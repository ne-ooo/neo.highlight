import type { Grammar } from "../core/types";

export const dart: Grammar = {
  name: "dart",
  aliases: [],
  tokens: {
    comment: [
      { pattern: /\/\/\/.*/, greedy: true, alias: "doc-comment" },
      { pattern: /\/\/.*/, greedy: true },
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
    ],
    string: [
      {
        pattern: /r?("""|''')[\s\S]*?\1/,
        greedy: true,
      },
      {
        pattern: /r?(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
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
    ],
    metadata: {
      pattern: /@\w+/,
      alias: "annotation",
    },
    keyword:
      /\b(?:abstract|as|assert|async|await|base|break|case|catch|class|const|continue|covariant|default|deferred|do|dynamic|else|enum|export|extends|extension|external|factory|final|finally|for|get|hide|if|implements|import|in|interface|is|late|library|mixin|new|null|on|operator|part|required|rethrow|return|sealed|set|show|static|super|switch|sync|this|throw|try|typedef|var|void|when|while|with|yield)\b/,
    boolean: /\b(?:true|false)\b/,
    "class-name": {
      pattern: /(\b(?:class|extends|implements|with|mixin)\s+)\w+/,
      lookbehind: true,
    },
    function: /\b[a-zA-Z_]\w*(?=\s*\()/,
    number:
      /\b(?:0[xX][\dA-Fa-f]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/,
    operator:
      /[-+*/%~]=?|[=!<>]=?|&&?|\|\|?|\^|\.{2,3}|\?\??|>>?=?|<<?=?|~/,
    punctuation: /[{}[\];(),.:@]/,
  },
};
