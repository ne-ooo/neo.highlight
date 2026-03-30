import type { Grammar } from "../core/types";

export const ocaml: Grammar = {
  name: "ocaml",
  aliases: ["ml"],
  tokens: {
    comment: {
      pattern: /\(\*[\s\S]*?\*\)/,
      greedy: true,
    },
    string: [
      { pattern: /"(?:\\[\s\S]|[^\\"])*"/, greedy: true },
      { pattern: /\{[a-z]*\|[\s\S]*?\|[a-z]*\}/, greedy: true },
    ],
    char: {
      pattern: /'(?:\\[\s\S]|[^\\'])'/,
      alias: "string",
    },
    keyword:
      /\b(?:and|as|assert|asr|begin|class|constraint|do|done|downto|else|end|exception|external|for|fun|function|functor|if|in|include|inherit|initializer|land|lazy|let|lor|lsl|lsr|lxor|match|method|mod|module|mutable|new|nonrec|object|of|open|or|private|rec|sig|struct|then|to|try|type|val|virtual|when|while|with)\b/,
    boolean: /\b(?:true|false)\b/,
    builtin:
      /\b(?:int|float|char|string|bool|unit|list|array|option|ref|exn)\b/,
    "class-name": {
      pattern: /(\b(?:type|module|class|exception)\s+)\w+/,
      lookbehind: true,
    },
    variant: {
      pattern: /\b[A-Z]\w*/,
      alias: "constant",
    },
    function: /\b[a-z_]\w*(?=\s+[=:])/,
    number:
      /\b(?:0[xX][\dA-Fa-f][\dA-Fa-f_]*|0[oO][0-7][0-7_]*|0[bB][01][01_]*|\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?\d[\d_]*)?)\b/,
    operator:
      /[-+*/]=?|[=<>@^|&]|::?|#|~|->|<-|\|>|\.\./,
    punctuation: /[{}[\];(),.`:]/,
  },
};
