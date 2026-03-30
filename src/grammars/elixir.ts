import type { Grammar } from "../core/types";

export const elixir: Grammar = {
  name: "elixir",
  aliases: ["ex", "exs"],
  tokens: {
    comment: {
      pattern: /#.*/,
      greedy: true,
    },
    "doc-string": {
      pattern:
        /@(?:moduledoc|doc|typedoc)\s+(?:~[sS])?"""[\s\S]*?"""/,
      greedy: true,
      alias: "string",
    },
    string: [
      { pattern: /"""[\s\S]*?"""/, greedy: true },
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
    ],
    atom: {
      pattern: /:\w+|:"[^"]*"/,
      alias: "symbol",
    },
    module: {
      pattern: /\b[A-Z]\w*(?:\.[A-Z]\w*)*/,
      alias: "class-name",
    },
    keyword:
      /\b(?:after|alias|and|case|catch|cond|def|defimpl|defmacro|defmodule|defoverridable|defp|defprotocol|defstruct|do|else|end|fn|for|if|import|in|not|or|quote|raise|receive|require|rescue|try|unless|unquote|use|when|with)\b/,
    boolean: /\b(?:true|false|nil)\b/,
    "attr-name": {
      pattern: /@\w+/,
      alias: "annotation",
    },
    function: {
      pattern: /(\bdef[p]?\s+)\w+/,
      lookbehind: true,
    },
    number:
      /\b(?:0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*|0[oO][0-7]+(?:_[0-7]+)*|0[bB][01]+(?:_[01]+)*|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+)?)\b/,
    operator:
      /[-+/*]=?|[=!<>]=?|&&?|\|\|?|\^|\\\\|<>|<~>?|~>>?|<<<?|>>>?|=>|\|>|\.\.\.?|::|\+\+|--|!/,
    punctuation: /[{}[\];(),.:]/,
  },
};
