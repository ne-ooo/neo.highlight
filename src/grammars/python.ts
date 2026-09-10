import type { Grammar } from "../core/types";
import { withPythonExpressions } from "./shared/python-tokens";

export const python: Grammar = {
  name: "python",
  aliases: ["py"],
  tokens: withPythonExpressions({
    decorator: {
      pattern: /(^[ \t]*)@\w+(?:\.\w+)*/m,
      lookbehind: true,
      alias: "annotation",
    },
    "class-name": {
      pattern: /(\bclass\s+)\w+/,
      lookbehind: true,
    },
    keyword: /(?<![\p{XID_Continue}])(?:and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)(?![\p{XID_Continue}])/u,
    builtin: /(?<![\p{XID_Continue}])(?:__import__|abs|all|any|ascii|bin|bool|breakpoint|bytearray|bytes|callable|chr|classmethod|compile|complex|delattr|dict|dir|divmod|enumerate|eval|exec|filter|float|format|frozenset|getattr|globals|hasattr|hash|help|hex|id|input|int|isinstance|issubclass|iter|len|list|locals|map|max|memoryview|min|next|object|oct|open|ord|pow|print|property|range|repr|reversed|round|set|setattr|slice|sorted|staticmethod|str|sum|super|tuple|type|vars|zip)(?![\p{XID_Continue}])/u,
    boolean: /(?<![\p{XID_Continue}])(?:True|False|None)(?![\p{XID_Continue}])/u,
    number: /(?<![\p{XID_Continue}])(?:0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*|0[oO][0-7]+(?:_[0-7]+)*|0[bB][01]+(?:_[01]+)*|\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?(?:[eE][+-]?\d+(?:_\d+)*)?j?|\.\d+(?:_\d+)*(?:[eE][+-]?\d+(?:_\d+)*)?j?)(?![\p{XID_Continue}])/u,
    function: /(?<![\p{XID_Continue}])[_\p{XID_Start}][\p{XID_Continue}]*(?=\s*\()/u,
    operator: /[-+%=]=?|!=|:=|\*\*?=?|\/\/?=?|<[<=>]?|>[=>]?|[&|^~]/,
    punctuation: /[{}[\];(),.:]/,
  }),
};
