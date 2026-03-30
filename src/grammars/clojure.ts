import type { Grammar } from "../core/types";

export const clojure: Grammar = {
  name: "clojure",
  aliases: ["clj", "cljs", "cljc", "edn"],
  tokens: {
    comment: {
      pattern: /;.*/,
      greedy: true,
    },
    string: {
      pattern: /"(?:\\[\s\S]|[^\\"])*"/,
      greedy: true,
    },
    regex: {
      pattern: /#"(?:\\[\s\S]|[^\\"])*"/,
      greedy: true,
      alias: "string",
    },
    keyword: {
      pattern: /:[a-zA-Z][\w.*+!\-'?<>=]*/,
      alias: "symbol",
    },
    "special-form":
      /\b(?:def|defn|defn-|defmacro|defmulti|defmethod|defonce|defprotocol|defrecord|deftype|defstruct|fn|let|loop|recur|do|if|when|cond|case|try|catch|finally|throw|quote|var|set!|new|\.)\b/,
    boolean: /\b(?:true|false|nil)\b/,
    builtin:
      /\b(?:ns|require|import|use|in-ns|refer|apply|map|filter|reduce|first|rest|cons|conj|assoc|dissoc|get|seq|range|into|merge|str|println|prn|print|comp|partial|juxt|identity|constantly|complement)\b/,
    function: {
      pattern: /(\()\s*[a-zA-Z!$%&*+\-./:<=>?@^_~][\w!$%&*+\-./:<=>?@^_~]*/,
      lookbehind: true,
    },
    number:
      /\b(?:[-+]?\d+(?:\/\d+)?(?:\.\d*)?(?:[eE][+-]?\d+)?[NMr]?|0[xX][\dA-Fa-f]+|[-+]?(?:Infinity|NaN))\b/,
    char: {
      pattern: /\\(?:newline|space|tab|formfeed|backspace|return|u[\dA-Fa-f]{4}|o[0-7]{1,3}|.)/,
      alias: "string",
    },
    operator: /[#'^@~`]/,
    punctuation: /[{}[\]()]/,
  },
};
