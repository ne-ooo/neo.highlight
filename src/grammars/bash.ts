import type { Grammar, TokenPatternMatch } from "../core/types";

interface BashLineScan {
  commentStart?: number;
  heredocs: BashLineHeredoc[];
}

interface BashLineHeredoc {
  operatorStart: number;
  nextIndex: number;
  delimiter: string;
  stripTabs: boolean;
}

interface BashSourceLine {
  start: number;
  contentEnd: number;
  nextStart: number;
  text: string;
}

function scanBashLine(line: string): BashLineScan {
  const heredocs: BashLineHeredoc[] = [];
  let atWordStart = true;
  let arithmeticDepth = 0;
  for (let index = 0; index < line.length;) {
    const char = line[index]!;
    if (char === "\\") {
      index += 2;
      atWordStart = false;
      continue;
    }
    if (char === "'" || char === '"') {
      index = skipBashQuote(line, index + 1, char);
      atWordStart = false;
      continue;
    }
    if (arithmeticDepth > 0) {
      if (line.startsWith("((", index)) {
        arithmeticDepth++;
        index += 2;
      } else if (line.startsWith("))", index)) {
        arithmeticDepth--;
        index += 2;
      } else {
        index++;
      }
      continue;
    }
    if (char === "#" && atWordStart) {
      return { commentStart: index, heredocs };
    }
    if (line.startsWith("((", index)) {
      arithmeticDepth = 1;
      atWordStart = false;
      index += 2;
      continue;
    }
    if (line.startsWith("<<", index)) {
      const heredoc = parseBashHeredocOpener(line, index);
      if (heredoc) {
        heredocs.push(heredoc);
        index = heredoc.nextIndex;
        atWordStart = false;
        continue;
      }
      index += line[index + 2] === "<" ? 3 : 2;
      atWordStart = true;
      continue;
    }
    atWordStart = /[\s;&()|<>]/.test(char);
    index++;
  }
  return { heredocs };
}

function skipBashQuote(line: string, start: number, quote: string): number {
  for (let index = start; index < line.length; index++) {
    if (quote === '"' && line[index] === "\\") {
      index++;
      continue;
    }
    if (line[index] === quote) return index + 1;
  }
  return line.length;
}

function parseBashHeredocOpener(
  line: string,
  operatorStart: number,
): BashLineHeredoc | undefined {
  if (line[operatorStart - 1] === "<" || line[operatorStart + 2] === "<") {
    return undefined;
  }
  let index = operatorStart + 2;
  const stripTabs = line[index] === "-";
  if (stripTabs) index++;
  while (line[index] === " " || line[index] === "\t") index++;

  if (line[index] === "#") return undefined;
  let consumed = false;
  let delimiter = "";
  while (index < line.length) {
    const character = line[index]!;
    if (/[\s;&()|<>]/.test(character)) break;
    consumed = true;
    if (character === "\\") {
      if (index + 1 >= line.length) return undefined;
      delimiter += line[index + 1];
      index += 2;
      continue;
    }
    if (character === "'" || character === '"') {
      const quote = character;
      index++;
      while (index < line.length && line[index] !== quote) {
        if (quote === '"' && line[index] === "\\" && index + 1 < line.length) {
          const escaped = line[index + 1]!;
          delimiter += /[$`"\\]/.test(escaped) ? escaped : `\\${escaped}`;
          index += 2;
        } else {
          delimiter += line[index++];
        }
      }
      if (line[index] !== quote) return undefined;
      index++;
      continue;
    }
    delimiter += character;
    index++;
  }
  if (!consumed) return undefined;
  return { operatorStart, nextIndex: index, delimiter, stripTabs };
}

function* matchBashComments(source: string): Iterable<TokenPatternMatch> {
  for (let lineStart = 0; lineStart <= source.length;) {
    const newline = source.indexOf("\n", lineStart);
    const lineEnd = newline === -1 ? source.length : newline;
    const contentEnd =
      lineEnd > lineStart && source[lineEnd - 1] === "\r"
        ? lineEnd - 1
        : lineEnd;
    const scan = scanBashLine(source.slice(lineStart, contentEnd));
    if (scan.commentStart !== undefined) {
      const index = lineStart + scan.commentStart;
      yield { index, text: source.slice(index, contentEnd) };
    }
    if (newline === -1) break;
    lineStart = newline + 1;
  }
}

function indexBashSourceLines(source: string): BashSourceLine[] {
  const lines: BashSourceLine[] = [];
  for (let start = 0; start <= source.length;) {
    const newline = source.indexOf("\n", start);
    const lineEnd = newline === -1 ? source.length : newline;
    const contentEnd = lineEnd > start && source[lineEnd - 1] === "\r"
      ? lineEnd - 1
      : lineEnd;
    lines.push({
      start,
      contentEnd,
      nextStart: newline === -1 ? source.length : newline + 1,
      text: source.slice(start, contentEnd),
    });
    if (newline === -1) break;
    start = newline + 1;
  }
  return lines;
}

function* matchBashHeredocs(source: string): Iterable<TokenPatternMatch> {
  const lines = indexBashSourceLines(source);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const commandLine = lines[lineIndex]!;
    const openers = scanBashLine(commandLine.text).heredocs;
    if (openers.length === 0 || commandLine.nextStart >= source.length) {
      continue;
    }

    let bodyLineIndex = lineIndex + 1;
    let end = source.length;
    for (const opener of openers) {
      let foundCloser = false;
      while (bodyLineIndex < lines.length) {
        const bodyLine = lines[bodyLineIndex]!;
        const candidate = opener.stripTabs
          ? bodyLine.text.replace(/^\t+/, "")
          : bodyLine.text;
        bodyLineIndex++;
        if (candidate !== opener.delimiter) continue;
        end = bodyLine.contentEnd;
        foundCloser = true;
        break;
      }
      if (!foundCloser) {
        end = source.length;
        break;
      }
    }

    const start = commandLine.start + openers[0]!.operatorStart;
    yield { index: start, text: source.slice(start, end) };
    lineIndex = Math.max(lineIndex, bodyLineIndex - 1);
  }
}

export const bash: Grammar = {
  name: "bash",
  aliases: ["zsh"],
  tokens: {
    shebang: {
      pattern: /^#!.*/,
      alias: "important",
    },
    comment: {
      pattern: /#.*/,
      matcher: matchBashComments,
      greedy: true,
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
        pattern: /"(?:\\[\s\S]|\$(?:\([^()\r\n]+\)|\{[^{}\r\n]+\}|\w+)|[^\\$"\r\n])*"/,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /\$(?:\([^()\r\n]+\)|\{[^{}\r\n]+\}|\w+)/,
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
      pattern: /<<-?[^\r\n]*\r?\n/,
      matcher: matchBashHeredocs,
      greedy: true,
      alias: "string",
      inside: {
        punctuation: /^<<-?[^\S\r\n]*['"]?\w+['"]?/,
      },
    },
    variable: [
      /\$\{[^{}\r\n]+\}/,
      /\$\([^()\r\n]+\)/,
      /\$(?:[a-zA-Z_]\w*|[0-9!@#$*?_-])/,
    ],
    function: {
      pattern: /(\b(?:function)\s+)\w+|\b\w+(?=\s*\(\s*\))/,
      lookbehind: true,
    },
    boolean: /\b(?:true|false)\b/,
    keyword:
      /\b(?:if|then|else|elif|fi|for|while|until|do|done|in|case|esac|function|select|time|coproc|break|continue|return|exit|trap|source|export|readonly|declare|typeset|local|unset|shift|set|shopt|eval|exec|enable|builtin|read|mapfile|readarray|printf|echo|test|true|false)\b/,
    builtin:
      /\b(?:alias|bg|bind|builtin|caller|cd|command|compgen|complete|compopt|dirs|disown|echo|enable|eval|exec|exit|export|fc|fg|getopts|hash|help|history|jobs|kill|let|local|logout|mapfile|popd|printf|pushd|pwd|read|readarray|readonly|return|set|shift|shopt|source|suspend|test|times|trap|type|typeset|ulimit|umask|unalias|unset|wait|cat|ls|grep|sed|awk|find|sort|uniq|wc|head|tail|cut|tr|xargs|tee|diff|patch|chmod|chown|mkdir|rmdir|rm|cp|mv|ln|touch|file|stat|which|whereis|curl|wget|tar|gzip|gunzip|zip|unzip|ssh|scp|rsync|git|docker|npm|node|python|pip|make|gcc|go|cargo|rustc)\b/,
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
