/* -------------------------------------------------------------------------------------------------
 * Tokenizer — Regex-based syntax tokenizer (modernized Prism algorithm)
 *
 * Key differences from Prism.js:
 * - No global state or mutation
 * - Immutable grammar objects
 * - Pure function: tokenize(code, grammar) → Token[]
 * - TypeScript-first with full type safety
 * -----------------------------------------------------------------------------------------------*/

import type {
  Grammar,
  GrammarTokens,
  Token,
  TokenDefinition,
  TokenNode,
  TokenPattern,
  TokenizeOptions,
} from "./types";

export const DEFAULT_MAX_INPUT_LENGTH = 1_000_000;

const globalPatternCache = new WeakMap<RegExp, RegExp>();
const compiledGrammarCache = new WeakMap<
  GrammarTokens,
  Array<{ tokenType: string; patterns: TokenPattern[] }>
>();

/**
 * Tokenize source code using a grammar definition.
 *
 * @param code - The source code to tokenize
 * @param grammar - The grammar definition to use
 * @returns Array of tokens (strings for unmatched text, TokenNode for matched tokens)
 */
export function tokenize(
  code: string,
  grammar: Grammar,
  options: TokenizeOptions = {},
): Token[] {
  const maxInputLength = options.maxInputLength ?? DEFAULT_MAX_INPUT_LENGTH;
  if (
    maxInputLength !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(maxInputLength) || maxInputLength < 0)
  ) {
    throw new RangeError("maxInputLength must be a non-negative integer or Infinity");
  }
  if (code.length > maxInputLength) {
    throw new RangeError(
      `Input length ${code.length} exceeds maxInputLength ${maxInputLength}`,
    );
  }

  const tokens: Token[] = [code];
  matchGrammar(tokens, grammar.tokens, 0);
  return tokens;
}

/**
 * Normalize a token definition into an array of TokenPattern objects.
 */
function normalizeDefinition(definition: TokenDefinition): TokenPattern[] {
  if (definition instanceof RegExp) {
    return [{ pattern: definition }];
  }
  if (Array.isArray(definition)) {
    return definition.map((d) =>
      d instanceof RegExp ? { pattern: d } : d,
    );
  }
  return [definition];
}

function compileGrammarTokens(
  grammarTokens: GrammarTokens,
): Array<{ tokenType: string; patterns: TokenPattern[] }> {
  const cached = compiledGrammarCache.get(grammarTokens);
  if (cached) return cached;

  const compiled: Array<{ tokenType: string; patterns: TokenPattern[] }> = [];
  for (const tokenType of Object.keys(grammarTokens)) {
    const definition = grammarTokens[tokenType];
    if (definition !== undefined) {
      compiled.push({ tokenType, patterns: normalizeDefinition(definition) });
    }
  }
  compiledGrammarCache.set(grammarTokens, compiled);
  return compiled;
}

/**
 * Ensure a regex has the global flag, preserving other flags.
 */
function ensureGlobal(pattern: RegExp): RegExp {
  const cached = globalPatternCache.get(pattern);
  if (cached) return cached;

  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : pattern.flags + "g";
  const compiled = new RegExp(pattern.source, flags);
  globalPatternCache.set(pattern, compiled);
  return compiled;
}

/**
 * Apply grammar tokens while preserving the original source positions.
 *
 * Every pattern runs against the complete source text. Non-greedy matches can
 * replace only a single unmatched string segment. Greedy matches can span
 * tokens created by earlier rules, but they cannot replace a match contained
 * entirely within one earlier token. This preserves higher-priority comments
 * while allowing compound constructs such as JSX tags, CSS URLs, and C++ raw
 * strings to be recognized after their inner punctuation/string tokens.
 */
function matchGrammar(
  tokens: Token[],
  grammarTokens: GrammarTokens,
  depth: number,
): void {
  if (depth > 100) {
    throw new RangeError("Grammar nesting exceeds the supported depth");
  }

  for (const { tokenType, patterns } of compileGrammarTokens(grammarTokens)) {
    for (const patternObj of patterns) {
      const regex = ensureGlobal(patternObj.pattern);
      applyPattern(tokens, regex, patternObj, tokenType, depth);
    }
  }
}

interface SourceMatch {
  start: number;
  end: number;
  text: string;
}

interface TokenSpan {
  token: Token;
  start: number;
  end: number;
}

function applyPattern(
  tokens: Token[],
  regex: RegExp,
  patternObj: TokenPattern,
  tokenType: string,
  depth: number,
): void {
  const source = tokens.map(getTokenText).join("");
  const matches: SourceMatch[] = [];
  regex.lastIndex = 0;
  for (let match = regex.exec(source); match; match = regex.exec(source)) {
    const fullText = match[0];
    if (fullText.length === 0) {
      regex.lastIndex += 1;
      continue;
    }

    const lookbehindLength =
      patternObj.lookbehind && match[1] !== undefined ? match[1].length : 0;
    const text = fullText.slice(lookbehindLength);
    if (text.length === 0) continue;

    const start = match.index + lookbehindLength;
    matches.push({ start, end: start + text.length, text });
  }

  if (matches.length === 0) return;

  const spans: TokenSpan[] = [];
  let sourceOffset = 0;
  for (const token of tokens) {
    const end = sourceOffset + getTokenLength(token);
    spans.push({ token, start: sourceOffset, end });
    sourceOffset = end;
  }

  const accepted: SourceMatch[] = [];
  let spanIndex = 0;

  for (const match of matches) {
    while (spanIndex < spans.length && spans[spanIndex]!.end <= match.start) {
      spanIndex++;
    }
    if (spanIndex >= spans.length) break;

    const firstIndex = spanIndex;
    let lastIndex = firstIndex;
    while (spans[lastIndex]!.end < match.end && lastIndex + 1 < spans.length) {
      lastIndex++;
    }
    if (spans[lastIndex]!.end < match.end) continue;

    const containedInOneToken = firstIndex === lastIndex;
    const startsInPlainText = typeof spans[firstIndex]!.token === "string";
    const canReplace = patternObj.greedy
      ? startsInPlainText || !containedInOneToken
      : containedInOneToken && startsInPlainText;
    if (canReplace) accepted.push(match);
  }

  if (accepted.length === 0) return;

  const output: Token[] = [];
  let emitOffset = 0;
  let emitSpanIndex = 0;

  for (const match of accepted) {
    emitOriginalRange(
      spans,
      emitOffset,
      match.start,
      output,
      emitSpanIndex,
    );

    let content: string | Token[] = match.text;
    if (patternObj.inside) {
      const innerTokens: Token[] = [match.text];
      matchGrammar(innerTokens, patternObj.inside, depth + 1);
      content = innerTokens;
    }

    const tokenNode: TokenNode = {
      type: tokenType,
      content,
      length: match.text.length,
    };
    if (patternObj.alias) tokenNode.alias = patternObj.alias;

    appendToken(output, tokenNode);
    emitOffset = match.end;
    while (
      emitSpanIndex < spans.length &&
      spans[emitSpanIndex]!.end <= emitOffset
    ) {
      emitSpanIndex++;
    }
  }

  emitOriginalRange(
    spans,
    emitOffset,
    source.length,
    output,
    emitSpanIndex,
  );
  tokens.length = 0;
  for (const token of output) tokens.push(token);
}

function emitOriginalRange(
  spans: TokenSpan[],
  from: number,
  to: number,
  output: Token[],
  startSpanIndex: number,
): void {
  if (from >= to) return;

  let index = startSpanIndex;
  while (index < spans.length && spans[index]!.end <= from) index++;

  while (index < spans.length) {
    const span = spans[index]!;
    if (span.start >= to) break;

    const pieceStart = Math.max(from, span.start);
    const pieceEnd = Math.min(to, span.end);
    if (pieceStart < pieceEnd) {
      if (pieceStart === span.start && pieceEnd === span.end) {
        appendToken(output, span.token);
      } else {
        const text = getTokenText(span.token).slice(
          pieceStart - span.start,
          pieceEnd - span.start,
        );
        appendToken(output, text);
      }
    }

    if (span.end >= to) break;
    index++;
  }
}

function appendToken(tokens: Token[], token: Token): void {
  if (token === "") return;
  const previous = tokens[tokens.length - 1];
  if (typeof previous === "string" && typeof token === "string") {
    tokens[tokens.length - 1] = previous + token;
  } else {
    tokens.push(token);
  }
}

function getTokenLength(token: Token): number {
  return typeof token === "string" ? token.length : token.length;
}

/**
 * Extract the raw text content from a token (recursively for nested tokens).
 */
function getTokenText(token: Token): string {
  if (typeof token === "string") return token;
  if (typeof token.content === "string") return token.content;
  return token.content.map(getTokenText).join("");
}

/**
 * Get the plain text from an array of tokens.
 */
export function getPlainText(tokens: Token[]): string {
  return tokens.map(getTokenText).join("");
}

/**
 * Create a grammar registry from an array of grammars.
 */
export function createRegistry(grammars: Grammar[]): Map<string, Grammar> {
  const registry = new Map<string, Grammar>();
  for (const grammar of grammars) {
    registry.set(grammar.name, grammar);
    if (grammar.aliases) {
      for (const alias of grammar.aliases) {
        registry.set(alias, grammar);
      }
    }
  }
  return registry;
}
