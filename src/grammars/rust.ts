import type { Grammar } from "../core/types";

export const rust: Grammar = {
  name: "rust",
  aliases: ["rs"],
  tokens: {
    comment: [
      { pattern: /\/\/\/?.*/, greedy: true },
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
    ],
    string: [
      {
        pattern: /b?"(?:\\[\s\S]|[^\\"\r\n])*"/,
        greedy: true,
      },
      {
        pattern: /b?r#*"[\s\S]*?"#*/,
        greedy: true,
      },
    ],
    char: {
      pattern: /b?'(?:\\(?:x[\da-fA-F]{2}|u\{[\da-fA-F]{1,6}\}|.)|[^\\'\r\n])'/,
      greedy: true,
      alias: "string",
    },
    attribute: {
      pattern: /#!?\[[\s\S]*?\]/,
      greedy: true,
      alias: "decorator",
      inside: {
        punctuation: /^#!?\[|\]$/,
        string: {
          pattern: /"(?:\\[\s\S]|[^\\"\r\n])*"/,
          greedy: true,
        },
      },
    },
    "class-name": {
      pattern:
        /(\b(?:enum|impl|struct|trait|type|union)\s+)\w+/,
      lookbehind: true,
    },
    keyword:
      /\b(?:as|async|await|break|const|continue|crate|dyn|else|enum|extern|fn|for|if|impl|in|let|loop|match|mod|move|mut|pub|ref|return|self|Self|static|struct|super|trait|type|union|unsafe|use|where|while|yield)\b/,
    builtin:
      /\b(?:bool|char|f32|f64|i8|i16|i32|i64|i128|isize|str|u8|u16|u32|u64|u128|usize|Box|String|Vec|Option|Result|Some|None|Ok|Err|HashMap|HashSet|BTreeMap|BTreeSet|Rc|Arc|Cell|RefCell|Mutex|RwLock|Pin|Cow)\b/,
    boolean: /\b(?:true|false)\b/,
    number:
      /\b(?:0[xX][\da-fA-F]+(?:_[\da-fA-F]+)*|0[oO][0-7]+(?:_[0-7]+)*|0[bB][01]+(?:_[01]+)*|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+(?:_\d+)*)?)(?:_?(?:f32|f64|i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize))?\b/,
    lifetime: {
      pattern: /'[a-zA-Z_]\w*/,
      alias: "variable",
    },
    function: /\b\w+(?=\s*\()/,
    macro: {
      pattern: /\b\w+!/,
      alias: "function",
    },
    constant: /\b[A-Z][A-Z_\d]+\b/,
    "closure-params": {
      pattern: /\|[^|]*\|/,
      inside: {
        punctuation: /\|/,
        parameter: /\w+/,
      },
    },
    operator:
      /->|=>|\.{2,3}|&&|\|\||<<=?|>>=?|[!=<>]=?|[-+*/%&|^!=]=?|::|[?~@]/,
    namespace: {
      pattern: /\b\w+(?=::)/,
    },
    punctuation: /[{}[\]();,.:]/,
  },
};
