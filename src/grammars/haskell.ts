import type { Grammar } from "../core/types";

export const haskell: Grammar = {
  name: "haskell",
  aliases: ["hs"],
  tokens: {
    comment: [
      { pattern: /\{-[\s\S]*?-\}/, greedy: true },
      { pattern: /--.*/, greedy: true },
    ],
    string: [
      { pattern: /"(?:\\[\s\S]|[^\\"])*"/, greedy: true },
    ],
    char: {
      pattern: /'(?:\\[\s\S]|[^\\'])'/,
      alias: "string",
    },
    keyword:
      /\b(?:as|case|class|data|default|deriving|do|else|family|forall|foreign|hiding|if|import|in|infix|infixl|infixr|instance|let|module|newtype|of|qualified|then|type|where)\b/,
    boolean: /\b(?:True|False)\b/,
    builtin:
      /\b(?:IO|Maybe|Either|Just|Nothing|Left|Right|Int|Integer|Float|Double|Char|String|Bool|Show|Read|Eq|Ord|Num|Functor|Monad|Applicative)\b/,
    "class-name": {
      pattern: /(\b(?:class|instance|data|type|newtype|deriving)\s+)\w+/,
      lookbehind: true,
    },
    function: /\b[a-z_]\w*(?=\s+::|\s*=)/,
    number:
      /\b(?:0[xX][\dA-Fa-f]+|0[oO][0-7]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/,
    operator: /[-!#$%&*+./<=>?@\\^|~:]+/,
    punctuation: /[{}[\];(),`]/,
  },
};
