import type { Grammar } from "../core/types";

export const nix: Grammar = {
  name: "nix",
  aliases: ["nixos"],
  tokens: {
    comment: [
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
      { pattern: /#.*/, greedy: true },
    ],
    string: [
      {
        pattern: /''[\s\S]*?''/,
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
      {
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
    ],
    path: {
      pattern: /(?:\.\/|\.\.\/|\/|~\/)[a-zA-Z0-9._\-+/]*/,
      alias: "string",
    },
    url: {
      pattern: /[a-zA-Z][\w+\-.]*:\/\/[^\s)]+/,
      alias: "string",
    },
    keyword:
      /\b(?:assert|builtins|else|if|in|inherit|let|or|rec|then|with)\b/,
    boolean: /\b(?:true|false|null)\b/,
    function: /\b[a-zA-Z_]\w*(?=\s*=\s*(?:\{|[a-zA-Z_].*?:))/,
    builtin:
      /\b(?:abort|baseNameOf|derivation|dirOf|fetchTarball|fetchurl|import|isNull|map|removeAttrs|throw|toString|toPath)\b/,
    number: /\b\d+\b/,
    operator: /[=!<>]=?|&&|\|\||->|\/\/|\+\+|[+\-*\/]/,
    punctuation: /[{}[\];(),.?@:]/,
  },
};
