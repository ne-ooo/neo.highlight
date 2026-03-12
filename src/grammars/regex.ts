import type { Grammar } from "../core/types";

export const regex: Grammar = {
  name: "regex",
  aliases: ["regexp"],
  tokens: {
    "char-class": {
      pattern: /\[(?:\^)?(?:\\[\s\S]|[^\]\\])*\]/,
      alias: "selector",
      inside: {
        "class-negation": {
          pattern: /^\[\^/,
          alias: "operator",
        },
        "char-range": {
          pattern: /(?:[^\\\]]|\\[\s\S])-(?:[^\\\]]|\\[\s\S])/,
          inside: {
            "escape-char": {
              pattern: /\\[\s\S]/,
              alias: "constant",
            },
            operator: /-/,
          },
        },
        "escape-char": {
          pattern: /\\[\s\S]/,
          alias: "constant",
        },
        punctuation: /[[\]]/,
      },
    },
    group: {
      pattern: /\((?:\?(?:[:=!]|<[!=]?|[idmsuxUJ-]+:?|<\w+>|'\w+'|P[<']\w+[>']))?/,
      alias: "punctuation",
      inside: {
        "group-name": {
          pattern: /(?:<=|<|'|P<)\w+(?=>|')/,
          alias: "variable",
        },
        "group-flags": {
          pattern: /\?[idmsuxUJ-]+/,
          alias: "keyword",
        },
        keyword: /\?[:=!]|\?<[!=]/,
        punctuation: /[()]/,
      },
    },
    "close-group": {
      pattern: /\)/,
      alias: "punctuation",
    },
    anchor: {
      pattern: /[\^$]|\\[bBAZzGg]/,
      alias: "keyword",
    },
    "escape-char": {
      pattern: /\\(?:[dDwWsStrnvf0]|x[\da-fA-F]{2}|u[\da-fA-F]{4}|u\{[\da-fA-F]+\}|c[A-Z]|p\{[^}]+\}|P\{[^}]+\}|[1-9]\d*|.)/,
      alias: "constant",
    },
    alternation: {
      pattern: /\|/,
      alias: "operator",
    },
    quantifier: {
      pattern: /[?*+]|\{\d+(?:,\d*)?\}/,
      alias: "number",
      inside: {
        "lazy-modifier": {
          pattern: /[?]$/,
          alias: "operator",
        },
        number: /\d+/,
        punctuation: /[{},]/,
      },
    },
    "boundary-assertion": {
      pattern: /\\[bB]/,
      alias: "keyword",
    },
    "special-char": {
      pattern: /\./,
      alias: "builtin",
    },
    "flags": {
      pattern: /(?<=\/)[gimsuy]+$/,
      lookbehind: true,
      alias: "keyword",
    },
    punctuation: /[/]/,
  },
};
