/**
 * Grammar utility functions
 */

import type { Grammar } from "./types";

/** Normalize grammar names and aliases for registry lookup. */
export function normalizeGrammarIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

/** Build a bounded pattern for languages whose block comments can nest. */
export function createNestedCommentPattern(
  open: string,
  close: string,
  maxDepth = 4,
): RegExp {
  const openPattern = escapeRegExp(open);
  const closePattern = escapeRegExp(close);
  const plainCharacter = `(?!(?:${openPattern}|${closePattern}))[\\s\\S]`;
  let body = `(?:${plainCharacter})*`;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    body = `(?:${plainCharacter}|${openPattern}${body}${closePattern})*`;
  }
  return new RegExp(`${openPattern}${body}${closePattern}`);
}

/** Build a linear non-nesting delimiter pattern that includes an unfinished body. */
export function createNonNestingDelimitedPattern(
  open: string,
  close: string,
): RegExp {
  const openPattern = escapeRegExp(open);
  const closePattern = escapeRegExp(close);
  return new RegExp(
    `${openPattern}(?:[\\s\\S]*?${closePattern}|[\\s\\S]*(?![\\s\\S]))`,
  );
}

/** Build a bounded paired-delimiter pattern with backslash escapes. */
export function createBalancedDelimiterPattern(
  open: string,
  close: string,
  maxDepth = 4,
): RegExp {
  const openPattern = escapeRegExp(open);
  const closePattern = escapeRegExp(close);
  const escapedCharacter = String.raw`\\[\s\S]`;
  const plainCharacter = `(?!(?:\\\\|${openPattern}|${closePattern}))[\\s\\S]`;
  let body = `(?:${escapedCharacter}|${plainCharacter})*`;

  for (let depth = 0; depth < maxDepth; depth += 1) {
    body = `(?:${escapedCharacter}|${plainCharacter}|${openPattern}${body}${closePattern})*`;
  }
  return new RegExp(`${openPattern}${body}${closePattern}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolve a language string to a grammar by checking name and aliases.
 *
 * @param language - Language string (e.g., "js", "python", "ts")
 * @param grammars - Array of available grammars
 * @returns Matching grammar or null
 *
 * @example
 * ```typescript
 * import { resolveGrammar } from '@lpm.dev/neo.highlight'
 * import { javascript, typescript, python } from '@lpm.dev/neo.highlight/grammars'
 *
 * resolveGrammar('js', [javascript, typescript, python])
 * // Returns `javascript` grammar (matched via aliases: ["js", "mjs"])
 *
 * resolveGrammar('unknown', [javascript])
 * // Returns null
 * ```
 */
export function resolveGrammar(
  language: string,
  grammars: Grammar[],
): Grammar | null {
  const normalized = normalizeGrammarIdentifier(language);

  for (const grammar of grammars) {
    // Check name
    if (normalizeGrammarIdentifier(grammar.name) === normalized) {
      return grammar;
    }

    // Check aliases
    if (grammar.aliases) {
      for (const alias of grammar.aliases) {
        if (normalizeGrammarIdentifier(alias) === normalized) {
          return grammar;
        }
      }
    }
  }

  return null;
}
