import type { Grammar, TokenPatternMatch } from "../core/types";

interface RubyLexicalRange {
  start: number;
  end: number;
  kind:
    | "block-comment"
    | "command"
    | "line-comment"
    | "percent"
    | "quoted"
    | "regex";
}

interface RubyLocalScope {
  start: number;
  end: number;
  locals: Set<string>;
  parent?: RubyLocalScope;
  inheritsParent: boolean;
}

function skipRubyDelimited(
  source: string,
  start: number,
  end: number,
  open: string,
  close: string,
): number | undefined {
  let depth = 1;
  for (let index = start; index < end; index++) {
    if (source[index] === "\\") {
      index++;
      continue;
    }
    if (open !== close && source[index] === open) depth++;
    if (source[index] !== close) continue;
    depth--;
    if (depth === 0) return index + 1;
  }
  return undefined;
}

function getRubyPercentDelimiter(
  source: string,
  start: number,
): { contentStart: number; open: string; close: string } | undefined {
  let delimiterIndex = start + 1;
  const explicitType = /[qQwWiIxsr]/.test(source[delimiterIndex] ?? "");
  if (explicitType) delimiterIndex++;
  const open = source[delimiterIndex];
  if (!open || /[\w\s]/.test(open) || (!explicitType && open === "=")) {
    return undefined;
  }
  const close =
    open === "(" ? ")" :
    open === "[" ? "]" :
    open === "{" ? "}" :
    open === "<" ? ">" :
    open;
  return { contentStart: delimiterIndex + 1, open, close };
}

function findRubyRegexEnd(source: string, start: number): number | undefined {
  for (let index = start + 1; index < source.length; index++) {
    if (source[index] === "\\") {
      index++;
      continue;
    }
    if (source[index] === "/") {
      index++;
      while (/[eimnosux]/.test(source[index] ?? "")) {
        index++;
      }
      return index;
    }
  }
  return undefined;
}

function canStartRubyRegex(
  source: string,
  start: number,
  visibleLocals: ReadonlyMap<string, number>,
): boolean {
  const whitespaceBefore = /[ \t]/.test(source[start - 1] ?? "");
  const compactArgument = !/[\s]/.test(source[start + 1] ?? "");
  let previous = start - 1;
  while (previous >= 0 && /[ \t]/.test(source[previous]!)) previous--;
  if (previous < 0 || source[previous] === "\n" || source[previous] === "\r") {
    return true;
  }
  if (/[=([{,:;!&|?~+*%^<>-]/.test(source[previous]!)) return true;
  let wordStart = previous;
  while (wordStart >= 0 && /\w/.test(source[wordStart]!)) wordStart--;
  const previousWord = source.slice(wordStart + 1, previous + 1);
  if (whitespaceBefore && compactArgument) {
    if (
      previousWord &&
      !/^[A-Z]/.test(previousWord) &&
      source[wordStart] !== "@" &&
      source[wordStart] !== "$" &&
      !visibleLocals.has(previousWord)
    ) {
      return true;
    }
  }
  return /^(?:and|do|if|not|or|return|then|unless|until|when|while|yield)$/.test(
    previousWord,
  );
}

function addRubyParameterNames(
  parameters: string,
  knownLocals: Set<string>,
): void {
  for (const segment of parameters.split(/[;,]/)) {
    const name = /^\s*(?:\(\s*)?[*&]*([a-z_]\w*)/.exec(segment)?.[1];
    if (name) knownLocals.add(name);
  }
}

function addRubyDefinitionParameters(
  source: string,
  afterDef: number,
  knownLocals: Set<string>,
): void {
  const lineEnd = source.indexOf("\n", afterDef);
  const signature = source.slice(
    afterDef,
    lineEnd === -1 ? source.length : lineEnd,
  );
  const parameters = /^\s+(?:self\.)?[A-Za-z_]\w*[!?=]?\s*(?:\(([^)]*)\)|([^;]*))/.exec(
    signature,
  );
  addRubyParameterNames(parameters?.[1] ?? parameters?.[2] ?? "", knownLocals);
}

function indexRubyLocalScopes(source: string): RubyLocalScope[] {
  const root: RubyLocalScope = {
    start: 0,
    end: source.length,
    locals: new Set<string>(),
    inheritsParent: false,
  };
  const scopes = [root];
  const endFrames: Array<RubyLocalScope | undefined> = [];
  const braceFrames: Array<RubyLocalScope | undefined> = [];
  let currentScope = root;
  let pendingLocalTargets: string[] = [];
  let lineHasCode = false;
  let controlDoPending = false;
  let scheduledHeredocBody: { start: number; end: number } | undefined;
  let scheduledCommandLineEnd = -1;
  const structuralHeredocPattern =
    /<<([-~]?)(?:(["'`])((?:\\[\s\S]|(?!\2)[^\r\n])*)\2|([A-Za-z_]\w*))/gy;
  const blockComments: Array<{ start: number; end: number }> = [];
  const blockCommentPattern =
    /^=begin\b(?:(?!^=begin\b|^=end\b)[\s\S])*^=end\b/gm;
  for (
    let match = blockCommentPattern.exec(source);
    match;
    match = blockCommentPattern.exec(source)
  ) {
    blockComments.push({ start: match.index, end: blockCommentPattern.lastIndex });
  }
  let blockOffset = 0;

  for (let index = 0; index < source.length;) {
    if (scheduledHeredocBody && index >= scheduledHeredocBody.start) {
      index = scheduledHeredocBody.end;
      scheduledHeredocBody = undefined;
      pendingLocalTargets = [];
      lineHasCode = false;
      controlDoPending = false;
      continue;
    }
    while (
      blockOffset < blockComments.length &&
      blockComments[blockOffset]!.start < index
    ) {
      blockOffset++;
    }
    const blockComment = blockComments[blockOffset];
    if (blockComment?.start === index) {
      index = blockComment.end;
      blockOffset++;
      continue;
    }

    const character = source[index]!;
    if (character === "#") {
      const newline = source.indexOf("\n", index + 1);
      index = newline === -1 ? source.length : newline + 1;
      pendingLocalTargets = [];
      lineHasCode = false;
      controlDoPending = false;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      index = skipRubyDelimited(
        source,
        index + 1,
        source.length,
        character,
        character,
      ) ?? source.length;
      lineHasCode = true;
      continue;
    }
    if (character === "%") {
      const delimiter = getRubyPercentDelimiter(source, index);
      if (delimiter) {
        index = skipRubyDelimited(
          source,
          delimiter.contentStart,
          source.length,
          delimiter.open,
          delimiter.close,
        ) ?? source.length;
        lineHasCode = true;
        continue;
      }
    }
    if (character === "/") {
      let previous = index - 1;
      while (previous >= 0 && /[ \t]/.test(source[previous]!)) previous--;
      const expressionStart =
        previous < 0 ||
        source[previous] === "\n" ||
        source[previous] === "\r" ||
        /[=([{,:;!&|?~+*%^<>-]/.test(source[previous]!);
      if (expressionStart) {
        const end = findRubyRegexEnd(source, index);
        if (end !== undefined) {
          index = end;
          lineHasCode = true;
          continue;
        }
      }
    }
    if (character === "<" && source[index + 1] === "<") {
      const commandLineEnd = scheduledCommandLineEnd > index
        ? scheduledCommandLineEnd
        : source.indexOf("\n", index + 2);
      if (commandLineEnd !== -1) {
        scheduledCommandLineEnd = commandLineEnd;
        structuralHeredocPattern.lastIndex = index;
        const opener = structuralHeredocPattern.exec(source);
        if (opener) {
          const delimiter = opener[3] ?? opener[4]!;
          const allowIndent = opener[1] === "-" || opener[1] === "~";
          const firstBodyStart = commandLineEnd + 1;
          let bodyLineStart =
            scheduledCommandLineEnd === commandLineEnd && scheduledHeredocBody
              ? scheduledHeredocBody.end
              : firstBodyStart;
          let bodyEnd = source.length;
          while (bodyLineStart <= source.length) {
            const newline = source.indexOf("\n", bodyLineStart);
            const lineEnd = newline === -1 ? source.length : newline;
            const contentEnd =
              lineEnd > bodyLineStart && source[lineEnd - 1] === "\r"
                ? lineEnd - 1
                : lineEnd;
            const line = source.slice(bodyLineStart, contentEnd);
            const candidate = allowIndent ? line.replace(/^[^\S\r\n]+/, "") : line;
            if (candidate === delimiter) {
              bodyEnd = newline === -1 ? source.length : newline + 1;
              break;
            }
            if (newline === -1) break;
            bodyLineStart = newline + 1;
          }
          scheduledHeredocBody = {
            start: firstBodyStart,
            end: bodyEnd,
          };
        }
      }
    }
    if (character === "{") {
      lineHasCode = true;
      let parameterStart = index + 1;
      while (/[ \t]/.test(source[parameterStart] ?? "")) parameterStart++;
      if (source[parameterStart] === "|") {
        const parameterEnd = source.indexOf("|", parameterStart + 1);
        if (parameterEnd !== -1) {
          const scope: RubyLocalScope = {
            start: index,
            end: source.length,
            locals: new Set<string>(),
            parent: currentScope,
            inheritsParent: true,
          };
          addRubyParameterNames(
            source.slice(parameterStart + 1, parameterEnd),
            scope.locals,
          );
          scopes.push(scope);
          braceFrames.push(scope);
          currentScope = scope;
          index = parameterEnd + 1;
          continue;
        }
      }
      braceFrames.push(undefined);
      index++;
      continue;
    }
    if (character === "}") {
      lineHasCode = true;
      const scope = braceFrames.pop();
      if (scope) {
        scope.end = index + 1;
        currentScope = scope.parent ?? root;
      }
      index++;
      continue;
    }
    if (/[a-z_]/i.test(character)) {
      let wordEnd = index + 1;
      while (/\w/.test(source[wordEnd] ?? "")) wordEnd++;
      const word = source.slice(index, wordEnd);
      const firstOnLine = !lineHasCode;
      let previous = index - 1;
      while (previous >= 0 && /[ \t]/.test(source[previous]!)) previous--;
      lineHasCode = true;

      if (word === "end") {
        const scope = endFrames.pop();
        if (scope) {
          scope.end = wordEnd;
          currentScope = scope.parent ?? root;
        }
        pendingLocalTargets = [];
        index = wordEnd;
        continue;
      }

      if (word === "def" || word === "class" || word === "module") {
        const scope: RubyLocalScope = {
          start: index,
          end: source.length,
          locals: new Set<string>(),
          parent: currentScope,
          inheritsParent: false,
        };
        if (word === "def") {
          addRubyDefinitionParameters(source, wordEnd, scope.locals);
        }
        scopes.push(scope);
        endFrames.push(scope);
        currentScope = scope;
        pendingLocalTargets = [];
        index = wordEnd;
        continue;
      }

      if (
        /^(?:begin|case|for|if|unless|until|while)$/.test(word) &&
        (
          firstOnLine ||
          /^(?:begin|case|for)$/.test(word) ||
          /[=([{,:;!&|?~+*%^<>-]/.test(source[previous] ?? "")
        )
      ) {
        endFrames.push(undefined);
        controlDoPending = /^(?:for|until|while)$/.test(word);
      } else if (word === "do") {
        if (controlDoPending) {
          controlDoPending = false;
          index = wordEnd;
          continue;
        }
        let parameterStart = wordEnd;
        while (/[ \t]/.test(source[parameterStart] ?? "")) parameterStart++;
        const parameterEnd = source[parameterStart] === "|"
          ? source.indexOf("|", parameterStart + 1)
          : -1;
        const scope: RubyLocalScope = {
          start: index,
          end: source.length,
          locals: new Set<string>(),
          parent: currentScope,
          inheritsParent: true,
        };
        if (parameterEnd !== -1) {
          addRubyParameterNames(
            source.slice(parameterStart + 1, parameterEnd),
            scope.locals,
          );
        }
        scopes.push(scope);
        endFrames.push(scope);
        currentScope = scope;
        if (parameterEnd !== -1) {
          index = parameterEnd + 1;
          continue;
        }
      }

      let assignmentStart = wordEnd;
      while (/[ \t]/.test(source[assignmentStart] ?? "")) assignmentStart++;
      const bareLocal =
        /^[a-z_]/.test(word) &&
        !/[\w.:@$]/.test(source[previous] ?? "");
      const assignment =
        /^(?:\|\|=|&&=|<<=|>>=|\*\*=|[+\-*/%&|^]=|=(?!=|>|~))/.test(
          source.slice(assignmentStart, assignmentStart + 3),
        );
      if (bareLocal && source[assignmentStart] === ",") {
        pendingLocalTargets.push(word);
      } else if (bareLocal && assignment) {
        for (const name of pendingLocalTargets) currentScope.locals.add(name);
        currentScope.locals.add(word);
        pendingLocalTargets = [];
      } else if (source[assignmentStart] !== ",") {
        pendingLocalTargets = [];
      }
      index = wordEnd;
      continue;
    }
    if (character === ";" || character === "\r" || character === "\n") {
      pendingLocalTargets = [];
      if (character === "\r" || character === "\n") {
        lineHasCode = false;
        controlDoPending = false;
      }
    } else if (!/[ \t]/.test(character)) {
      lineHasCode = true;
    }
    index++;
  }

  return scopes;
}

function indexRubyLexicalRanges(source: string): RubyLexicalRange[] {
  const ranges: RubyLexicalRange[] = [];
  const localScopes = indexRubyLocalScopes(source);
  const activeScopes = [localScopes[0]!];
  const previousLocalMaps: Array<Map<string, number> | undefined> = [undefined];
  let visibleLocals = new Map<string, number>();
  for (const name of localScopes[0]!.locals) visibleLocals.set(name, 1);
  let nextScopeOffset = 1;
  const blockComments: RubyLexicalRange[] = [];
  const blockCommentPattern =
    /^=begin\b(?:(?!^=begin\b|^=end\b)[\s\S])*^=end\b/gm;
  for (
    let match = blockCommentPattern.exec(source);
    match;
    match = blockCommentPattern.exec(source)
  ) {
    blockComments.push({
      start: match.index,
      end: blockCommentPattern.lastIndex,
      kind: "block-comment",
    });
  }

  let blockOffset = 0;
  for (let index = 0; index < source.length;) {
    while (
      activeScopes.length > 1 &&
      activeScopes[activeScopes.length - 1]!.end <= index
    ) {
      const scope = activeScopes.pop()!;
      const previousLocals = previousLocalMaps.pop();
      if (previousLocals) {
        visibleLocals = previousLocals;
      } else {
        for (const name of scope.locals) {
          const count = visibleLocals.get(name)! - 1;
          if (count === 0) visibleLocals.delete(name);
          else visibleLocals.set(name, count);
        }
      }
    }
    while (
      nextScopeOffset < localScopes.length &&
      localScopes[nextScopeOffset]!.start <= index
    ) {
      const scope = localScopes[nextScopeOffset++]!;
      if (scope.end > index) {
        activeScopes.push(scope);
        if (scope.inheritsParent) {
          previousLocalMaps.push(undefined);
          for (const name of scope.locals) {
            visibleLocals.set(name, (visibleLocals.get(name) ?? 0) + 1);
          }
        } else {
          previousLocalMaps.push(visibleLocals);
          visibleLocals = new Map<string, number>();
          for (const name of scope.locals) visibleLocals.set(name, 1);
        }
      }
    }
    while (
      blockOffset < blockComments.length &&
      blockComments[blockOffset]!.start < index
    ) {
      blockOffset++;
    }
    const blockComment = blockComments[blockOffset];
    if (blockComment?.start === index) {
      ranges.push(blockComment);
      index = blockComment.end;
      blockOffset++;
      continue;
    }

    const character = source[index]!;
    if (character === "\\") {
      index += 2;
      continue;
    }
    if (character === "#") {
      const newline = source.indexOf("\n", index + 1);
      const lineEnd = newline === -1 ? source.length : newline;
      const end = lineEnd > index && source[lineEnd - 1] === "\r"
        ? lineEnd - 1
        : lineEnd;
      ranges.push({ start: index, end, kind: "line-comment" });
      index = lineEnd;
      continue;
    }
    if (/[a-z_]/i.test(character)) {
      let wordEnd = index + 1;
      while (/\w/.test(source[wordEnd] ?? "")) wordEnd++;
      index = wordEnd;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      const end = skipRubyDelimited(
        source,
        index + 1,
        source.length,
        character,
        character,
      );
      if (end !== undefined) {
        ranges.push({
          start: index,
          end,
          kind: character === "`" ? "command" : "quoted",
        });
        index = end;
        continue;
      }
    }
    if (character === "%") {
      const delimiter = getRubyPercentDelimiter(source, index);
      const end = delimiter && skipRubyDelimited(
        source,
        delimiter.contentStart,
        source.length,
        delimiter.open,
        delimiter.close,
      );
      if (delimiter) {
        const rangeEnd = end ?? source.length;
        ranges.push({ start: index, end: rangeEnd, kind: "percent" });
        index = rangeEnd;
        continue;
      }
    }
    if (character === "/" && canStartRubyRegex(source, index, visibleLocals)) {
      const end = findRubyRegexEnd(source, index);
      if (end !== undefined) {
        ranges.push({ start: index, end, kind: "regex" });
        index = end;
        continue;
      }
    }
    index++;
  }
  return ranges;
}

let rubyLexicalRangeCache:
  | { source: string; ranges: RubyLexicalRange[] }
  | undefined;
let rubyLexicalRangeCacheClearScheduled = false;

function getRubyLexicalRanges(source: string): RubyLexicalRange[] {
  if (rubyLexicalRangeCache?.source === source) {
    return rubyLexicalRangeCache.ranges;
  }
  const ranges = indexRubyLexicalRanges(source);
  rubyLexicalRangeCache = { source, ranges };
  if (!rubyLexicalRangeCacheClearScheduled) {
    rubyLexicalRangeCacheClearScheduled = true;
    queueMicrotask(() => {
      rubyLexicalRangeCache = undefined;
      rubyLexicalRangeCacheClearScheduled = false;
    });
  }
  return ranges;
}

function* matchRubyPercentStrings(source: string): Iterable<TokenPatternMatch> {
  for (const range of getRubyLexicalRanges(source)) {
    if (range.kind !== "percent") continue;
    yield { index: range.start, text: source.slice(range.start, range.end) };
  }
}

function* matchRubyCommandStrings(source: string): Iterable<TokenPatternMatch> {
  for (const range of getRubyLexicalRanges(source)) {
    if (range.kind !== "command") continue;
    yield { index: range.start, text: source.slice(range.start, range.end) };
  }
}

function* matchRubyRegexes(source: string): Iterable<TokenPatternMatch> {
  for (const range of getRubyLexicalRanges(source)) {
    if (range.kind !== "regex") continue;
    yield { index: range.start, text: source.slice(range.start, range.end) };
  }
}

function* matchRubyLineComments(source: string): Iterable<TokenPatternMatch> {
  for (const range of getRubyLexicalRanges(source)) {
    if (range.kind !== "line-comment") continue;
    yield { index: range.start, text: source.slice(range.start, range.end) };
  }
}

function* matchRubyHeredocs(source: string): Iterable<TokenPatternMatch> {
  const excludedRanges = getRubyLexicalRanges(source);
  const plainClosers = new Map<string, Array<{ start: number; end: number }>>();
  const indentedClosers = new Map<
    string,
    Array<{ start: number; end: number }>
  >();
  let lineStart = 0;
  while (lineStart <= source.length) {
    const newline = source.indexOf("\n", lineStart);
    const lineEnd = newline === -1 ? source.length : newline;
    const contentEnd =
      lineEnd > lineStart && source[lineEnd - 1] === "\r"
        ? lineEnd - 1
        : lineEnd;
    const line = source.slice(lineStart, contentEnd);
    const end = newline === -1 ? source.length : newline + 1;
    addRubyCloser(plainClosers, line, { start: lineStart, end });
    addRubyCloser(indentedClosers, line, { start: lineStart, end });
    const indentedDelimiter = /^[^\S\r\n]+([\s\S]*)$/.exec(line)?.[1];
    if (indentedDelimiter !== undefined) {
      addRubyCloser(indentedClosers, indentedDelimiter, {
        start: lineStart,
        end,
      });
    }
    if (newline === -1) break;
    lineStart = newline + 1;
  }

  const openerGroups = new Map<
    number,
    Array<{
      index: number;
      bodyStart: number;
      delimiter: string;
      allowIndent: boolean;
    }>
  >();
  let excludedOffset = 0;
  let currentLineStart = 0;
  let currentLineEnd = source.indexOf("\n");
  const openerPattern =
    /(?<!<)<<([-~]?)(?:(["'`])((?:\\[\s\S]|(?!\2)[^\r\n])*)\2|([A-Za-z_]\w*))/g;
  for (
    let opener = openerPattern.exec(source);
    opener;
    opener = openerPattern.exec(source)
  ) {
    while (
      excludedOffset < excludedRanges.length &&
      excludedRanges[excludedOffset]!.end <= opener.index
    ) {
      excludedOffset++;
    }
    const exclusion = excludedRanges[excludedOffset];
    if (
      exclusion &&
      exclusion.start <= opener.index &&
      opener.index < exclusion.end
    ) {
      continue;
    }
    while (currentLineEnd !== -1 && currentLineEnd < opener.index) {
      currentLineStart = currentLineEnd + 1;
      currentLineEnd = source.indexOf("\n", currentLineStart);
    }
    if (currentLineEnd === -1) continue;
    const group = openerGroups.get(currentLineStart) ?? [];
    group.push({
      index: opener.index,
      bodyStart: currentLineEnd + 1,
      delimiter: opener[3] ?? opener[4]!,
      allowIndent: opener[1] === "-" || opener[1] === "~",
    });
    openerGroups.set(currentLineStart, group);
  }

  let consumedUntil = 0;
  for (const [commandLineStart, openers] of openerGroups) {
    if (commandLineStart < consumedUntil) continue;
    let bodyStart = openers[0]!.bodyStart;
    let firstIndex: number | undefined;
    let end: number | undefined;
    for (const opener of openers) {
      const positions = (
        opener.allowIndent ? indentedClosers : plainClosers
      ).get(opener.delimiter) ?? [];
      const closer = positions[lowerBoundRubyCloser(positions, bodyStart)];
      if (!closer) {
        if (!/^[A-Z_][A-Z\d_]*$/.test(opener.delimiter)) continue;
        firstIndex ??= opener.index;
        end = source.length;
        bodyStart = source.length;
        break;
      }
      firstIndex ??= opener.index;
      end = closer.end;
      bodyStart = closer.end;
    }
    if (firstIndex === undefined || end === undefined) continue;
    yield { index: firstIndex, text: source.slice(firstIndex, end) };
    consumedUntil = end;
  }
}

function addRubyCloser(
  closers: Map<string, Array<{ start: number; end: number }>>,
  delimiter: string,
  closer: { start: number; end: number },
): void {
  const positions = closers.get(delimiter) ?? [];
  positions.push(closer);
  closers.set(delimiter, positions);
}

function lowerBoundRubyCloser(
  positions: Array<{ start: number; end: number }>,
  minimumStart: number,
): number {
  let low = 0;
  let high = positions.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (positions[middle]!.start < minimumStart) low = middle + 1;
    else high = middle;
  }
  return low;
}

export const ruby: Grammar = {
  name: "ruby",
  aliases: ["rb"],
  tokens: {
    comment: [
      {
        pattern: /^=begin\b(?:(?!^=begin\b|^=end\b)[\s\S])*^=end\b/m,
        greedy: true,
      },
      {
        pattern: /#.*/,
        matcher: matchRubyLineComments,
        greedy: true,
      },
    ],
    "triple-string": {
      pattern: /(?<!<)<<[-~]?(?:["'`][^\r\n]*["'`]|[A-Za-z_]\w*)/,
      matcher: matchRubyHeredocs,
      greedy: true,
      alias: "string",
    },
    string: [
      {
        pattern: /`/,
        matcher: matchRubyCommandStrings,
        greedy: true,
        alias: "string",
      },
      {
        pattern: /%[qQwWiIxsr]?[^\w\s]/,
        matcher: matchRubyPercentStrings,
        greedy: true,
        alias: "string",
      },
      {
        pattern: /(["'])(?:\\[\s\S]|(?!\1)[^\\])*\1/,
        greedy: true,
        inside: {
          interpolation: {
            pattern: /#\{[^{}\r\n]*\}/,
            inside: {
              punctuation: /^#\{|\}$/,
            },
          },
        },
      },
    ],
    regex: {
      pattern: /\/(?:[^/\\]|\\.)*\/[eimnosux]*/,
      matcher: matchRubyRegexes,
      greedy: true,
    },
    symbol: {
      pattern: /:\w+[!?]?|\b\w+[!?]?:/,
      alias: "property",
    },
    "class-name": {
      pattern: /(\b(?:class|module)\s+)[\w:]+/,
      lookbehind: true,
    },
    boolean: /\b(?:true|false|nil)\b/,
    keyword:
      /\b(?:alias|and|begin|break|case|class|def|defined\?|do|else|elsif|end|ensure|extend|for|if|in|include|module|new|next|nil|not|or|prepend|private|protected|public|raise|redo|require|require_relative|rescue|retry|return|self|super|then|throw|undef|unless|until|when|while|yield)\b/,
    builtin:
      /\b(?:Array|Complex|Float|Hash|Integer|Numeric|Object|Rational|String|Symbol|puts|gets|print|p|pp|sprintf|format|warn|raise|fail|exit|abort|at_exit|lambda|proc|loop|catch|throw|freeze|frozen\?|respond_to\?|send|tap|then|yield_self|itself|dup|clone|class|is_a\?|kind_of\?|instance_of\?|nil\?|empty\?|equal\?)\b/,
    number:
      /\b(?:0[xX][\da-fA-F]+(?:_[\da-fA-F]+)*|0[bB][01]+(?:_[01]+)*|0[oO]?[0-7]+(?:_[0-7]+)*|\d+(?:_\d+)*(?:\.\d+(?:_\d+)*)?(?:[eE][+-]?\d+(?:_\d+)*)?(?:r|i|ri)?)\b/,
    constant: /\b[A-Z]\w*\b/,
    function: {
      pattern: /(\bdef\s+)\w+[!?]?/,
      lookbehind: true,
    },
    variable: /[@$]\w+|@@\w+/,
    operator:
      /\.{2,3}|&\.|<=>|[!=]=?=?|[-+*/%<>&|^!~]=?|=>|<<|>>/,
    punctuation: /[{}[\]();,.:]/,
  },
};
