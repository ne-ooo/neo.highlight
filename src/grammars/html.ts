import type { Grammar } from "../core/types";

export const html: Grammar = {
  name: "html",
  aliases: ["htm", "xml", "svg", "mathml"],
  tokens: {
    comment: {
      pattern: /<!--[\s\S]*?-->/,
      greedy: true,
    },
    doctype: {
      pattern: /<!DOCTYPE[\s\S]*?>/i,
      greedy: true,
      alias: "important",
      inside: {
        punctuation: /^<!|>$/,
        "doctype-tag": /^DOCTYPE/i,
        string: /"[^"]*"|'[^']*'/,
      },
    },
    cdata: {
      pattern: /<!\[CDATA\[[\s\S]*?\]\]>/i,
      greedy: true,
    },
    tag: {
      pattern:
        /<\/?(?!\d)[^\s>/=$<%]+(?:\s+(?:[^\s>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+))?|\{\.{3}\w+\}))*\s*\/?>/,
      greedy: true,
      inside: {
        tag: {
          pattern: /^<\/?[^\s>/]+/,
          inside: {
            punctuation: /^<\/?/,
            namespace: /^[a-z]\w*(?=:)/,
          },
        },
        "special-attr": {
          pattern:
            /\b(?:style|class|id)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/i,
          inside: {
            "attr-name": /^[^\s=]+/,
            "attr-value": {
              pattern: /=[\s\S]+/,
              inside: {
                punctuation: [
                  /^=/,
                  { pattern: /^["']|["']$/, alias: "attr-equals" },
                ],
              },
            },
          },
        },
        "attr-value": {
          pattern: /=\s*(?:"[^"]*"|'[^']*'|[^\s'">=]+)/,
          inside: {
            punctuation: [
              /^=/,
              { pattern: /^["']|["']$/, alias: "attr-equals" },
            ],
          },
        },
        "attr-name": /[^\s>/=]+/,
        punctuation: /\/?>/,
      },
    },
    entity: {
      pattern: /&[\da-z]{1,8};|&#x?[\da-f]{1,8};/i,
      alias: "builtin",
    },
  },
};
