import type { Grammar } from "../core/types";

export const lua: Grammar = {
  name: "lua",
  aliases: [],
  tokens: {
    comment: [
      { pattern: /--\[\[[\s\S]*?\]\]/, greedy: true },
      { pattern: /--.*/, greedy: true },
    ],
    string: [
      { pattern: /\[\[[\s\S]*?\]\]/, greedy: true },
      {
        pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
        greedy: true,
      },
    ],
    keyword:
      /\b(?:and|break|do|else|elseif|end|for|function|goto|if|in|local|not|or|repeat|return|then|until|while)\b/,
    boolean: /\b(?:true|false)\b/,
    builtin: /\b(?:nil)\b/,
    function: /\b[a-zA-Z_]\w*(?=\s*[({])/,
    number:
      /\b0[xX][\dA-Fa-f]+(?:\.[\dA-Fa-f]+)?(?:[pP][+-]?\d+)?|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/,
    operator:
      /[-+*/%^#]=?|[=~<>]=|<[<=]?|>[>=]?|[&|]|\.\.\.?/,
    punctuation: /[{}[\];(),.:]/,
  },
};
