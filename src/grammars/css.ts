import type { Grammar } from "../core/types";

export const css: Grammar = {
  name: "css",
  aliases: [],
  tokens: {
    comment: {
      pattern: /\/\*[\s\S]*?\*\//,
      greedy: true,
    },
    string: {
      pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
      greedy: true,
    },
    "atrule": {
      pattern: /@[\w-](?:[^;{\s]|\s+(?![\s{]))*(?:;|(?=\s*\{))/,
      inside: {
        keyword: /^@[\w-]+/,
        selector: /(?:not|matches|is|where|has)\([^()]*\)/,
        string: {
          pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
          greedy: true,
        },
        punctuation: /[;:,]/,
      },
    },
    url: {
      pattern: /\burl\((?:(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1|[^\s"'()]+)\)/i,
      greedy: true,
      inside: {
        function: /^url/i,
        punctuation: /^\(|\)$/,
        string: {
          pattern: /^(["'])[\s\S]+(?=\1$)/,
          lookbehind: true,
        },
      },
    },
    selector: {
      pattern:
        /(?:^|[{};\s])[^\s@;{}()][^;{}]*?(?=\s*\{)/,
      lookbehind: true,
      inside: {
        "class-name": /\.\w[\w-]*/,
        "pseudo-class": /:[\w-]+(?:\([^()]*\))?/,
        "pseudo-element": /::[\w-]+/,
        "id-selector": /#\w[\w-]*/,
        "attribute-selector": /\[[^\]]+\]/,
        combinator: /[>+~]|(?=\s)\s(?=\S)/,
      },
    },
    property: {
      pattern: /(?:^|[;\s{])[-\w]+(?=\s*:)/m,
      lookbehind: true,
    },
    important: /!important\b/i,
    function: {
      pattern: /[\w-]+(?=\()/,
      alias: "builtin",
    },
    number: {
      pattern:
        /(?:\b|\B[+-])(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?(?:%|[a-z]+\b)?/i,
    },
    "hex-color": {
      pattern: /#[\da-f]{3,8}\b/i,
      alias: "number",
    },
    operator: /[+*/%~-]/,
    keyword:
      /\b(?:and|not|only|or|from|to|inherit|initial|unset|revert|revert-layer)\b/,
    punctuation: /[{}();:,]/,
    variable: /--[\w-]+/,
  },
};
