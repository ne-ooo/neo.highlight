import type {
  Grammar,
  TokenPattern,
  TokenPatternMatch,
} from "../core/types";
import { createNonNestingDelimitedPattern } from "../core/grammar-utils";

const MAX_CLASSIFIED_RAW_INTERPOLATION_DOLLARS = 8;
const MIN_CLASSIFIED_RAW_STRING_QUOTES = 3;
const MAX_CLASSIFIED_RAW_STRING_QUOTES = 8;
const END_OF_INPUT = "[\\s\\S]*(?![\\s\\S])";

function createRawStringBody(quoteCount: number): string {
  const quotes = '"'.repeat(quoteCount);
  return `(?:${quotes}${quotes}(?!")|${quotes}(?!")(?:[\\s\\S]*?(?<!")${quotes}(?!")|${END_OF_INPUT}))`;
}

interface RawStringQuoteRun {
  quoteStart: number;
  quoteEnd: number;
  dollarStart: number;
  dollarCount: number;
  quoteCount: number;
}

interface SourceRange {
  start: number;
  end: number;
  kind:
    | "doc"
    | "line"
    | "block"
    | "quoted"
    | "interpolated"
    | "interpolated-verbatim";
}

interface CSharpStringStart {
  tokenStart: number;
  verbatim: boolean;
  interpolated: boolean;
  kind: "quoted" | "interpolated" | "interpolated-verbatim";
}

function getCSharpStringStart(
  source: string,
  quoteStart: number,
): CSharpStringStart {
  if (source[quoteStart - 1] === "@") {
    const interpolated = source[quoteStart - 2] === "$";
    return {
      tokenStart: quoteStart - (interpolated ? 2 : 1),
      verbatim: true,
      interpolated,
      kind: interpolated ? "interpolated-verbatim" : "quoted",
    };
  }
  if (source[quoteStart - 1] === "$") {
    const verbatim = source[quoteStart - 2] === "@";
    return {
      tokenStart: quoteStart - (verbatim ? 2 : 1),
      verbatim,
      interpolated: true,
      kind: verbatim ? "interpolated-verbatim" : "interpolated",
    };
  }
  return {
    tokenStart: quoteStart,
    verbatim: false,
    interpolated: false,
    kind: "quoted",
  };
}

function indexCSharpRawStringExclusions(
  source: string,
  runs: RawStringQuoteRun[],
  nextEqualRun: Array<number | undefined>,
): SourceRange[] {
  const ranges: SourceRange[] = [];
  const runIndexByStart = new Map(
    runs.map((run, index) => [run.quoteStart, index]),
  );
  let index = 0;
  while (index < source.length) {
    if (source.startsWith("//", index)) {
      const newline = source.indexOf("\n", index + 2);
      const end = newline === -1 ? source.length : newline;
      ranges.push({
        start: index,
        end,
        kind: source.startsWith("///", index) ? "doc" : "line",
      });
      index = end;
      continue;
    }
    if (source.startsWith("/*", index)) {
      const closer = source.indexOf("*/", index + 2);
      const end = closer === -1 ? source.length : closer + 2;
      ranges.push({ start: index, end, kind: "block" });
      index = end;
      continue;
    }

    if (source[index] === "'") {
      const end = findCSharpCharacterEnd(source, index);
      if (end !== undefined) {
        ranges.push({ start: index, end, kind: "quoted" });
        index = end;
        continue;
      }
    }
    if (source[index] !== '"') {
      index++;
      continue;
    }

    const runIndex = runIndexByStart.get(index);
    const run = runIndex === undefined ? undefined : runs[runIndex];
    if (run && run.quoteCount >= MIN_CLASSIFIED_RAW_STRING_QUOTES) {
      const closingRunIndex = nextEqualRun[runIndex!];
      if (closingRunIndex !== undefined) {
        index = runs[closingRunIndex]!.quoteEnd;
      } else if (
        run.quoteCount >= MIN_CLASSIFIED_RAW_STRING_QUOTES * 2 &&
        run.quoteCount % 2 === 0
      ) {
        index = run.quoteEnd;
      } else {
        index = source.length;
      }
      continue;
    }

    const stringStart = getCSharpStringStart(source, index);
    const end = findCSharpStringEnd(
      source,
      index,
      stringStart.verbatim,
      stringStart.interpolated,
    );
    if (end !== undefined) {
      ranges.push({
        start: stringStart.tokenStart,
        end,
        kind: stringStart.kind,
      });
      index = end;
      continue;
    }
    index++;
  }
  return ranges;
}

function* matchCSharpComments(
  source: string,
  kind: "doc" | "line" | "block",
): Iterable<TokenPatternMatch> {
  const { runs, nextEqualRun } = indexRawStringQuoteRuns(source);
  for (
    const range of indexCSharpRawStringExclusions(source, runs, nextEqualRun)
  ) {
    if (range.kind !== kind) continue;
    yield {
      index: range.start,
      text: source.slice(range.start, range.end),
    };
  }
}

function* matchCSharpInterpolatedStrings(
  source: string,
  kind: "interpolated" | "interpolated-verbatim",
): Iterable<TokenPatternMatch> {
  const { runs, nextEqualRun } = indexRawStringQuoteRuns(source);
  for (
    const range of indexCSharpRawStringExclusions(source, runs, nextEqualRun)
  ) {
    if (range.kind !== kind) continue;
    yield { index: range.start, text: source.slice(range.start, range.end) };
  }
}

function findCSharpCharacterEnd(
  source: string,
  start: number,
): number | undefined {
  const contentEnd = source[start + 1] === "\\" ? start + 3 : start + 2;
  const content = source[contentEnd - 1];
  return content !== "\r" && content !== "\n" && source[contentEnd] === "'"
    ? contentEnd + 1
    : undefined;
}

function findCSharpStringEnd(
  source: string,
  start: number,
  verbatim: boolean,
  interpolated: boolean,
  nestingDepth = 0,
): number | undefined {
  if (nestingDepth > 64) return undefined;
  let index = start + 1;
  let interpolationDepth = 0;
  while (index < source.length) {
    if (interpolationDepth > 0) {
      if (source.startsWith("//", index)) {
        const newline = source.indexOf("\n", index + 2);
        index = newline === -1 ? source.length : newline + 1;
        continue;
      }
      if (source.startsWith("/*", index)) {
        const close = source.indexOf("*/", index + 2);
        index = close === -1 ? source.length : close + 2;
        continue;
      }
      if (source[index] === "'") {
        const characterEnd = findCSharpCharacterEnd(source, index);
        if (characterEnd !== undefined) {
          index = characterEnd;
          continue;
        }
      }
      if (source[index] === '"') {
        const quoteEnd = findCSharpNestedStringEnd(
          source,
          index,
          nestingDepth + 1,
        );
        if (quoteEnd !== undefined) {
          index = quoteEnd;
          continue;
        }
      }
      if (source[index] === "{") {
        interpolationDepth++;
      } else if (source[index] === "}") {
        interpolationDepth--;
      }
      index++;
      continue;
    }

    if (interpolated && source[index] === "{") {
      if (source[index + 1] === "{") {
        index += 2;
      } else {
        interpolationDepth = 1;
        index++;
      }
      continue;
    }
    if (
      interpolated &&
      source[index] === "}" &&
      source[index + 1] === "}"
    ) {
      index += 2;
      continue;
    }
    if (verbatim && source[index] === '"' && source[index + 1] === '"') {
      index += 2;
      continue;
    }
    if (!verbatim && source[index] === "\\") {
      index += 2;
      continue;
    }
    if (source[index] === '"') return index + 1;
    if (!verbatim && (source[index] === "\r" || source[index] === "\n")) {
      return undefined;
    }
    index++;
  }
  return undefined;
}

function findCSharpNestedStringEnd(
  source: string,
  quoteStart: number,
  nestingDepth: number,
): number | undefined {
  let quoteEnd = quoteStart + 1;
  while (source[quoteEnd] === '"') quoteEnd++;
  const quoteCount = quoteEnd - quoteStart;
  if (quoteCount >= MIN_CLASSIFIED_RAW_STRING_QUOTES) {
    for (let searchIndex = quoteEnd; searchIndex < source.length;) {
      const nextQuote = source.indexOf('"', searchIndex);
      if (nextQuote === -1) break;
      let nextEnd = nextQuote + 1;
      while (source[nextEnd] === '"') nextEnd++;
      if (nextEnd - nextQuote === quoteCount) return nextEnd;
      searchIndex = nextEnd;
    }
    if (quoteCount >= MIN_CLASSIFIED_RAW_STRING_QUOTES * 2 && quoteCount % 2 === 0) {
      return quoteEnd;
    }
    return source.length;
  }

  const stringStart = getCSharpStringStart(source, quoteStart);
  return findCSharpStringEnd(
    source,
    quoteStart,
    stringStart.verbatim,
    stringStart.interpolated,
    nestingDepth,
  );
}

function indexRawStringQuoteRuns(source: string): {
  runs: RawStringQuoteRun[];
  nextEqualRun: Array<number | undefined>;
} {
  const runs: RawStringQuoteRun[] = [];
  let searchIndex = 0;
  while (searchIndex < source.length) {
    const quoteStart = source.indexOf('"', searchIndex);
    if (quoteStart === -1) break;

    let quoteEnd = quoteStart + 1;
    while (source[quoteEnd] === '"') quoteEnd++;
    let dollarStart = quoteStart;
    while (dollarStart > 0 && source[dollarStart - 1] === "$") {
      dollarStart--;
    }
    runs.push({
      quoteStart,
      quoteEnd,
      dollarStart,
      dollarCount: quoteStart - dollarStart,
      quoteCount: quoteEnd - quoteStart,
    });
    searchIndex = quoteEnd;
  }

  const nextEqualRun: Array<number | undefined> = new Array(runs.length);
  const nextIndexByQuoteCount = new Map<number, number>();
  for (let index = runs.length - 1; index >= 0; index--) {
    const run = runs[index]!;
    nextEqualRun[index] = nextIndexByQuoteCount.get(run.quoteCount);
    nextIndexByQuoteCount.set(run.quoteCount, index);
  }
  return { runs, nextEqualRun };
}

function* matchLargeRawStrings(
  source: string,
  interpolated: boolean,
): Iterable<TokenPatternMatch> {
  const { runs, nextEqualRun } = indexRawStringQuoteRuns(source);
  const excludedRanges = indexCSharpRawStringExclusions(
    source,
    runs,
    nextEqualRun,
  );
  let excludedOffset = 0;
  for (let runIndex = 0; runIndex < runs.length;) {
    const run = runs[runIndex]!;
    const start = interpolated ? run.dollarStart : run.quoteStart;
    while (
      excludedOffset < excludedRanges.length &&
      excludedRanges[excludedOffset]!.end <= start
    ) {
      excludedOffset++;
    }
    const exclusion = excludedRanges[excludedOffset];
    const isCandidate = interpolated
      ? run.dollarCount > 0
      : run.dollarCount === 0;
    const isLarge =
      run.dollarCount > MAX_CLASSIFIED_RAW_INTERPOLATION_DOLLARS ||
      run.quoteCount > MAX_CLASSIFIED_RAW_STRING_QUOTES;

    if (
      !isCandidate ||
      !isLarge ||
      run.quoteCount < MIN_CLASSIFIED_RAW_STRING_QUOTES ||
      (exclusion && exclusion.start <= start && start < exclusion.end)
    ) {
      runIndex++;
      continue;
    }

    const closingRunIndex = nextEqualRun[runIndex];
    let end =
      closingRunIndex === undefined
        ? undefined
        : runs[closingRunIndex]!.quoteEnd;

    // With no later exact closer, an even run is an empty raw string.
    if (
      end === undefined &&
      run.quoteCount >= MIN_CLASSIFIED_RAW_STRING_QUOTES * 2 &&
      run.quoteCount % 2 === 0
    ) {
      end = run.quoteEnd;
    }
    end ??= source.length;

    yield { index: start, text: source.slice(start, end) };
    runIndex++;
    while (
      runIndex < runs.length &&
      runs[runIndex]!.quoteStart < end
    ) {
      runIndex++;
    }
  }
}

function createInterpolatedRawStringPattern(
  dollarCount: number,
  quoteCount: number,
): TokenPattern {
  const dollars = "\\$".repeat(dollarCount);
  const braces = "\\{".repeat(dollarCount);
  const closingBraces = "\\}".repeat(dollarCount);

  return {
    pattern: new RegExp(
      `(^|[^$])${dollars}${createRawStringBody(quoteCount)}`,
    ),
    lookbehind: true,
    greedy: true,
    alias: ["raw-string", "interpolated-string"],
    inside: {
      interpolation: {
        pattern: new RegExp(
          `(^|[^{])${braces}[^{}\\r\\n]*${closingBraces}(?!})`,
        ),
        lookbehind: true,
        inside: {
          punctuation: new RegExp(
            `^${braces}|${closingBraces}$`,
          ),
        },
      },
    },
  };
}

const interpolatedRawStrings: TokenPattern[] = [
  {
    pattern: /\$+"{3,}/,
    matcher: (source) => matchLargeRawStrings(source, true),
    greedy: true,
    alias: ["raw-string", "interpolated-string"],
  },
  ...Array.from(
    { length: MAX_CLASSIFIED_RAW_INTERPOLATION_DOLLARS },
    (_, dollarIndex) =>
      Array.from(
        {
          length:
            MAX_CLASSIFIED_RAW_STRING_QUOTES -
            MIN_CLASSIFIED_RAW_STRING_QUOTES +
            1,
        },
        (_, quoteIndex) =>
          createInterpolatedRawStringPattern(
            MAX_CLASSIFIED_RAW_INTERPOLATION_DOLLARS - dollarIndex,
            MAX_CLASSIFIED_RAW_STRING_QUOTES - quoteIndex,
          ),
      ),
  ).flat(),
];

const rawStrings: TokenPattern[] = [
  {
    pattern: /"{9,}/,
    matcher: (source) => matchLargeRawStrings(source, false),
    greedy: true,
    alias: "raw-string",
  },
  ...Array.from(
    {
      length:
        MAX_CLASSIFIED_RAW_STRING_QUOTES -
        MIN_CLASSIFIED_RAW_STRING_QUOTES +
        1,
    },
    (_, index): TokenPattern => ({
      pattern: new RegExp(
        `(^|[^$\"])${createRawStringBody(
          MAX_CLASSIFIED_RAW_STRING_QUOTES - index,
        )}`,
      ),
      lookbehind: true,
      greedy: true,
      alias: "raw-string",
    }),
  ),
];

export const csharp: Grammar = {
  name: "csharp",
  aliases: ["cs", "c#", "dotnet"],
  tokens: {
    comment: [
      {
        pattern: /\/\/\/.*$/m,
        matcher: (source) => matchCSharpComments(source, "doc"),
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
      {
        pattern: /\/\/.*/,
        matcher: (source) => matchCSharpComments(source, "line"),
        greedy: true,
      },
      {
        pattern: createNonNestingDelimitedPattern("/*", "*/"),
        matcher: (source) => matchCSharpComments(source, "block"),
        greedy: true,
      },
    ],
    string: [
      ...interpolatedRawStrings,
      ...rawStrings,
      {
        pattern: /(?:\$@|@\$)"(?:""|[^"])*"/,
        matcher: (source) =>
          matchCSharpInterpolatedStrings(source, "interpolated-verbatim"),
        greedy: true,
        alias: "interpolated-string",
        inside: {
          interpolation: {
            pattern: /\{[^{}\r\n]*\}/,
            inside: {
              punctuation: /^\{|\}$/,
            },
          },
        },
      },
      {
        pattern: /@"(?:""|[^"])*"/,
        greedy: true,
        alias: "verbatim-string",
      },
      {
        pattern: /(?<!@)\$"(?!"")(?:\\[\s\S]|[^\\"\r\n])*"/,
        matcher: (source) =>
          matchCSharpInterpolatedStrings(source, "interpolated"),
        greedy: true,
        alias: "interpolated-string",
        inside: {
          interpolation: {
            pattern: /\{[^{}\r\n]*\}/,
            inside: {
              punctuation: /^\{|\}$/,
            },
          },
        },
      },
      {
        pattern: /(?<![@$\\])"(?:\\[\s\S]|[^\\"\r\n])*"/,
        greedy: true,
      },
    ],
    char: {
      pattern: /'(?:\\[\s\S]|[^\\'\r\n])'/,
      greedy: true,
      alias: "string",
    },
    attribute: {
      pattern: /\[(?:(?!\[|\])[\s\S])*\]/,
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
      pattern: /\b\w+<(?:[^<>]|<[^<>]*>)*>/,
      inside: {
        "class-name": /^\w+/,
        punctuation: /[<>,]/,
        keyword: /\b(?:in|out)\b/,
      },
    },
  },
};
