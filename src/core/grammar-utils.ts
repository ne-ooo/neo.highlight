/**
 * Grammar utility functions
 */

import type { Grammar } from "./types";

/** Normalize grammar names and aliases for registry lookup. */
export function normalizeGrammarIdentifier(value: string): string {
  return value.trim().toLowerCase();
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
