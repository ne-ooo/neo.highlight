import type { Grammar } from "../core/types";

export const java: Grammar = {
  name: "java",
  aliases: [],
  tokens: {
    comment: [
      {
        pattern: /\/\*\*[\s\S]*?\*\//,
        greedy: true,
        alias: "comment",
        inside: {
          tag: {
            pattern: /@\w+/,
            alias: "decorator",
          },
        },
      },
      { pattern: /\/\/.*/, greedy: true },
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
    ],
    string: [
      {
        pattern: /"""[\s\S]*?"""/,
        greedy: true,
      },
      {
        pattern: /"(?:\\[\s\S]|[^\\"\r\n])*"/,
        greedy: true,
      },
    ],
    char: {
      pattern: /'(?:\\[\s\S]|[^\\'\r\n])'/,
      greedy: true,
      alias: "string",
    },
    annotation: {
      pattern: /@\w+(?:\.\w+)*/,
      alias: "decorator",
    },
    "class-name": {
      pattern:
        /(\b(?:class|enum|extends|implements|instanceof|interface|new|record|sealed|permits|throws)\s+)\w+/,
      lookbehind: true,
    },
    keyword:
      /\b(?:abstract|assert|break|case|catch|class|const|continue|default|do|else|enum|exports|extends|final|finally|for|goto|if|implements|import|instanceof|interface|module|native|new|non-sealed|null|open|opens|package|permits|private|protected|provides|public|record|requires|return|sealed|static|strictfp|super|switch|synchronized|this|throw|throws|to|transient|transitive|try|uses|var|void|volatile|while|with|yield)\b/,
    builtin:
      /\b(?:boolean|byte|char|double|float|int|long|short|String|Integer|Long|Double|Float|Boolean|Character|Byte|Short|Object|Void|Class|System|Math|Collections|Arrays|List|Map|Set|Optional|Stream|Collectors|CompletableFuture|Thread|Runnable|Callable|Future|Iterable|Iterator|Comparable|Comparator|Exception|RuntimeException|Error|Throwable)\b/,
    boolean: /\b(?:true|false)\b/,
    number:
      /\b(?:0[xX][\da-fA-F]+(?:_[\da-fA-F]+)*[lL]?|0[bB][01]+(?:_[01]+)*[lL]?|0[0-7]+(?:_[0-7]+)*[lL]?|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+(?:_\d+)*)?[fFdDlL]?)\b/,
    function: /\b\w+(?=\s*\()/,
    constant: /\b[A-Z][A-Z_\d]+\b/,
    operator:
      /->|::|\+\+|--|&&|\|\||<<=?|>>>?=?|[!=<>]=?|[-+*/%&|^~]=?|\?|:/,
    punctuation: /[{}[\]();,.:@]/,
    namespace: {
      pattern: /(\b(?:package|import)\s+)[\w.]+/,
      lookbehind: true,
    },
  },
};
