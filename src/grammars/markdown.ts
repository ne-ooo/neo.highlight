import type { Grammar } from "../core/types";

export const markdown: Grammar = {
  name: "markdown",
  aliases: ["md", "mdx"],
  tokens: {
    "front-matter": {
      pattern: /^---[\s\S]*?^---$/m,
      greedy: true,
      alias: "important",
    },
    "code-block": [
      {
        pattern: /^[ ]{0,3}(`{3,})[^\r\n]*\r?\n[\s\S]*?^[ ]{0,3}\1`*[^\S\r\n]*$/m,
        greedy: true,
        alias: "keyword",
        inside: {
          "code-language": {
            pattern: /^(?:`{3,}|~{3,})[^\r\n]+/m,
            alias: "tag",
            inside: {
              punctuation: /^(?:`{3,}|~{3,})/,
            },
          },
          punctuation: /^(?:`{3,}|~{3,})|(?:`{3,}|~{3,})$/m,
        },
      },
      {
        pattern: /^[ ]{0,3}(~{3,})[^\r\n]*\r?\n[\s\S]*?^[ ]{0,3}\1~*[^\S\r\n]*$/m,
        greedy: true,
        alias: "keyword",
        inside: {
          "code-language": {
            pattern: /^(?:`{3,}|~{3,})[^\r\n]+/m,
            alias: "tag",
            inside: {
              punctuation: /^(?:`{3,}|~{3,})/,
            },
          },
          punctuation: /^(?:`{3,}|~{3,})|(?:`{3,}|~{3,})$/m,
        },
      },
    ],
    "inline-code": {
      pattern: /`[^`\r\n]+`/,
      greedy: true,
      alias: "keyword",
    },
    blockquote: {
      pattern: /^>.*$/m,
      alias: "punctuation",
    },
    heading: {
      pattern: /^#{1,6}\s+.+$/m,
      alias: "important",
      inside: {
        punctuation: /^#{1,6}/,
      },
    },
    "hr": {
      pattern: /^(?:[*-]){3,}\s*$/m,
      alias: "punctuation",
    },
    "list-item": {
      pattern: /^[ \t]*(?:[*\-+]|\d+\.)\s/m,
      alias: "punctuation",
    },
    bold: {
      pattern: /\*\*(?:[^\\*]|\\.)+\*\*|__(?:[^\\_]|\\.)+__/,
      greedy: true,
      alias: "important",
      inside: {
        punctuation: /^\*\*|\*\*$|^__|__$/,
      },
    },
    italic: {
      pattern: /\*(?:[^\\*]|\\.)+\*|_(?:[^\\_]|\\.)+_/,
      greedy: true,
      inside: {
        punctuation: /^\*|\*$|^_|_$/,
      },
    },
    strikethrough: {
      pattern: /~~(?:(?!~~)[^\\\r\n]|\\.)+~~/,
      greedy: true,
      inside: {
        punctuation: /^~~|~~$/,
      },
    },
    url: {
      pattern: /!?\[[^\[\]\r\n]*\]\([^()\r\n]+\)/,
      inside: {
        variable: {
          pattern: /(!?\[)[^\[\]]*(?=\])/,
          lookbehind: true,
        },
        string: {
          pattern: /\([^()]+\)/,
        },
        punctuation: /[![\]()]/,
      },
    },
    "reference-link": {
      pattern: /!?\[[^\[\]\r\n]*\]\[[^\[\]\r\n]*\]/,
      inside: {
        variable: /\[[^\[\]]*\]/,
        punctuation: /[![\]]/,
      },
    },
    "link-definition": {
      pattern: /^\[[^\]]+\]:\s+.+$/m,
      inside: {
        property: /^\[[^\]]+\]/,
        string: /https?:\/\/[^\s]+/,
        punctuation: /[[\]:]/,
      },
    },
    table: {
      pattern: /^\|.+\|$/m,
      inside: {
        punctuation: /\|/,
        "table-header-sep": {
          pattern: /:?-{3,}:?/,
          alias: "operator",
        },
      },
    },
  },
};
