import type { Grammar } from "../core/types";

export const terraform: Grammar = {
  name: "terraform",
  aliases: ["hcl", "tf"],
  tokens: {
    comment: [
      { pattern: /\/\/.*/, greedy: true },
      { pattern: /#.*/, greedy: true },
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
    ],
    "heredoc-string": {
      pattern: /<<-?\s*(\w+)[\s\S]*?^\s*\1/m,
      greedy: true,
      alias: "string",
      inside: {
        interpolation: {
          pattern: /\$\{[^}]*\}/,
          inside: {
            punctuation: /^\$\{|\}$/,
          },
        },
      },
    },
    string: {
      pattern: /"(?:\\[\s\S]|[^\\"])*"/,
      greedy: true,
      inside: {
        interpolation: {
          pattern: /\$\{[^}]*\}/,
          inside: {
            punctuation: /^\$\{|\}$/,
          },
        },
      },
    },
    keyword:
      /\b(?:resource|data|variable|output|locals|module|provider|terraform|backend|required_providers|required_version|provisioner|connection|lifecycle|for_each|count|depends_on|dynamic|content|moved|import|check)\b/,
    boolean: /\b(?:true|false)\b/,
    builtin:
      /\b(?:null|string|number|bool|list|map|set|object|tuple|any)\b/,
    function: /\b[a-zA-Z_]\w*(?=\s*\()/,
    number:
      /\b(?:0[xX][\dA-Fa-f]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/,
    operator: /[!=<>]=?|&&|\|\||[+\-*/%?:]/,
    punctuation: /[{}[\](),.=:]/,
  },
};
