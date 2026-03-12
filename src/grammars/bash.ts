import type { Grammar } from "../core/types";

export const bash: Grammar = {
  name: "bash",
  aliases: ["zsh"],
  tokens: {
    comment: {
      pattern: /(^|[^\\$])#.*/,
      lookbehind: true,
      greedy: true,
    },
    shebang: {
      pattern: /^#!.*/,
      alias: "important",
    },
    string: [
      {
        pattern: /\$'(?:\\[\s\S]|[^\\'])*'/,
        greedy: true,
        inside: {
          "escape-char": {
            pattern: /\\(?:[abefnrtv\\'"]|x[\da-fA-F]{1,2}|u[\da-fA-F]{1,4}|[0-7]{1,3})/,
            alias: "constant",
          },
        },
      },
      {
        pattern: /"(?:\\[\s\S]|\$(?:\([^)]+\)|\{[^}]+\}|\w+)|[^\\$"\r\n])*"/,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /\$(?:\([^)]+\)|\{[^}]+\}|\w+)/,
            inside: {
              variable: /\$\w+/,
              punctuation: /[(){}]/,
            },
          },
        },
      },
      {
        pattern: /'[^']*'/,
        greedy: true,
      },
    ],
    heredoc: {
      pattern: /<<-?\s*(['"]?)(\w+)\1\s[\s\S]*?^\2$/m,
      greedy: true,
      alias: "string",
      inside: {
        punctuation: /^<<-?\s*['"]?\w+['"]?/,
      },
    },
    variable: [
      /\$\{[^}]+\}/,
      /\$\([^)]+\)/,
      /\$(?:[a-zA-Z_]\w*|[0-9!@#$*?_-])/,
    ],
    function: {
      pattern: /(\b(?:function)\s+)\w+|\b\w+(?=\s*\(\s*\))/,
      lookbehind: true,
    },
    keyword:
      /\b(?:if|then|else|elif|fi|for|while|until|do|done|in|case|esac|function|select|time|coproc|break|continue|return|exit|trap|source|export|readonly|declare|typeset|local|unset|shift|set|shopt|eval|exec|enable|builtin|read|mapfile|readarray|printf|echo|test|true|false)\b/,
    builtin:
      /\b(?:alias|bg|bind|builtin|caller|cd|command|compgen|complete|compopt|dirs|disown|echo|enable|eval|exec|exit|export|fc|fg|getopts|hash|help|history|jobs|kill|let|local|logout|mapfile|popd|printf|pushd|pwd|read|readarray|readonly|return|set|shift|shopt|source|suspend|test|times|trap|type|typeset|ulimit|umask|unalias|unset|wait|cat|ls|grep|sed|awk|find|sort|uniq|wc|head|tail|cut|tr|xargs|tee|diff|patch|chmod|chown|mkdir|rmdir|rm|cp|mv|ln|touch|file|stat|which|whereis|curl|wget|tar|gzip|gunzip|zip|unzip|ssh|scp|rsync|git|docker|npm|node|python|pip|make|gcc|go|cargo|rustc)\b/,
    boolean: /\b(?:true|false)\b/,
    number: /\b(?:0[xX][\da-fA-F]+|0[0-7]+|\d+)\b/,
    "file-descriptor": {
      pattern: /\B&\d\b/,
      alias: "number",
    },
    operator:
      /\|\||&&|;;|&>|[&|<>]=?|\+\+|--|[!=]=|<<<?|>>>?|[-+*/%]=?|[~^!]/,
    punctuation: /[{}[\]();,.:]/,
  },
};
