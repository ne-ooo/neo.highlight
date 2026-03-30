import type { Grammar } from "../core/types";

export const perl: Grammar = {
  name: "perl",
  aliases: ["pl"],
  tokens: {
    comment: [
      { pattern: /^=\w[\s\S]*?^=cut\b/m, greedy: true, alias: "doc-comment" },
      { pattern: /#.*/, greedy: true },
    ],
    string: [
      {
        pattern: /(?:q|qq|qw|qx)(?:([^\s\w])[\s\S]*?\1|\([\s\S]*?\)|\[[\s\S]*?\]|\{[\s\S]*?\}|<[\s\S]*?>)/,
        greedy: true,
      },
      {
        pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /(?:\$[\w{]|@[\w{])/,
          },
        },
      },
    ],
    regex: {
      pattern:
        /(?:m|qr)?\s*([\/|{}[\]()!])(?:\\[\s\S]|(?!\1)[^\\])*\1[msixpodualngcer]*/,
      greedy: true,
      alias: "string",
    },
    keyword:
      /\b(?:BEGIN|END|AUTOLOAD|DESTROY|__DATA__|__END__|__FILE__|__LINE__|__PACKAGE__|bless|caller|chomp|chop|close|cmp|defined|delete|die|do|each|else|elsif|eq|eval|exists|for|foreach|ge|given|goto|gt|if|import|keys|last|le|local|lt|map|my|ne|next|no|open|our|package|pop|print|printf|push|redo|require|return|reverse|say|shift|sort|splice|split|sprintf|strict|sub|substr|unshift|until|use|values|warn|warnings|when|while|wantarray)\b/,
    variable: /[\$@%]\w+|[\$@%]\{[^}]+\}/,
    function: /\b[a-zA-Z_]\w*(?=\s*\()/,
    number:
      /\b(?:0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*|0[bB][01]+(?:_[01]+)*|0[0-7]+(?:_[0-7]+)*|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+)?)\b/,
    operator:
      /[-+*\/%]=?|[!=]=?=?|<=>?|>{1,2}=?|&&?|\|\|?|[.x]=?|~~|=>|->|\.\./,
    punctuation: /[{}[\];(),.:?\\]/,
  },
};
