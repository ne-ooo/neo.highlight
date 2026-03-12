import type { Grammar } from "../core/types";

export const ruby: Grammar = {
  name: "ruby",
  aliases: ["rb"],
  tokens: {
    comment: [
      {
        pattern: /^=begin\b[\s\S]*?^=end\b/m,
        greedy: true,
      },
      {
        pattern: /#.*/,
        greedy: true,
      },
    ],
    "triple-string": {
      pattern: /<<[-~]?(\w+)\r?\n[\s\S]*?\r?\n\s*\1/,
      greedy: true,
      alias: "string",
    },
    string: [
      {
        pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /#\{[^}]*\}/,
            inside: {
              punctuation: /^#\{|\}$/,
            },
          },
        },
      },
      {
        pattern: /%[qQwWiIxsr]?(?:\([^)]*\)|\[[^\]]*\]|\{[^}]*\}|<[^>]*>|([^\w\s])[\s\S]*?\1)/,
        greedy: true,
        alias: "string",
      },
    ],
    regex: {
      pattern: /\/(?:[^/\\\r\n]|\\.)+\/[gim]{0,3}/,
      greedy: true,
    },
    symbol: {
      pattern: /:\w+[!?]?|\w+[!?]?:/,
      alias: "property",
    },
    "class-name": {
      pattern: /(\b(?:class|module)\s+)[\w:]+/,
      lookbehind: true,
    },
    keyword:
      /\b(?:alias|and|begin|break|case|class|def|defined\?|do|else|elsif|end|ensure|extend|for|if|in|include|module|new|next|nil|not|or|prepend|private|protected|public|raise|redo|require|require_relative|rescue|retry|return|self|super|then|throw|undef|unless|until|when|while|yield)\b/,
    builtin:
      /\b(?:Array|Complex|Float|Hash|Integer|Numeric|Object|Rational|String|Symbol|puts|gets|print|p|pp|sprintf|format|warn|raise|fail|exit|abort|at_exit|lambda|proc|loop|catch|throw|freeze|frozen\?|respond_to\?|send|tap|then|yield_self|itself|dup|clone|class|is_a\?|kind_of\?|instance_of\?|nil\?|empty\?|equal\?)\b/,
    boolean: /\b(?:true|false|nil)\b/,
    number:
      /\b(?:0[xX][\da-fA-F]+(?:_[\da-fA-F]+)*|0[bB][01]+(?:_[01]+)*|0[oO]?[0-7]+(?:_[0-7]+)*|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+(?:_\d+)*)?(?:r|i|ri)?)\b/,
    constant: /\b[A-Z]\w*\b/,
    function: {
      pattern: /(\bdef\s+)\w+[!?]?/,
      lookbehind: true,
    },
    variable: /[@$]\w+|@@\w+/,
    operator:
      /\.{2,3}|&\.|<=>|[!=]=?=?|[-+*/%<>&|^!~]=?|=>|<<|>>/,
    punctuation: /[{}[\]();,.:]/,
  },
};
