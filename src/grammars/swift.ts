import type { Grammar } from "../core/types";

export const swift: Grammar = {
  name: "swift",
  aliases: [],
  tokens: {
    comment: [
      { pattern: /\/\/.*/, greedy: true },
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
    ],
    "string-literal": {
      pattern: /"""[\s\S]*?"""/,
      greedy: true,
      alias: "string",
      inside: {
        interpolation: {
          pattern: /\\\([^)]*\)/,
          inside: {
            punctuation: /^\\\(|\)$/,
          },
        },
      },
    },
    string: {
      pattern: /"(?:\\[\s\S]|[^\\"\r\n])*"/,
      greedy: true,
      inside: {
        interpolation: {
          pattern: /\\\([^)]*\)/,
          inside: {
            punctuation: /^\\\(|\)$/,
          },
        },
      },
    },
    attribute: {
      pattern: /@\w+(?:\([^)]*\))?/,
      alias: "decorator",
    },
    "class-name": {
      pattern:
        /(\b(?:class|struct|enum|protocol|extension|typealias|associatedtype)\s+)\w+/,
      lookbehind: true,
    },
    keyword:
      /\b(?:actor|any|as|associatedtype|async|await|break|case|catch|class|continue|convenience|default|defer|deinit|didSet|do|dynamic|else|enum|extension|fallthrough|final|for|func|get|guard|if|import|in|indirect|infix|init|inout|internal|is|isolated|lazy|let|mutating|nonisolated|nonmutating|open|operator|optional|override|postfix|precedencegroup|prefix|private|protocol|public|repeat|required|rethrows|return|self|Self|set|some|static|struct|subscript|super|switch|throw|throws|try|typealias|unowned|var|weak|where|while|willSet|yield)\b/,
    builtin:
      /\b(?:Any|AnyObject|Array|Bool|Character|Codable|CustomStringConvertible|Decodable|Dictionary|Double|Encodable|Equatable|Error|Float|Hashable|Identifiable|Int|Int8|Int16|Int32|Int64|Never|Optional|Result|Sendable|Sequence|Set|String|Substring|Type|UInt|UInt8|UInt16|UInt32|UInt64|URL|URLSession|Void|print|debugPrint|dump|fatalError|precondition|preconditionFailure|assert|assertionFailure|min|max|abs|zip|stride|sequence|repeatElement|type|withUnsafePointer|withUnsafeMutablePointer)\b/,
    boolean: /\b(?:true|false)\b/,
    keyword2: {
      pattern: /\bnil\b/,
      alias: "keyword",
    },
    number:
      /\b(?:0[xX][\da-fA-F]+(?:_[\da-fA-F]+)*(?:\.[\da-fA-F]+(?:_[\da-fA-F]+)*)?(?:[pP][+-]?\d+(?:_\d+)*)?|0[oO][0-7]+(?:_[0-7]+)*|0[bB][01]+(?:_[01]+)*|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+(?:_\d+)*)?)\b/,
    function: /\b\w+(?=\s*\()/,
    constant: /\b[A-Z][A-Z_\d]+\b/,
    operator:
      /\.{2,3}|->|&&|\|\||<<=?|>>=?|[!=<>]=?|[-+*/%&|^~]=?|[?!]|\bas\b/,
    punctuation: /[{}[\]();,.:@#]/,
  },
};
