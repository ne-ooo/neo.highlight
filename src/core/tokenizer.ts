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
} from "./types";

/**
 * Tokenize source code using a grammar definition.
 *
 * @param code - The source code to tokenize
 * @param grammar - The grammar definition to use
 * @returns Array of tokens (strings for unmatched text, TokenNode for matched tokens)
 */
export function tokenize(code: string, grammar: Grammar): Token[] {
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

/**
 * Ensure a regex has the global flag, preserving other flags.
 */
function ensureGlobal(pattern: RegExp): RegExp {
  if (pattern.global) return pattern;
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : pattern.flags + "g";
  return new RegExp(pattern.source, flags);
}

/**
 * Apply grammar tokens to the token array, replacing string tokens with matched TokenNodes.
 */
function matchGrammar(
  tokens: Token[],
  grammarTokens: GrammarTokens,
  startIndex: number,
): void {
  for (const tokenType of Object.keys(grammarTokens)) {
    const definition = grammarTokens[tokenType];
    if (definition === undefined) continue;

    const patterns = normalizeDefinition(definition);

    for (const patternObj of patterns) {
      const regex = ensureGlobal(patternObj.pattern);

      for (let i = startIndex; i < tokens.length; i++) {
        const token = tokens[i];

        // Skip already-matched tokens
        if (typeof token !== "string") continue;

        regex.lastIndex = 0;
        const match = regex.exec(token);
        if (!match) continue;

        let matchStr = match[0];
        let matchIndex = match.index;

        // Handle lookbehind
        if (patternObj.lookbehind && match[1] !== undefined) {
          const lookbehindLength = match[1].length;
          matchIndex += lookbehindLength;
          matchStr = matchStr.slice(lookbehindLength);
        }

        if (matchStr.length === 0) continue;

        // Handle greedy matching
        if (patternObj.greedy) {
          const greedyResult = handleGreedy(
            tokens,
            i,
            regex,
            patternObj,
            tokenType,
          );
          if (greedyResult !== null) {
            i = greedyResult;
            continue;
          }
        }

        // Create the matched token
        let content: string | Token[] = matchStr;
        if (patternObj.inside) {
          const innerTokens: Token[] = [matchStr];
          matchGrammar(innerTokens, patternObj.inside, 0);
          content = innerTokens;
        }

        const tokenNode: TokenNode = {
          type: tokenType,
          content,
          length: matchStr.length,
        };

        if (patternObj.alias) {
          tokenNode.alias = patternObj.alias;
        }

        // Split the string token: before | matched | after
        const before = token.slice(0, matchIndex);
        const after = token.slice(matchIndex + matchStr.length);

        const newTokens: Token[] = [];
        if (before) newTokens.push(before);
        newTokens.push(tokenNode);
        if (after) newTokens.push(after);

        tokens.splice(i, 1, ...newTokens);

        // Adjust index to skip past the newly inserted matched token
        i += newTokens.indexOf(tokenNode);
      }
    }
  }
}

/**
 * Handle greedy token matching — looks at surrounding string context for a better match.
 * Returns the new index to continue from, or null if greedy matching didn't apply.
 */
function handleGreedy(
  tokens: Token[],
  currentIndex: number,
  regex: RegExp,
  patternObj: TokenPattern,
  tokenType: string,
): number | null {
  // Reconstruct the full string from adjacent string tokens and the current position
  let combinedStr = "";
  let startTokenIndex = currentIndex;
  let offset = 0;

  // Walk backwards to find contiguous string tokens
  for (let j = currentIndex; j >= 0; j--) {
    const t = tokens[j];
    if (typeof t !== "string") {
      if (j < currentIndex) break;
      return null; // Current token must be a string
    }
    combinedStr = t + combinedStr;
    startTokenIndex = j;
    offset += t.length;
  }

  // The offset for the current token within combinedStr
  offset = combinedStr.length - (tokens[currentIndex] as string).length;

  // Walk forward to find contiguous string tokens
  for (let j = currentIndex + 1; j < tokens.length; j++) {
    const t = tokens[j];
    if (typeof t !== "string") break;
    combinedStr += t;
  }

  // Try to match in the combined string
  regex.lastIndex = 0;
  const match = regex.exec(combinedStr);
  if (!match) return null;

  let matchStr = match[0];
  let matchIndex = match.index;

  if (patternObj.lookbehind && match[1] !== undefined) {
    const lookbehindLength = match[1].length;
    matchIndex += lookbehindLength;
    matchStr = matchStr.slice(lookbehindLength);
  }

  if (matchStr.length === 0) return null;

  // Find which tokens are affected by this match
  let pos = 0;
  let spliceStart = startTokenIndex;
  let spliceCount = 0;

  for (let j = startTokenIndex; j < tokens.length; j++) {
    const t = tokens[j]!;
    const len = typeof t === "string" ? t.length : t.length;
    if (pos + len > matchIndex && pos < matchIndex + matchStr.length) {
      if (spliceCount === 0) spliceStart = j;
      spliceCount++;
    }
    pos += len;
    if (pos >= matchIndex + matchStr.length) break;
  }

  // Only apply greedy match if the region contains the current token
  if (spliceStart > currentIndex || spliceStart + spliceCount <= currentIndex) {
    return null;
  }

  // Reconstruct the string that this splice covers
  let splicedStr = "";
  for (let j = spliceStart; j < spliceStart + spliceCount; j++) {
    const t = tokens[j]!;
    splicedStr += typeof t === "string" ? t : getTokenText(t);
  }

  // Calculate relative match position within the spliced region
  let relativeStart = 0;
  for (let j = startTokenIndex; j < spliceStart; j++) {
    const t = tokens[j]!;
    relativeStart += typeof t === "string" ? t.length : t.length;
  }
  const relMatchIndex = matchIndex - relativeStart;

  let content: string | Token[] = matchStr;
  if (patternObj.inside) {
    const innerTokens: Token[] = [matchStr];
    matchGrammar(innerTokens, patternObj.inside, 0);
    content = innerTokens;
  }

  const tokenNode: TokenNode = {
    type: tokenType,
    content,
    length: matchStr.length,
  };

  if (patternObj.alias) {
    tokenNode.alias = patternObj.alias;
  }

  const before = splicedStr.slice(0, relMatchIndex);
  const after = splicedStr.slice(relMatchIndex + matchStr.length);

  const newTokens: Token[] = [];
  if (before) newTokens.push(before);
  newTokens.push(tokenNode);
  if (after) newTokens.push(after);

  tokens.splice(spliceStart, spliceCount, ...newTokens);

  return spliceStart + newTokens.indexOf(tokenNode);
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
