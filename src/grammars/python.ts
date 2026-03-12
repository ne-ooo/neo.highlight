import type { Grammar } from "../core/types";

export const python: Grammar = {
  name: "python",
  aliases: ["py"],
  tokens: {
    comment: {
      pattern: /#.*/,
      greedy: true,
    },
    "triple-string": {
      pattern: /(?:[rRbBuU]|[bB][rR]|[rR][bB])?"""[\s\S]*?"""|'''[\s\S]*?'''/,
      greedy: true,
      alias: "string",
    },
    string: {
      pattern: /(?:[rRbBuU]|[bB][rR]|[rR][bB])?(?:"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*')/,
      greedy: true,
    },
    decorator: {
      pattern: /(^[ \t]*)@\w+(?:\.\w+)*/m,
      lookbehind: true,
      alias: "annotation",
    },
    "class-name": {
      pattern: /(\bclass\s+)\w+/,
      lookbehind: true,
    },
    keyword: /\b(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/,
    builtin: /\b(?:__import__|abs|all|any|ascii|bin|bool|breakpoint|bytearray|bytes|callable|chr|classmethod|compile|complex|delattr|dict|dir|divmod|enumerate|eval|exec|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|isinstance|issubclass|iter|len|list|locals|map|max|memoryview|min|next|object|oct|open|ord|pow|print|property|range|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|vars|zip)\b/,
    boolean: /\b(?:True|False|None)\b/,
    number: /\b(?:0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*|0[oO][0-7]+(?:_[0-7]+)*|0[bB][01]+(?:_[01]+)*|\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?(?:[eE][+-]?\d+(?:_\d+)*)?j?|\.\d+(?:_\d+)*(?:[eE][+-]?\d+(?:_\d+)*)?j?)\b/,
    function: /\b[a-zA-Z_]\w*(?=\s*\()/,
    operator: /[-+%=]=?|!=|:=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]/,
    punctuation: /[{}[\];(),.:]/,
  },
};
