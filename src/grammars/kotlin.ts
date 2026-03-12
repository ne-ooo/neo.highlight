import type { Grammar } from "../core/types";

export const kotlin: Grammar = {
  name: "kotlin",
  aliases: ["kt", "kts"],
  tokens: {
    comment: [
      { pattern: /\/\/.*/, greedy: true },
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
    ],
    string: [
      {
        pattern: /"""[\s\S]*?"""/,
        greedy: true,
        alias: "template-string",
        inside: {
          interpolation: {
            pattern: /\$\{[^}]*\}|\$\w+/,
            inside: {
              punctuation: /^\$\{|\}$/,
              variable: /^\$\w+$/,
            },
          },
        },
      },
      {
        pattern: /"(?:\\[\s\S]|[^\\"\r\n])*"/,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /\$\{[^}]*\}|\$\w+/,
            inside: {
              punctuation: /^\$\{|\}$/,
              variable: /^\$\w+$/,
            },
          },
        },
      },
    ],
    char: {
      pattern: /'(?:\\[\s\S]|[^\\'\r\n])'/,
      greedy: true,
      alias: "string",
    },
    annotation: {
      pattern: /@(?:file:|field:|get:|set:|receiver:|param:|setparam:|delegate:)?\w+/,
      alias: "decorator",
    },
    "class-name": {
      pattern:
        /(\b(?:class|object|interface|enum|sealed|data|value|inner|abstract|open|annotation|companion|extends|implements)\s+)\w+/,
      lookbehind: true,
    },
    keyword:
      /\b(?:abstract|actual|annotation|as|break|by|catch|class|companion|const|constructor|continue|crossinline|data|do|dynamic|else|enum|expect|external|final|finally|for|fun|get|if|import|in|infix|init|inline|inner|interface|internal|is|lateinit|noinline|null|object|open|operator|out|override|package|private|protected|public|reified|return|sealed|set|super|suspend|tailrec|this|throw|try|typealias|val|value|var|vararg|when|where|while|yield)\b/,
    builtin:
      /\b(?:Any|Boolean|Byte|Char|Double|Float|Int|Long|Nothing|Number|Short|String|Unit|Array|List|Map|Set|MutableList|MutableMap|MutableSet|Pair|Triple|Sequence|Iterable|Iterator|Comparable|Throwable|Exception|Error|Lazy|Result|Regex|IntRange|LongRange|CharRange|println|print|readLine|require|check|assert|error|TODO|run|with|let|also|apply|takeIf|takeUnless|repeat|lazy|buildList|buildMap|buildSet|buildString|emptyList|emptyMap|emptySet|listOf|mapOf|setOf|mutableListOf|mutableMapOf|mutableSetOf|arrayOf|intArrayOf|longArrayOf)\b/,
    boolean: /\b(?:true|false)\b/,
    number:
      /\b(?:0[xX][\da-fA-F]+(?:_[\da-fA-F]+)*[lL]?|0[bB][01]+(?:_[01]+)*[lL]?|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+(?:_\d+)*)?[fFlL]?)\b/,
    function: /\b\w+(?=\s*\()/,
    constant: /\b[A-Z][A-Z_\d]+\b/,
    operator:
      /->|\.\.|\+\+|--|&&|\|\||::|\?\.|[!=]==?|<[=<]?|>[=>]?|[-+*/%&|^~!=]=?|\?:|[?!:]/,
    punctuation: /[{}[\]();,.:@]/,
    label: {
      pattern: /\w+@/,
      alias: "variable",
    },
  },
};
