/* -------------------------------------------------------------------------------------------------
 * Tokenizer — Regex-based syntax tokenizer (modernized Prism algorithm)
 *
 * Key differences from Prism.js:
 * - No global state or mutation
 * - Does not mutate grammar objects
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
import { normalizeGrammarIdentifier } from "./grammar-utils";

export const DEFAULT_MAX_INPUT_LENGTH = 250_000;
export const DEFAULT_MAX_MATCH_COUNT = 100_000;
export const DEFAULT_MAX_TOKEN_COUNT = 100_000;
export const DEFAULT_MAX_TOKEN_DEPTH = 100;

const globalPatternCache = new WeakMap<RegExp, RegExp>();

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
  const maxMatchCount = options.maxMatchCount ?? DEFAULT_MAX_MATCH_COUNT;
  const maxTokenCount = options.maxTokenCount ?? DEFAULT_MAX_TOKEN_COUNT;
  const maxTokenDepth = options.maxTokenDepth ?? DEFAULT_MAX_TOKEN_DEPTH;
  assertLimit(maxInputLength, "maxInputLength");
  assertLimit(maxMatchCount, "maxMatchCount");
  assertLimit(maxTokenCount, "maxTokenCount");
  assertLimit(maxTokenDepth, "maxTokenDepth");
  if (code.length > maxInputLength) {
    throw new RangeError(
      `Input length ${code.length} exceeds maxInputLength ${maxInputLength}`,
    );
  }

  const tokens: Token[] = [code];
  const context: TokenizeContext = {
    source: code,
    maxMatchCount,
    maxTokenCount,
    maxTokenDepth,
    matchCount: 0,
    tokenCount: 0,
  };
  matchGrammar(tokens, grammar.tokens, 0, context);
  return tokens;
}

interface TokenizeContext {
  readonly source: string;
  readonly maxMatchCount: number;
  readonly maxTokenCount: number;
  readonly maxTokenDepth: number;
  matchCount: number;
  tokenCount: number;
}

function assertLimit(value: number, name: string): void {
  if (
    value !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(value) || value < 0)
  ) {
    throw new RangeError(`${name} must be a non-negative integer or Infinity`);
  }
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
  const compiled: Array<{ tokenType: string; patterns: TokenPattern[] }> = [];
  for (const tokenType of Object.keys(grammarTokens)) {
    const definition = grammarTokens[tokenType];
    if (definition !== undefined) {
      compiled.push({ tokenType, patterns: normalizeDefinition(definition) });
    }
  }
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
  context: TokenizeContext,
): void {
  if (depth > context.maxTokenDepth) {
    throw new RangeError(
      `Grammar nesting exceeds maxTokenDepth ${context.maxTokenDepth}`,
    );
  }

  for (const { tokenType, patterns } of compileGrammarTokens(grammarTokens)) {
    for (const patternObj of patterns) {
      const regex = ensureGlobal(patternObj.pattern);
      applyPattern(
        tokens,
        context.source,
        regex,
        patternObj,
        tokenType,
        depth,
        context,
      );
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
  source: string,
  regex: RegExp,
  patternObj: TokenPattern,
  tokenType: string,
  depth: number,
  context: TokenizeContext,
): void {
  const spans: TokenSpan[] = [];
  let sourceOffset = 0;
  for (const token of tokens) {
    const end = sourceOffset + getTokenLength(token);
    spans.push({ token, start: sourceOffset, end });
    sourceOffset = end;
  }

  const output: Token[] = [];
  let emitOffset = 0;
  let emitSpanIndex = 0;
  let spanIndex = 0;
  let acceptedAny = false;

  regex.lastIndex = 0;
  for (
    let regexMatch = regex.exec(source);
    regexMatch;
    regexMatch = regex.exec(source)
  ) {
    const fullText = regexMatch[0];
    context.matchCount++;
    if (context.matchCount > context.maxMatchCount) {
      throw new RangeError(
        `Regex match count exceeds maxMatchCount ${context.maxMatchCount}`,
      );
    }
    if (fullText.length === 0) {
      const fullUnicode =
        regex.unicode ||
        (regex as RegExp & { readonly unicodeSets?: boolean }).unicodeSets === true;
      regex.lastIndex = advanceStringIndex(source, regexMatch.index, fullUnicode);
      continue;
    }

    const lookbehindLength =
      patternObj.lookbehind && regexMatch[1] !== undefined
        ? regexMatch[1].length
        : 0;
    const text = fullText.slice(lookbehindLength);
    if (text.length === 0) continue;

    const sourceMatch: SourceMatch = {
      start: regexMatch.index + lookbehindLength,
      end: regexMatch.index + fullText.length,
      text,
    };

    while (
      spanIndex < spans.length &&
      spans[spanIndex]!.end <= sourceMatch.start
    ) {
      spanIndex++;
    }
    if (spanIndex >= spans.length) break;

    const firstIndex = spanIndex;
    let lastIndex = firstIndex;
    while (spans[lastIndex]!.end < sourceMatch.end && lastIndex + 1 < spans.length) {
      lastIndex++;
    }
    if (spans[lastIndex]!.end < sourceMatch.end) continue;

    const containedInOneToken = firstIndex === lastIndex;
    const startsInPlainText = typeof spans[firstIndex]!.token === "string";
    const canReplace = patternObj.greedy
      ? startsInPlainText || !containedInOneToken
      : containedInOneToken && startsInPlainText;
    if (!canReplace) continue;

    acceptedAny = true;
    emitOriginalRange(
      spans,
      emitOffset,
      sourceMatch.start,
      output,
      emitSpanIndex,
    );

    let content: string | Token[] = sourceMatch.text;
    if (patternObj.inside) {
      const innerTokens: Token[] = [sourceMatch.text];
      const innerContext: TokenizeContext = {
        ...context,
        source: sourceMatch.text,
      };
      matchGrammar(innerTokens, patternObj.inside, depth + 1, innerContext);
      context.matchCount = innerContext.matchCount;
      context.tokenCount = innerContext.tokenCount;
      content = innerTokens;
    }

    appendMatchedToken(
      output,
      tokenType,
      content,
      sourceMatch.text.length,
      patternObj.alias,
      context,
    );
    emitOffset = sourceMatch.end;
    while (
      emitSpanIndex < spans.length &&
      spans[emitSpanIndex]!.end <= emitOffset
    ) {
      emitSpanIndex++;
    }
  }

  if (!acceptedAny) return;

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

function appendMatchedToken(
  tokens: Token[],
  type: string,
  content: string | Token[],
  length: number,
  alias: string | string[] | undefined,
  context: TokenizeContext,
): void {
  const previous = tokens[tokens.length - 1];
  if (
    typeof content === "string" &&
    typeof previous !== "string" &&
    previous !== undefined &&
    previous.type === type &&
    typeof previous.content === "string" &&
    aliasesEqual(previous.alias, alias)
  ) {
    previous.content += content;
    previous.length += length;
    return;
  }

  context.tokenCount++;
  if (context.tokenCount > context.maxTokenCount) {
    throw new RangeError(
      `Token count exceeds maxTokenCount ${context.maxTokenCount}`,
    );
  }

  const tokenNode: TokenNode = { type, content, length };
  if (alias) tokenNode.alias = alias;
  appendToken(tokens, tokenNode);
}

function aliasesEqual(
  left: string | string[] | undefined,
  right: string | string[] | undefined,
): boolean {
  if (left === right) return true;
  if (
    !Array.isArray(left) ||
    !Array.isArray(right) ||
    left.length !== right.length
  ) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function advanceStringIndex(
  source: string,
  index: number,
  unicode: boolean,
): number {
  if (!unicode || index + 1 >= source.length) return index + 1;

  const first = source.charCodeAt(index);
  if (first < 0xd800 || first > 0xdbff) return index + 1;

  const second = source.charCodeAt(index + 1);
  return second >= 0xdc00 && second <= 0xdfff ? index + 2 : index + 1;
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
export function getPlainText(
  tokens: Token[],
  options: Pick<TokenizeOptions, "maxTokenCount" | "maxTokenDepth"> = {},
): string {
  const maxTokenCount = options.maxTokenCount ?? DEFAULT_MAX_TOKEN_COUNT;
  const maxTokenDepth = options.maxTokenDepth ?? DEFAULT_MAX_TOKEN_DEPTH;
  assertLimit(maxTokenCount, "maxTokenCount");
  assertLimit(maxTokenDepth, "maxTokenDepth");

  const activeNodes = new Set<TokenNode>();
  let tokenCount = 0;
  const walk = (items: Token[], depth: number): string => {
    if (depth > maxTokenDepth) {
      throw new RangeError(
        `Token nesting exceeds maxTokenDepth ${maxTokenDepth}`,
      );
    }
    const text: string[] = [];
    for (const item of items) {
      if (typeof item === "string") {
        text.push(item);
        continue;
      }
      if (activeNodes.has(item)) {
        throw new TypeError("Token tree contains a cycle");
      }
      tokenCount++;
      if (tokenCount > maxTokenCount) {
        throw new RangeError(
          `Token count exceeds maxTokenCount ${maxTokenCount}`,
        );
      }
      if (typeof item.content === "string") {
        text.push(item.content);
      } else {
        activeNodes.add(item);
        text.push(walk(item.content, depth + 1));
        activeNodes.delete(item);
      }
    }
    return text.join("");
  };

  return walk(tokens, 0);
}

/**
 * Create a grammar registry from an array of grammars.
 */
export function createRegistry(grammars: Grammar[]): Map<string, Grammar> {
  const registry = new Map<string, Grammar>();
  for (const grammar of grammars) {
    registry.set(normalizeGrammarIdentifier(grammar.name), grammar);
    if (grammar.aliases) {
      for (const alias of grammar.aliases) {
        registry.set(normalizeGrammarIdentifier(alias), grammar);
      }
    }
  }
  return registry;
}
