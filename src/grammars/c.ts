import type { Grammar } from "../core/types";

export const c: Grammar = {
  name: "c",
  aliases: ["h"],
  tokens: {
    comment: [
      { pattern: /\/\/.*/, greedy: true },
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
    ],
    string: [
      {
        pattern: /"(?:\\[\s\S]|[^\\"\r\n])*"/,
        greedy: true,
      },
    ],
    char: {
      pattern: /'(?:\\[\s\S]|[^\\'\r\n])+'/,
      greedy: true,
      alias: "string",
    },
    "macro-directive": {
      pattern: /(^[ \t]*)#\s*\w+(?:[^\r\n\\]|\\(?:\r\n?|\n|(?=[\s\S])))*(?:\\(?:\r\n?|\n)(?:[^\r\n\\]|\\(?:\r\n?|\n|(?=[\s\S])))*)*/m,
      lookbehind: true,
      alias: "important",
      inside: {
        directive: {
          pattern: /^#\s*\w+/,
          alias: "keyword",
        },
        "macro-name": {
          pattern: /(\b(?:define|undef|ifdef|ifndef)\s+)\w+/,
          lookbehind: true,
          alias: "constant",
        },
        string: {
          pattern: /<[^>]+>|"(?:\\[\s\S]|[^\\"\r\n])*"/,
          greedy: true,
        },
        comment: {
          pattern: /\/\/.*|\/\*[\s\S]*?\*\//,
          greedy: true,
        },
        punctuation: /[()\\,]/,
      },
    },
    "class-name": {
      pattern:
        /(\b(?:struct|union|enum|typedef)\s+)\w+/,
      lookbehind: true,
    },
    keyword:
      /\b(?:auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|inline|int|long|register|restrict|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while|_Alignas|_Alignof|_Atomic|_Bool|_Complex|_Generic|_Imaginary|_Noreturn|_Static_assert|_Thread_local)\b/,
    builtin:
      /\b(?:NULL|EOF|stdin|stdout|stderr|size_t|ptrdiff_t|intptr_t|uintptr_t|int8_t|int16_t|int32_t|int64_t|uint8_t|uint16_t|uint32_t|uint64_t|bool|true|false|printf|fprintf|sprintf|snprintf|scanf|fscanf|sscanf|malloc|calloc|realloc|free|memcpy|memmove|memset|memcmp|strlen|strcpy|strncpy|strcat|strncat|strcmp|strncmp|strstr|strchr|strrchr|fopen|fclose|fread|fwrite|fgets|fputs|fseek|ftell|rewind|feof|ferror|perror|exit|abort|atexit|atoi|atof|atol|strtol|strtoul|strtod|qsort|bsearch|abs|labs|rand|srand|time|clock|assert)\b/,
    boolean: /\b(?:true|false)\b/,
    number:
      /\b(?:0[xX][\da-fA-F]+(?:u?ll?|ll?u?|[uU])?|0[bB][01]+(?:u?ll?|ll?u?|[uU])?|0[0-7]+(?:u?ll?|ll?u?|[uU])?|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?(?:[fFlL]|u?ll?|ll?u?|[uU])?|\.\d+(?:[eE][+-]?\d+)?[fFlL]?)\b/,
    function: /\b\w+(?=\s*\()/,
    constant: /\b[A-Z][A-Z_\d]+\b/,
    operator:
      /->|\+\+|--|<<[=]?|>>[=]?|&&|\|\||[!=<>]=?|[-+*/%&|^~!=]=?|[?:]/,
    punctuation: /[{}[\]();,.:]/,
  },
};
