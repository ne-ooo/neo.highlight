/* -------------------------------------------------------------------------------------------------
 * Core Types for @lpm.dev/neo.highlight
 * -----------------------------------------------------------------------------------------------*/

/**
 * A single token produced by the tokenizer.
 * Can be a plain string (unmatched text) or a structured token with type info.
 */
export type Token = string | TokenNode;

export interface TokenNode {
  /** The token type (e.g., "keyword", "string", "comment") */
  type: string;
  /** The matched content — either a string or nested tokens */
  content: string | Token[];
  /** Optional alias for additional CSS classes */
  alias?: string | string[];
  /** Length of the original matched text */
  length: number;
}

/**
 * A single token pattern within a grammar definition.
 */
export interface TokenPattern {
  /** The regex pattern to match */
  pattern: RegExp;
  /** If true, the pattern takes priority and prevents other tokens from matching inside it */
  greedy?: boolean;
  /** Optional lookbehind — if true, the first captured group is treated as lookbehind */
  lookbehind?: boolean;
  /** Optional alias for the token type */
  alias?: string | string[];
  /** Nested grammar to apply inside the matched content */
  inside?: GrammarTokens;
}

/**
 * A token definition can be a single pattern, regex, or array of patterns.
 */
export type TokenDefinition = RegExp | TokenPattern | Array<RegExp | TokenPattern>;

/**
 * Grammar tokens — a map of token type names to their definitions.
 * Order matters: tokens are matched in the order they appear.
 */
export type GrammarTokens = {
  [tokenType: string]: TokenDefinition;
};

/**
 * A complete grammar definition for a language.
 */
export interface Grammar {
  /** Language name (e.g., "javascript") */
  name: string;
  /** Alternative names (e.g., ["js", "mjs"]) */
  aliases?: string[];
  /** Token definitions — order determines matching priority */
  tokens: GrammarTokens;
}

/**
 * Theme token color mapping.
 */
export interface ThemeTokenColors {
  comment?: string;
  keyword?: string;
  string?: string;
  number?: string;
  boolean?: string;
  function?: string;
  operator?: string;
  punctuation?: string;
  variable?: string;
  "class-name"?: string;
  constant?: string;
  property?: string;
  tag?: string;
  "attr-name"?: string;
  "attr-value"?: string;
  selector?: string;
  regex?: string;
  builtin?: string;
  important?: string;
  inserted?: string;
  deleted?: string;
  changed?: string;
  namespace?: string;
  parameter?: string;
  interpolation?: string;
  "template-string"?: string;
  decorator?: string;
  [tokenType: string]: string | undefined;
}

/**
 * A complete theme definition.
 */
export interface Theme {
  /** Theme name (e.g., "github-dark") */
  name: string;
  /** Base colors */
  background: string;
  foreground: string;
  /** Selection highlight color */
  selection?: string;
  /** Line number color */
  lineNumber?: string;
  /** Line number active/highlighted color */
  lineNumberActive?: string;
  /** Line highlight background */
  lineHighlight?: string;
  /** Token colors */
  tokenColors: ThemeTokenColors;
  /** Diff added line background */
  diffAddedBg?: string;
  /** Diff removed line background */
  diffRemovedBg?: string;
  /** Diff modified line background */
  diffModifiedBg?: string;
}

/**
 * Options for HTML rendering.
 */
export interface RenderOptions {
  /** Theme to apply (object or name for registry lookup) */
  theme?: Theme | string | undefined;
  /** Show line numbers */
  lineNumbers?: boolean | undefined;
  /** Lines to highlight (1-indexed) */
  highlightLines?: number[] | undefined;
  /** Language name for the data attribute */
  language?: string | undefined;
  /** CSS class prefix (default: "neo-hl") */
  classPrefix?: string | undefined;
  /** Wrap in <pre><code> tags (default: true) */
  wrapCode?: boolean | undefined;
  /** Line diff highlighting (added/removed/modified lines) */
  diffHighlight?: DiffHighlight | undefined;
}

/**
 * Line diff highlighting configuration.
 * Line numbers are 1-indexed.
 */
export interface DiffHighlight {
  /** Lines marked as added (green background) */
  added?: number[] | undefined;
  /** Lines marked as removed (red background) */
  removed?: number[] | undefined;
  /** Lines marked as modified (amber background) */
  modified?: number[] | undefined;
}

/**
 * Options for the auto-scan engine.
 */
export interface ScanOptions {
  /** CSS selector for code elements (default: "pre code") */
  selector?: string | undefined;
  /** Available grammars for highlighting */
  languages: Grammar[];
  /** Theme to apply */
  theme?: Theme | string | undefined;
  /** Show line numbers */
  lineNumbers?: boolean | undefined;
  /** Observe for dynamically added code blocks via MutationObserver */
  observe?: boolean | undefined;
  /** Container to scan (default: document.body) */
  container?: Element | undefined;
  /** CSS class prefix (default: "neo-hl") */
  classPrefix?: string | undefined;
  /** Auto-detect language when no language hint is found (default: false) */
  autoDetect?: boolean | undefined;
}

/**
 * Grammar registry — maps language names/aliases to grammar objects.
 */
export type GrammarRegistry = Map<string, Grammar>;

/**
 * Result of language auto-detection.
 */
export interface DetectResult {
  /** The detected grammar (highest scoring) */
  grammar: Grammar;
  /** Confidence score (0–1) */
  score: number;
  /** All candidates with scores, sorted descending */
  candidates: Array<{ grammar: Grammar; score: number }>;
}

/**
 * Options for language auto-detection.
 */
export interface DetectOptions {
  /** Maximum characters to analyze (default: 2000) */
  maxLength?: number | undefined;
  /** Minimum score threshold to return a result (default: 0.15) */
  minScore?: number | undefined;
  /** Disable caching (default: false) */
  noCache?: boolean | undefined;
}
