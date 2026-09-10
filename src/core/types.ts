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
  /** Optional linear matcher for constructs that cannot be scanned safely by one regex. */
  matcher?: ((source: string, context?: TokenMatcherContext) => Iterable<TokenPatternMatch>) | undefined;
  /** If true, the pattern takes priority and prevents other tokens from matching inside it */
  greedy?: boolean;
  /** Optional lookbehind — if true, the first captured group is treated as lookbehind */
  lookbehind?: boolean;
  /** Optional alias for the token type */
  alias?: string | string[];
  /** Nested grammar to apply inside the matched content */
  inside?: GrammarTokens;
}

/** A source span returned by a custom token matcher. */
export interface TokenPatternMatch {
  /** Zero-based UTF-16 source offset. */
  index: number;
  /** Exact source text for the token. */
  text: string;
}

/** Read-only nesting budget for custom lexical scanners. */
export interface TokenMatcherContext {
  readonly depth: number;
  readonly maxTokenDepth: number;
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

/** Options controlling tokenizer resource usage. */
export interface TokenizeOptions {
  /** Maximum UTF-16 code units accepted per call (default: 250,000). */
  maxInputLength?: number | undefined;
  /** Maximum regex matches examined per call (default: 100,000). */
  maxMatchCount?: number | undefined;
  /** Maximum structured token nodes created per call (default: 100,000). */
  maxTokenCount?: number | undefined;
  /** Maximum nested grammar depth (default: 100). */
  maxTokenDepth?: number | undefined;
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

/** Additive attributes for a generated span, code, or pre element. */
export interface RenderAttributes {
  /** Classes are appended to the renderer's classes. */
  class?: string | readonly string[] | undefined;
  /** Only id, title, role, tabindex, data-*, and aria-* attributes are accepted. */
  attributes?: Readonly<Record<string, string | number | boolean | undefined>> | undefined;
}

export interface RenderHookContext {
  readonly source: string;
  readonly language: string | undefined;
  readonly classPrefix: string;
  readonly styleMode: "inline" | "class";
}

export interface TokenRenderContext extends RenderHookContext {
  readonly type: string;
  readonly aliases: readonly string[];
  readonly depth: number;
  /** Exact UTF-16 source bounds, independent of the token's length field. */
  readonly start: number;
  readonly end: number;
}

export interface LineRenderContext extends RenderHookContext {
  /** One-based source line. Highlights and diffs use this number. */
  readonly line: number;
  readonly displayLine: number;
  /** Source bounds exclude the line terminator. */
  readonly start: number;
  readonly end: number;
  readonly highlighted: boolean;
  readonly added: boolean;
  readonly removed: boolean;
  readonly modified: boolean;
}

/** Synchronous decorators. They add attributes without replacing source text or HTML. */
export interface RenderHooks {
  /** Runs once per structured token, after its children. Multiline spans retain these attributes on each line. */
  token?: ((context: TokenRenderContext) => RenderAttributes | void) | undefined;
  /** Requests line wrappers, including when wrapCode is false. */
  line?: ((context: LineRenderContext) => RenderAttributes | void) | undefined;
  /** Runs on the code wrapper when wrapCode is true. */
  code?: ((context: RenderHookContext) => RenderAttributes | void) | undefined;
  /** Runs on the pre wrapper when wrapCode is true. */
  pre?: ((context: RenderHookContext) => RenderAttributes | void) | undefined;
}

/**
 * Options for HTML rendering.
 */
/** Half-open bounds in the original source, counted in UTF-16 code units. */
export interface HighlightRange {
  readonly start: number;
  readonly end: number;
}

export interface RenderOptions {
  /** Theme to apply (object or name for registry lookup) */
  theme?: Theme | string | undefined;
  /** Inline styles (default), or classes with a separately supplied theme stylesheet. */
  styleMode?: "inline" | "class" | undefined;
  /** Show line numbers */
  lineNumbers?: boolean | undefined;
  /** First displayed line number (default: 1). Source line selection remains one-based. */
  startLine?: number | undefined;
  /** Structured token, line, and wrapper decorators. */
  hooks?: RenderHooks | undefined;
  /** Lines to highlight (1-indexed) */
  highlightLines?: number[] | undefined;
  /** Selected source spans. At most 256 ranges; overlaps and adjacent ranges merge. */
  highlightRanges?: readonly HighlightRange[] | undefined;
  /** Language name for the data attribute */
  language?: string | undefined;
  /** CSS class prefix (default: "neo-hl") */
  classPrefix?: string | undefined;
  /** Wrap in <pre><code> tags (default: true) */
  wrapCode?: boolean | undefined;
  /** Per-line spans. "source" retains line endings as text and omits the empty row after a final newline. Default: false. */
  wrapLines?: boolean | "source" | undefined;
  /** Line diff highlighting (added/removed/modified lines) */
  diffHighlight?: DiffHighlight | undefined;
  /** Maximum token nodes traversed while rendering (default: 100,000). */
  maxTokenCount?: number | undefined;
  /** Maximum generated HTML length in UTF-16 code units (default: 10,000,000). */
  maxRenderedLength?: number | undefined;
  /** Maximum source lines rendered (default: 10,000). */
  maxLines?: number | undefined;
  /** Maximum nested token-tree depth (default: 100). */
  maxTokenDepth?: number | undefined;
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
  /** Class output requires a theme stylesheet. observe() supplies it when a theme is set. */
  styleMode?: "inline" | "class" | undefined;
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
  /** Maximum UTF-16 code units accepted by the tokenizer. */
  maxInputLength?: number | undefined;
  /** Maximum regex matches examined by the tokenizer. */
  maxMatchCount?: number | undefined;
  /** Maximum token nodes created or rendered. */
  maxTokenCount?: number | undefined;
  /** Maximum generated HTML length in UTF-16 code units. */
  maxRenderedLength?: number | undefined;
  /** Maximum source lines rendered. */
  maxLines?: number | undefined;
  /** Maximum grammar and token-tree nesting depth. */
  maxTokenDepth?: number | undefined;
  /** Re-highlight matching elements even if they were highlighted before. */
  force?: boolean | undefined;
  /** Called when one element cannot be highlighted; remaining elements continue. */
  onError?: ((error: unknown, element: Element) => void) | undefined;
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
