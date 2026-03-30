import type { Grammar } from "../core/types";

export const r: Grammar = {
  name: "r",
  aliases: ["rlang"],
  tokens: {
    comment: {
      pattern: /#.*/,
      greedy: true,
    },
    string: {
      pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
      greedy: true,
    },
    keyword:
      /\b(?:break|else|for|function|if|in|next|repeat|return|while)\b/,
    boolean: /\b(?:TRUE|FALSE|T|F)\b/,
    builtin:
      /\b(?:NA|NA_integer_|NA_real_|NA_complex_|NA_character_|NULL|Inf|NaN|LETTERS|letters|pi)\b/,
    function: /\b[a-zA-Z_.]\w*(?=\s*\()/,
    number:
      /\b(?:0[xX][\dA-Fa-f]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[iL]?|\.\d+(?:[eE][+-]?\d+)?)\b/,
    operator:
      /->?>?|<-|<<?|%%?|>=?|<=?|={1,2}|!=|\|\|?|&&?|::?|~|\$|@|\^|\+|-|\*|\//,
    punctuation: /[{}[\];(),]/,
  },
};
