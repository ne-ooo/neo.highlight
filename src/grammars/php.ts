import type { Grammar } from "../core/types";

export const php: Grammar = {
  name: "php",
  aliases: [],
  tokens: {
    "php-tag": {
      pattern: /<\?(?:php)?|<\?=|\?>/i,
      alias: "important",
    },
    comment: [
      { pattern: /\/\/.*|#.*/, greedy: true },
      { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
    ],
    "doc-comment": {
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
    string: [
      {
        pattern: /<<<'(\w+)'\r?\n[\s\S]*?\r?\n\1;/,
        greedy: true,
        alias: "nowdoc",
      },
      {
        pattern: /<<<(\w+)\r?\n[\s\S]*?\r?\n\1;/,
        greedy: true,
        alias: "heredoc",
        inside: {
          interpolation: {
            pattern: /\{\$[^}]+\}|\$\w+(?:\[[\w']+\]|->\w+)*/,
            inside: {
              variable: /\$\w+/,
              punctuation: /[{}\[\]\->]/,
            },
          },
        },
      },
      {
        pattern: /"(?:\\[\s\S]|[^\\"\r\n])*"/,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /\{\$[^}]+\}|\$\w+(?:\[[\w']+\]|->\w+)*/,
            inside: {
              variable: /\$\w+/,
              punctuation: /[{}\[\]\->]/,
            },
          },
        },
      },
      {
        pattern: /'(?:\\[\s\S]|[^\\'\r\n])*'/,
        greedy: true,
      },
    ],
    attribute: {
      pattern: /#\[[\s\S]*?\]/,
      greedy: true,
      alias: "decorator",
      inside: {
        punctuation: /^#\[|\]$/,
      },
    },
    "class-name": {
      pattern:
        /(\b(?:class|enum|extends|implements|instanceof|interface|new|trait)\s+)\w+/,
      lookbehind: true,
    },
    keyword:
      /\b(?:abstract|and|array|as|break|callable|case|catch|class|clone|const|continue|declare|default|die|do|echo|else|elseif|empty|enddeclare|endfor|endforeach|endif|endswitch|endwhile|enum|eval|exit|extends|final|finally|fn|for|foreach|function|global|goto|if|implements|include|include_once|instanceof|insteadof|interface|isset|list|match|namespace|new|null|or|print|private|protected|public|readonly|require|require_once|return|static|switch|throw|trait|try|unset|use|var|while|xor|yield|yield from)\b/i,
    builtin:
      /\b(?:array_chunk|array_combine|array_diff|array_filter|array_keys|array_map|array_merge|array_pop|array_push|array_reduce|array_reverse|array_search|array_shift|array_slice|array_sort|array_splice|array_unique|array_unshift|array_values|arsort|asort|compact|count|each|end|extract|in_array|key|ksort|next|pos|prev|range|reset|rsort|shuffle|sizeof|sort|uasort|uksort|usort|chr|chunk_split|explode|htmlspecialchars|implode|join|ltrim|mb_strlen|mb_strtolower|mb_strtoupper|md5|nl2br|ord|rtrim|sha1|sprintf|str_contains|str_ends_with|str_pad|str_repeat|str_replace|str_split|str_starts_with|str_word_count|strlen|strtolower|strtoupper|substr|trim|ucfirst|ucwords|wordwrap|var_dump|print_r|var_export|json_encode|json_decode|intval|floatval|strval|boolval|is_array|is_bool|is_callable|is_float|is_int|is_null|is_numeric|is_object|is_string|isset|empty|unset)\b/i,
    variable: /\$\w+/,
    boolean: /\b(?:true|false)\b/i,
    number:
      /\b(?:0[xX][\da-fA-F]+(?:_[\da-fA-F]+)*|0[bB][01]+(?:_[01]+)*|0[oO][0-7]+(?:_[0-7]+)*|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+(?:_\d+)*)?)\b/,
    function: /\b\w+(?=\s*\()/,
    constant: /\b[A-Z][A-Z_\d]+\b/,
    operator:
      /=>|<=>|\?\?=?|\?:|\.{3}|->|::|\+\+|--|&&|\|\||<<=?|>>=?|[!=<>]=?|[-+*/%&|^~.]=?|[?!@]/,
    punctuation: /[{}[\]();,.:$]/,
    "type-hint": {
      pattern:
        /(\b(?:function|fn)\s+\w+\s*\([^)]*\)\s*:\s*)\??\w+/,
      lookbehind: true,
      alias: "class-name",
    },
  },
};
