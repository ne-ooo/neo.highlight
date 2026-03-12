import type { Grammar } from "../core/types";

export const javascript: Grammar = {
  name: "javascript",
  aliases: ["js", "mjs", "cjs"],
  tokens: {
    comment: [
      { pattern: /\/\/.*/, greedy: true },
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
    ],
    string: [
      {
        pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
        greedy: true,
      },
      {
        pattern: /`(?:\\[\s\S]|[^\\`])*`/,
        greedy: true,
        alias: "template-string",
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
    regex: {
      pattern: /((?:^|[^$\w\xA0-\uFFFF."'\])\s]|\b(?:return|yield))\s*)\/(?:\[(?:[^\]\\\r\n]|\\.)*\]|\\.|[^/\\\[\r\n])+\/[dgimyus]{0,7}(?=(?:\s|\/\*(?:[^*]|\*(?!\/))*\*\/)*(?:$|[\r\n,.;:})\]]|\/\/))/,
      lookbehind: true,
      greedy: true,
    },
    "class-name": {
      pattern: /(\b(?:class|extends|implements|instanceof|interface|new)\s+)[\w.\\]+/,
      lookbehind: true,
    },
    keyword: /\b(?:as|async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|enum|export|extends|finally|for|from|function|get|if|implements|import|in|instanceof|interface|let|new|null|of|package|private|protected|public|return|set|static|super|switch|this|throw|try|typeof|undefined|var|void|while|with|yield)\b/,
    boolean: /\b(?:true|false)\b/,
    number: /\b(?:(?:0[xX][\dA-Fa-f]+(?:_[\dA-Fa-f]+)*|0[bB][01]+(?:_[01]+)*|0[oO][0-7]+(?:_[0-7]+)*)n?|(?:\d+(?:_\d+)*\.?\d*(?:_\d+)*|\.\d+(?:_\d+)*)(?:[Ee][+-]?\d+(?:_\d+)*)?n?|NaN|Infinity)\b/,
    function: /\b[a-zA-Z_$][\w$]*(?=\s*\()/,
    operator: /--|\+\+|\*\*=?|=>|&&=?|\|\|=?|[!=]==|<<=?|>>>?=?|[-+*/%|&^!=<>]=?|\.{3}|\?\?=?|\?\.?|[~:]/,
    punctuation: /[{}[\];(),.:]/,
    constant: /\b[A-Z](?:[A-Z_]|\dx?)*\b/,
    parameter: {
      pattern: /(function(?:\s+[\w$]+)?\s*\(\s*)(?!\s)(?:[^()\s,]|\s+(?![\s)])|\([^()]*\))+(?=\s*[,)])/,
      lookbehind: true,
    },
  },
};
