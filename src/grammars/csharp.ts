import type { Grammar } from "../core/types";

export const csharp: Grammar = {
  name: "csharp",
  aliases: ["cs", "c#", "dotnet"],
  tokens: {
    comment: [
      {
        pattern: /\/\/\/.*$/m,
        greedy: true,
        alias: "comment",
        inside: {
          tag: {
            pattern: /<\/?[\w.]+(?:\s+[\w.]+\s*=\s*(?:"[^"]*"|'[^']*'))*\s*\/?>/,
            alias: "tag",
            inside: {
              "attr-name": /[\w.]+(?=\s*=)/,
              "attr-value": {
                pattern: /=\s*(?:"[^"]*"|'[^']*')/,
                inside: {
                  punctuation: /^=|["']/,
                },
              },
              punctuation: /[<>/]/,
            },
          },
        },
      },
      { pattern: /\/\/.*/, greedy: true },
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
    ],
    string: [
      {
        pattern: /@"(?:""|\\[\s\S]|[^"])*"/,
        greedy: true,
        alias: "verbatim-string",
      },
      {
        pattern: /\$@?"(?:\\[\s\S]|""|[^"])*"/,
        greedy: true,
        alias: "interpolated-string",
        inside: {
          interpolation: {
            pattern: /\{[^}]*\}/,
            inside: {
              punctuation: /^\{|\}$/,
            },
          },
        },
      },
      {
        pattern: /"""[\s\S]*?"""/,
        greedy: true,
        alias: "raw-string",
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
    attribute: {
      pattern: /\[[\s\S]*?\]/,
      inside: {
        "attr-name": /\w+(?=\s*[(\]])/,
        punctuation: /[[\]()]/,
        string: {
          pattern: /"(?:\\[\s\S]|[^\\"\r\n])*"/,
          greedy: true,
        },
      },
    },
    "class-name": {
      pattern:
        /(\b(?:class|enum|interface|namespace|new|record|struct)\s+)\w+/,
      lookbehind: true,
    },
    keyword:
      /\b(?:abstract|add|alias|and|as|ascending|async|await|base|bool|break|byte|case|catch|char|checked|class|const|continue|decimal|default|delegate|descending|do|double|dynamic|else|enum|event|explicit|extern|finally|fixed|float|for|foreach|from|get|global|goto|group|if|implicit|in|init|int|interface|internal|into|is|join|let|lock|long|managed|nameof|namespace|new|not|null|object|on|operator|or|orderby|out|override|params|partial|private|protected|public|readonly|record|ref|remove|return|sbyte|sealed|select|set|short|sizeof|stackalloc|static|string|struct|switch|this|throw|try|typeof|uint|ulong|unchecked|unmanaged|unsafe|ushort|using|value|var|virtual|void|volatile|when|where|while|with|yield)\b/,
    builtin:
      /\b(?:Console|String|Int32|Int64|Double|Float|Boolean|Char|Byte|Object|Array|List|Dictionary|HashSet|Queue|Stack|LinkedList|Task|Func|Action|Predicate|IEnumerable|ICollection|IList|IDictionary|IDisposable|IComparable|IEquatable|ICloneable|Nullable|Tuple|ValueTuple|Span|Memory|ReadOnlySpan|ReadOnlyMemory|Math|DateTime|TimeSpan|Guid|Regex|StringBuilder|StreamReader|StreamWriter|HttpClient|JsonSerializer|Enumerable|Queryable|Convert|BitConverter|Environment|Path|File|Directory|Thread|Monitor|Mutex|SemaphoreSlim|CancellationToken|CancellationTokenSource)\b/,
    boolean: /\b(?:true|false)\b/,
    number:
      /\b(?:0[xX][\da-fA-F]+(?:_[\da-fA-F]+)*[uUlL]*|0[bB][01]+(?:_[01]+)*[uUlL]*|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+(?:_\d+)*)?[fFdDmMuUlL]*)\b/,
    function: /\b\w+(?=\s*\()/,
    constant: /\b[A-Z][A-Z_\d]+\b/,
    operator:
      /=>|\?\?=?|\?\.?|\+\+|--|&&|\|\||<<=?|>>=?|[!=<>]=?|[-+*/%&|^~!=]=?|::|[?!:]/,
    punctuation: /[{}[\]();,.:@#]/,
    namespace: {
      pattern: /(\b(?:namespace|using)\s+)[\w.]+/,
      lookbehind: true,
    },
    "generic-type": {
      pattern: /\w+<(?:[^<>]|<[^<>]*>)*>/,
      inside: {
        "class-name": /^\w+/,
        punctuation: /[<>,]/,
        keyword: /\b(?:in|out)\b/,
      },
    },
  },
};
