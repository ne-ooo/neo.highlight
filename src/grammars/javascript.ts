import type { Grammar } from "../core/types";
import { withJavaScriptExpressions } from "./shared/javascript-tokens";

export const javascript: Grammar = {
  name: "javascript",
  aliases: ["js", "mjs", "cjs"],
  tokens: withJavaScriptExpressions({
    "class-name": {
      pattern: /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/,
      lookbehind: true,
    },
    keyword: /\b(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
    boolean: /\b(?:true|false)\b/,
    number: /(?<![$\p{ID_Continue}])(?:0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*n?|0[bB][01]+(?:_[01]+)*n?|0[oO][0-7]+(?:_[0-7]+)*n?|\d+(?:_\d+)*n|(?:\d+(?:_\d+)*(?:\.(?:\d+(?:_\d+)*)?)?|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?|NaN|Infinity)(?![$\p{ID_Continue}])/u,
    function: /(?<![$\p{ID_Continue}])[$_\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*(?=\s*\()/u,
    operator: /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%|&^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/,
    punctuation: /[{}[\];(),.:]/,
    constant: /\b[A-Z](?:[A-Z_]|\dx?)*\b/,
    parameter: {
      pattern: /(function(?:\s+[\w$]+)?\s*\(\s*)(?!\s)(?:[^()\s,]|\s+(?![\s)])|\([^()]*\))+(?=\s*[,)])/,
      lookbehind: true,
    },
  }),
};
