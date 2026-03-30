import type { Grammar } from "../core/types";

export const solidity: Grammar = {
  name: "solidity",
  aliases: ["sol"],
  tokens: {
    comment: [
      { pattern: /\/\/\/.*/, greedy: true, alias: "doc-comment" },
      { pattern: /\/\/.*/, greedy: true },
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
    ],
    string: [
      { pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/, greedy: true },
      { pattern: /hex"[\dA-Fa-f]*"/, greedy: true },
    ],
    keyword:
      /\b(?:abstract|anonymous|as|assembly|break|case|catch|constant|constructor|continue|contract|default|delete|do|else|emit|enum|error|event|external|fallback|for|function|if|immutable|import|indexed|inheritance|interface|internal|is|let|library|mapping|memory|modifier|new|override|payable|pragma|private|public|pure|receive|return|returns|revert|solidity|storage|struct|switch|this|throw|try|type|unchecked|using|var|view|virtual|while)\b/,
    boolean: /\b(?:true|false)\b/,
    builtin:
      /\b(?:address|bool|bytes(?:[1-9]|[12]\d|3[0-2])?|int(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|uint(?:8|16|24|32|40|48|56|64|72|80|88|96|104|112|120|128|136|144|152|160|168|176|184|192|200|208|216|224|232|240|248|256)?|string|bytes|tuple)\b/,
    "class-name": {
      pattern:
        /(\b(?:contract|interface|library|struct|enum|error|event)\s+)\w+/,
      lookbehind: true,
    },
    "global-objects": {
      pattern:
        /\b(?:msg|block|tx|abi|type)\b(?=\.)/,
      alias: "builtin",
    },
    function: /\b[a-zA-Z_]\w*(?=\s*\()/,
    number:
      /\b(?:0[xX][\dA-Fa-f]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*(?:wei|gwei|ether|seconds|minutes|hours|days|weeks|years)?\b/,
    operator:
      /[-+*/%]=?|[=!<>]=?|&&|\|\||[&|^~]|<<|>>|=>|\*\*/,
    punctuation: /[{}[\];(),.?:]/,
  },
};
