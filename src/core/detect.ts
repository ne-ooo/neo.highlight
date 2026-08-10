/* -------------------------------------------------------------------------------------------------
 * Language Auto-Detection — Score-based language detection by tokenizing candidates
 *
 * Algorithm:
 * 1. Truncate input to first `maxLength` chars (default 2000) for performance
 * 2. For each candidate grammar, tokenize the code and calculate a base score:
 *    - Coverage ratio: matched text / total text (weight 0.3)
 *    - Token diversity: unique token types / expected types (weight 0.2)
 *    - Keyword density: keyword tokens / total tokens (weight 0.35)
 *    - High-value tokens: bonus for function, class-name, builtin (weight 0.15)
 * 3. Apply language-specific positive/negative evidence. Derived grammars must
 *    contain syntax that distinguishes them from their base grammar.
 * 4. Return the highest-scoring grammar above minScore threshold
 * 5. Cache results by the complete analyzed sample and grammar identities
 * -----------------------------------------------------------------------------------------------*/

import type { DetectOptions, DetectResult, Grammar, Token, TokenNode } from "./types";
import { tokenize } from "./tokenizer";

const DEFAULT_MAX_LENGTH = 2000;
const DEFAULT_MIN_SCORE = 0.15;
const CACHE_MAX_SIZE = 100;

type WeightedPattern = readonly [pattern: RegExp, weight: number];

interface DetectionProfile {
  positive: readonly WeightedPattern[];
  negative?: readonly WeightedPattern[];
  /** Derived/superset grammars must show one of these language-specific markers. */
  requiresAny?: readonly RegExp[];
}

/**
 * Language-specific evidence complements token coverage. Token coverage alone
 * rewards broad and derived grammars (for example C# for JavaScript or Astro
 * for plain HTML). These profiles reward syntax that is specific to a language
 * and penalize syntax that contradicts it.
 *
 * Superset grammars use `requiresAny`, which defines their relationship to the
 * base language: Astro, Vue, Svelte, Handlebars, JSX, TSX, TypeScript, SCSS,
 * Less, and Bash cannot outrank their base grammar without a distinguishing
 * marker.
 */
const LANGUAGE_PROFILES: Readonly<Record<string, DetectionProfile>> = {
  javascript: {
    positive: [
      [/\b(?:const|let|var)\b/, 0.12],
      [/(?:=>|\basync\s+function\b|\bconsole\.)/, 0.2],
      [/\b(?:new\s+Promise|require\s*\(|export\s+default)\b/, 0.16],
    ],
    negative: [[/\b(?:interface|namespace|enum)\b|:\s*(?:string|number|boolean)\b/, 0.24]],
  },
  typescript: {
    positive: [
      [/\b(?:interface|namespace|enum|implements)\b/, 0.28],
      [/\btype\s+\w+\s*=|:\s*(?:string|number|boolean|unknown|never)\b/, 0.24],
      [/\b(?:public|private|protected|readonly)\s+\w+/, 0.12],
    ],
    requiresAny: [
      /\b(?:interface|namespace|enum|implements)\b/,
      /\btype\s+\w+\s*=|:\s*(?:string|number|boolean|unknown|never)\b/,
    ],
  },
  jsx: {
    positive: [
      [/(?:className=|<>|<\/?[A-Z][\w.]*)/, 0.3],
      [/\b(?:const|function)\s+[A-Z]\w*|=>\s*</, 0.16],
    ],
    requiresAny: [/(?:className=|<>|<\/?[A-Z][\w.]*|=>\s*<)/],
  },
  tsx: {
    positive: [
      [/(?:React\.(?:FC|Component)|JSX\.|:\s*React\b)/, 0.32],
      [/\binterface\s+\w+Props\b|:\s*(?:string|number|boolean)\b/, 0.2],
      [/(?:className=|<>|<\/?[A-Z][\w.]*)/, 0.18],
    ],
    requiresAny: [
      /(?:React\.(?:FC|Component)|JSX\.|:\s*React\b)/,
      /\binterface\s+\w+Props\b|:\s*(?:string|number|boolean)\b/,
    ],
  },
  python: {
    positive: [
      [/^\s*(?:def|class)\s+\w+.*:\s*$/m, 0.28],
      [/^\s*(?:from\s+\S+\s+import|import\s+\S+)/m, 0.14],
      [/\b(?:elif|None|True|False|self|yield|lambda)\b/, 0.16],
    ],
    negative: [[/[{};]|\b(?:const|let|var)\b/, 0.16]],
  },
  ruby: {
    positive: [
      [/^\s*(?:def|class|module)\s+\w+/m, 0.18],
      [/\b(?:puts|require|attr_(?:reader|writer|accessor)|elsif|unless)\b/, 0.22],
      [/^\s*end\s*$/m, 0.14],
    ],
    negative: [[/\bdefmodule\b|\bIO\.|\|>/, 0.34]],
  },
  perl: {
    positive: [
      [/^\s*(?:use|my|our)\s+/m, 0.26],
      [/(?:[$@%]\w+|=~|\bsub\s+\w+)/, 0.2],
    ],
  },
  php: {
    positive: [[/<\?php|->\w+|\bnamespace\s+[\\\w]+/, 0.46], [/\$\w+/, 0.08]],
    requiresAny: [/<\?php|->\w+|\bnamespace\s+[\\\w]+/],
  },
  go: {
    positive: [
      [/^\s*package\s+\w+/m, 0.24],
      [/\bfunc\s+(?:\([^)]*\)\s*)?\w+\s*\(/, 0.22],
      [/(?:\:=|\bfmt\.|\bgo\s+\w+\()/, 0.18],
    ],
  },
  rust: {
    positive: [
      [/\bfn\s+\w+|\blet\s+mut\b|\bimpl\b/, 0.24],
      [/(?:\w+!\s*\(|::|&(?:mut\s+)?str\b)/, 0.2],
      [/\b(?:Option|Result|Vec)<|->\s*(?:Self|Result|Option)/, 0.14],
    ],
  },
  java: {
    positive: [
      [/\bpublic\s+static\s+void\s+main\b/, 0.34],
      [/\bSystem\.(?:out|err)\.|\bimplements\s+\w+/, 0.2],
      [/\b(?:public|private|protected)\s+class\s+\w+/, 0.14],
    ],
  },
  kotlin: {
    positive: [
      [/\bfun\s+\w+\s*\(|\b(?:val|var)\s+\w+/, 0.28],
      [/\b(?:data\s+class|when\s*\(|println\s*\()/, 0.2],
      [/(?:\?\.|!!|\bobject\s+\w+)/, 0.12],
    ],
    negative: [[/Array\[String\]|:\s*Unit\b/, 0.28]],
  },
  swift: {
    positive: [
      [/\bfunc\s+\w+\s*\([^)]*\)\s*(?:async\s*)?(?:throws\s*)?->/, 0.3],
      [/\b(?:guard|defer|protocol|extension)\b/, 0.18],
      [/\b(?:let|var)\s+\w+\s*:\s*[A-Z]\w*/, 0.12],
    ],
  },
  dart: {
    positive: [
      [/\bvoid\s+main\s*\(|\bFuture<|\bStream</, 0.28],
      [/^\s*import\s+['"]package:/m, 0.26],
      [/\b(?:final|late)\s+\w+|\bprint\s*\(/, 0.12],
    ],
  },
  c: {
    positive: [
      [/#include\s*<stdio\.h>|\bprintf\s*\(/, 0.28],
      [/\btypedef\s+struct\b|\b(?:malloc|free)\s*\(/, 0.2],
    ],
    negative: [[/\bstd::|#import|@interface|\bConsole\./, 0.32]],
  },
  cpp: {
    positive: [
      [/(?:#include\s*<(?:iostream|vector|string)>|\bstd::)/, 0.34],
      [/\b(?:template|constexpr|namespace)\s*</, 0.16],
      [/(?:\bcout\s*<<|\bunique_ptr<)/, 0.18],
    ],
  },
  csharp: {
    positive: [
      [/^\s*using\s+System(?:\.|;)/m, 0.28],
      [/\b(?:Console\.(?:WriteLine|ReadLine)|public\s+static\s+void\s+Main)\b/, 0.28],
      [/\b(?:namespace|delegate|record)\s+\w+/, 0.14],
    ],
  },
  objectivec: {
    positive: [[/#import\s*<|@(?:interface|implementation|protocol|property)|\bNSObject\b/, 0.5]],
  },
  scala: {
    positive: [
      [/\bobject\s+\w+\s*\{|\bdef\s+\w+\s*\(/, 0.24],
      [/(?:Array\[String\]|:\s*Unit\b|\bcase\s+class\b)/, 0.32],
      [/\b(?:val|var)\s+\w+\s*=/, 0.1],
    ],
  },
  r: {
    positive: [[/(?:\s<-\s|\bfunction\s*\(|\blibrary\s*\(|\bdata\.frame\s*\()/, 0.42]],
  },
  lua: {
    positive: [
      [/\blocal\s+function\b|\bfunction\s+\w+[.:]?\w*\s*\(/, 0.3],
      [/\b(?:then|elseif|nil|pairs|ipairs)\b/, 0.18],
    ],
  },
  elixir: {
    positive: [
      [/\bdefmodule\s+[A-Z]\w*\s+do\b|\bdefp?\s+\w+.*\s+do\b/, 0.34],
      [/(?:\bIO\.|#\{|\|>)/, 0.18],
    ],
  },
  erlang: {
    positive: [[/^-module\s*\(|^-export\s*\(|\bio:format/m, 0.5]],
    requiresAny: [/^-module\s*\(|^-export\s*\(|\bio:format/m],
  },
  clojure: {
    positive: [[/\((?:ns|defn|defmacro|let|println)\b|#\{|\bnil\?\b/, 0.44]],
  },
  haskell: {
    positive: [
      [/^\s*module\s+\S+\s+where\b/m, 0.3],
      [/^\s*\w+\s*::\s*/m, 0.22],
      [/\b(?:putStrLn|IO\s+\(\)|data\s+\w+\s*=)\b/, 0.14],
    ],
  },
  ocaml: {
    positive: [[/\blet\s+(?:rec\s+)?\w+\s*=|\bmatch\s+.+\s+with\b|\bPrintf\.|\s->\s/, 0.38]],
  },
  bash: {
    positive: [[/^\s*#!.*\/bash\b|\[\[\s|\b(?:BASH_SOURCE|shopt|mapfile)\b|\bset\s+-[a-z]*o\s+pipefail/m, 0.5]],
    requiresAny: [/^\s*#!.*\/bash\b/m, /\[\[\s|\b(?:BASH_SOURCE|shopt|mapfile)\b/],
  },
  shell: {
    positive: [[/^\s*#!.*\/(?:sh|dash|ash)\b|\b(?:case\s+.+\s+in|esac)\b/m, 0.42]],
    negative: [[/^\s*#!.*\/bash\b|\[\[/m, 0.24]],
  },
  powershell: {
    positive: [[/(?:\$\w+\s*=|\b(?:Write|Get|Set|New|Remove)-[A-Z]\w+|\$_\.|\s-(?:eq|gt|lt|like)\s)/, 0.4]],
  },
  html: {
    positive: [[/(?:<!DOCTYPE\s+html|<html\b|<body\b|<head\b)/i, 0.34]],
    negative: [[/(?:^---\s*$|v-(?:if|for|model)\b|\{\{[#/>^]|\{#(?:if|each)|className=)/m, 0.28]],
  },
  astro: {
    positive: [[/^---\s*$[\s\S]*?^---\s*$/m, 0.48]],
    requiresAny: [/^---\s*$[\s\S]*?^---\s*$/m],
  },
  vue: {
    positive: [[/(?:<template\b|v-(?:if|for|model|bind|on)\b|[@:][\w-]+\s*=|\{\{[^}]+\}\})/, 0.38]],
    requiresAny: [/(?:<template\b|v-(?:if|for|model|bind|on)\b|[@:][\w-]+\s*=)/],
  },
  svelte: {
    positive: [[/(?:\{#(?:if|each|await|key)\b|\{@html\b|\bon:\w+\s*=|\bbind:\w+\s*=)/, 0.44]],
    requiresAny: [/(?:\{#(?:if|each|await|key)\b|\{@html\b|\bon:\w+\s*=|\bbind:\w+\s*=)/],
  },
  handlebars: {
    positive: [[/\{\{(?:[#/>!^]|else\b)[\s\S]*?\}\}/, 0.44]],
    requiresAny: [/\{\{(?:[#/>!^]|else\b)[\s\S]*?\}\}/],
  },
  css: {
    positive: [[/(?:^|[}\s;])(?:--[\w-]+|[a-z-]+)\s*:\s*[^;{}]+;|@media\b/i, 0.3]],
    negative: [[/(?:\$[\w-]+\s*:|@[\w-]+\s*:|#\{|\{\{)/, 0.28]],
  },
  scss: {
    positive: [[/(?:\$[\w-]+\s*:|@(?:mixin|include|extend|use)\b|#\{|&(?:[:.]|\[|\s*\{))/, 0.44]],
    requiresAny: [/(?:\$[\w-]+\s*:|@(?:mixin|include|extend|use)\b|#\{)/],
  },
  less: {
    positive: [[/(?:@[\w-]+\s*:|\.[\w-]+\s*\([^)]*\)\s*\{|&\s*:\w+)/, 0.42]],
    requiresAny: [/(?:@[\w-]+\s*:|\.[\w-]+\s*\([^)]*\)\s*\{)/],
  },
  json: {
    positive: [[/^\s*[{[]\s*(?:"(?:[^"\\]|\\.)*"\s*:|[\]}"])/, 0.36], [/"[^"\n]+"\s*:/, 0.16]],
    negative: [[/;|\b(?:const|let|function)\b/, 0.26]],
  },
  yaml: {
    positive: [[/^---\s*$|^\s*[\w.-]+:\s+(?:[^{}\n]|$)|^\s*-\s+\w+/m, 0.32]],
    negative: [[/[{};]|^\s*\[[\w.-]+\]\s*$/m, 0.22]],
  },
  toml: {
    positive: [[/^\s*\[\[?[\w.-]+\]\]?\s*$|^\s*[\w.-]+\s*=\s*(?:"|\[|\d{4}-\d{2}-\d{2})/m, 0.34]],
    negative: [[/^\s*;|^[\w.-]+\s*:\s/m, 0.2]],
  },
  ini: {
    positive: [[/^\s*\[[^\]]+\]\s*$|^\s*[\w.-]+\s*=\s*[^\n]+$/m, 0.24], [/^\s*;.*$/m, 0.16]],
    negative: [[/^\s*\[\[/m, 0.22]],
  },
  csv: {
    positive: [[/^(?:[^,\n]+,){2,}[^,\n]+\r?\n(?:[^,\n]+,){2,}[^,\n]+/m, 0.42]],
    requiresAny: [/^(?:[^,\n]+,){2,}[^,\n]+\r?\n(?:[^,\n]+,){2,}[^,\n]+/m],
  },
  markdown: {
    positive: [[/^(?:#{1,6}\s+|```\w*\s*$|>\s+|[-*+]\s+)|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*/m, 0.38]],
  },
  graphql: {
    positive: [[/\b(?:type\s+(?:Query|Mutation|Subscription)|query\s+\w+|mutation\s+\w+|schema\s*\{|[A-Z]\w*!)\b/, 0.4]],
  },
  sql: {
    positive: [[/\bSELECT\b[\s\S]+\bFROM\b|\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|CREATE\s+TABLE)\b/i, 0.42]],
  },
  docker: {
    positive: [[/^\s*(?:FROM|RUN|COPY|ADD|CMD|ENTRYPOINT|WORKDIR|EXPOSE)\b/im, 0.42]],
  },
  diff: {
    positive: [[/^(?:diff --git |---\s+\S+\n\+\+\+\s+\S+|@@\s+-\d)/m, 0.48]],
  },
  regex: {
    positive: [[/^\s*\/(?:\\.|[^/\n])+\/[dgimsuvy]*\s*$/, 0.48]],
    requiresAny: [/^\s*\/(?:\\.|[^/\n])+\/[dgimsuvy]*\s*$/],
  },
  terraform: {
    positive: [[/\b(?:resource|data|provider|variable|module)\s+"[^"]+"(?:\s+"[^"]+")?\s*\{|\bvar\.\w+/, 0.46]],
  },
  prisma: {
    positive: [[/\b(?:model|datasource|generator|enum)\s+\w+\s*\{|@(?:id|default|relation|unique)\b/, 0.46]],
  },
  nix: {
    positive: [[/(?:<nixpkgs>|\bpkgs\.|\bbuiltins\.|\bmkShell\b|\bwith\s+import\b)/, 0.42]],
  },
  latex: {
    positive: [[/\\(?:documentclass|begin|end|section|textbf|frac)\b|\$[^$\n]+\$/, 0.44]],
    requiresAny: [/\\(?:documentclass|begin|end|section|textbf|frac)\b/],
  },
  solidity: {
    positive: [[/\bpragma\s+solidity\b|\bcontract\s+\w+\s*\{|\b(?:address|uint\d*|mapping)\b/, 0.48]],
  },
  wasm: {
    positive: [[/\(module\b|\(func\b|\b(?:local|get|set)\.[a-z]+\b|\b(?:i32|i64|f32|f64)\.(?:add|sub|load)\b/, 0.46]],
  },
  zig: {
    positive: [[/@import\s*\(|\bpub\s+fn\b|\bstd\.|\.\{\}/, 0.46]],
  },
};

/** High-value token types (excluding keyword, which is scored separately). */
const HIGH_VALUE_TYPES = new Set([
  "function",
  "class-name",
  "builtin",
  "decorator",
  "namespace",
]);

/** LRU cache: key → DetectResult | null */
const detectCache = new Map<string, DetectResult | null>();
const grammarIds = new WeakMap<Grammar, number>();
let nextGrammarId = 1;

/**
 * Clear the detection cache.
 */
export function clearDetectCache(): void {
  detectCache.clear();
}

/**
 * Score a tokenization result for how well a grammar matches the code.
 *
 * @param tokens - Tokenized output
 * @param codeLength - Length of the original code
 * @returns Score between 0 and 1
 */
export function scoreTokenization(tokens: Token[], codeLength: number): number {
  if (codeLength === 0) return 0;

  let matchedLength = 0;
  const tokenTypes = new Set<string>();
  let keywordCount = 0;
  let highValueCount = 0;
  let totalTokenNodes = 0;

  for (const token of tokens) {
    if (typeof token !== "string") matchedLength += token.length;
  }

  const walk = (tokenList: Token[]): void => {
    for (const token of tokenList) {
      if (typeof token === "string") continue;

      const node = token as TokenNode;
      totalTokenNodes++;
      tokenTypes.add(node.type);

      if (node.type === "keyword") {
        keywordCount++;
      } else if (HIGH_VALUE_TYPES.has(node.type)) {
        highValueCount++;
      }

      // Walk nested tokens
      if (Array.isArray(node.content)) {
        walk(node.content);
      }
    }
  };

  walk(tokens);

  if (totalTokenNodes === 0) return 0;

  // Coverage: how much of the code was matched by tokens (0–1)
  const coverage = Math.min(matchedLength / codeLength, 1);

  // Diversity: unique token types relative to a reasonable maximum (~8 is good)
  const diversity = Math.min(tokenTypes.size / 8, 1);

  // Keyword density: keywords are the most language-specific tokens
  const keywordDensity = Math.min(keywordCount / Math.max(totalTokenNodes, 1), 1);

  // High-value: function/class-name/builtin tokens (less specific than keywords but still valuable)
  const highValue = Math.min(highValueCount / Math.max(totalTokenNodes, 1), 1);

  // Weighted score — keywords get the most weight since they're most language-distinguishing
  return coverage * 0.3 + diversity * 0.2 + keywordDensity * 0.35 + highValue * 0.15;
}

/**
 * Detect the most likely language for a code snippet.
 *
 * @param code - Source code to analyze
 * @param grammars - Array of candidate grammars
 * @param options - Detection options
 * @returns DetectResult if a match is found above threshold, or undefined
 */
export function detectLanguage(
  code: string,
  grammars: Grammar[],
  options: DetectOptions = {},
): DetectResult | undefined {
  const {
    maxLength = DEFAULT_MAX_LENGTH,
    minScore = DEFAULT_MIN_SCORE,
    noCache = false,
  } = options;

  if (
    maxLength !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(maxLength) || maxLength < 0)
  ) {
    throw new RangeError("maxLength must be a non-negative integer or Infinity");
  }
  if (!Number.isFinite(minScore) || minScore < 0 || minScore > 1) {
    throw new RangeError("minScore must be between 0 and 1");
  }

  if (code.length === 0 || grammars.length === 0) return undefined;

  // Truncate for performance
  const sample = code.length > maxLength ? code.slice(0, maxLength) : code;

  // Cache lookup
  const cacheKey = createCacheKey(sample, grammars, maxLength, minScore);
  if (!noCache && detectCache.has(cacheKey)) {
    const cached = detectCache.get(cacheKey) ?? null;
    detectCache.delete(cacheKey);
    detectCache.set(cacheKey, cached);
    return cached ?? undefined;
  }

  // Score each grammar
  const candidates: Array<{ grammar: Grammar; score: number }> = [];

  for (const grammar of grammars) {
    const tokens = tokenize(sample, grammar, { maxInputLength: maxLength });
    const baseScore = scoreTokenization(tokens, sample.length);
    const score = scoreLanguageCandidate(grammar, sample, baseScore);
    candidates.push({ grammar, score });
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || best.score < minScore) {
    if (!noCache) {
      evictIfNeeded();
      detectCache.set(cacheKey, null);
    }
    return undefined;
  }

  const result: DetectResult = {
    grammar: best.grammar,
    score: best.score,
    candidates,
  };

  if (!noCache) {
    evictIfNeeded();
    detectCache.set(cacheKey, result);
  }

  return result;
}

function scoreLanguageCandidate(
  grammar: Grammar,
  sample: string,
  baseScore: number,
): number {
  const profile = LANGUAGE_PROFILES[grammar.name];
  if (!profile) return baseScore;

  let score = baseScore * 0.55;
  for (const [pattern, weight] of profile.positive) {
    if (pattern.test(sample)) score += weight;
  }
  for (const [pattern, weight] of profile.negative ?? []) {
    if (pattern.test(sample)) score -= weight;
  }

  if (
    profile.requiresAny &&
    !profile.requiresAny.some((pattern) => pattern.test(sample))
  ) {
    score *= 0.2;
  }

  return Math.min(Math.max(score, 0), 1);
}

function createCacheKey(
  sample: string,
  grammars: Grammar[],
  maxLength: number,
  minScore: number,
): string {
  const grammarKey = grammars
    .map((grammar) => {
      let id = grammarIds.get(grammar);
      if (id === undefined) {
        id = nextGrammarId++;
        grammarIds.set(grammar, id);
      }
      return id;
    })
    .join(",");

  return `${maxLength}:${minScore}:${grammarKey}:${sample}`;
}

/**
 * Evict oldest cache entry if cache is full.
 */
function evictIfNeeded(): void {
  if (detectCache.size >= CACHE_MAX_SIZE) {
    // Delete the first (oldest) entry
    const firstKey = detectCache.keys().next().value;
    if (firstKey !== undefined) {
      detectCache.delete(firstKey);
    }
  }
}
