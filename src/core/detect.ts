/* -------------------------------------------------------------------------------------------------
 * Language Auto-Detection — Score-based language detection by tokenizing candidates
 *
 * Algorithm:
 * 1. Truncate input to first `maxLength` chars (default 2000) for performance
 * 2. For each candidate grammar, tokenize the code and score the result:
 *    - Coverage ratio: matched text / total text (weight 0.3)
 *    - Token diversity: unique token types / expected types (weight 0.2)
 *    - Keyword density: keyword tokens / total tokens (weight 0.35)
 *    - High-value tokens: bonus for function, class-name, builtin (weight 0.15)
 * 3. Return the highest-scoring grammar above minScore threshold
 * 4. Cache results keyed on first 500 chars (LRU, max 100 entries)
 * -----------------------------------------------------------------------------------------------*/

import type { DetectOptions, DetectResult, Grammar, Token, TokenNode } from "./types";
import { tokenize } from "./tokenizer";

const DEFAULT_MAX_LENGTH = 2000;
const DEFAULT_MIN_SCORE = 0.15;
const CACHE_KEY_LENGTH = 500;
const CACHE_MAX_SIZE = 100;

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

  const walk = (tokenList: Token[]): void => {
    for (const token of tokenList) {
      if (typeof token === "string") continue;

      const node = token as TokenNode;
      totalTokenNodes++;
      matchedLength += node.length;
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

  if (code.length === 0 || grammars.length === 0) return undefined;

  // Truncate for performance
  const sample = code.length > maxLength ? code.slice(0, maxLength) : code;

  // Cache lookup
  const cacheKey = `${grammars.map((g) => g.name).join(",")}:${sample.slice(0, CACHE_KEY_LENGTH)}`;
  if (!noCache && detectCache.has(cacheKey)) {
    return detectCache.get(cacheKey) ?? undefined;
  }

  // Score each grammar
  const candidates: Array<{ grammar: Grammar; score: number }> = [];

  for (const grammar of grammars) {
    const tokens = tokenize(sample, grammar);
    const score = scoreTokenization(tokens, sample.length);
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
