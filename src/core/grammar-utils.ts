/**
 * Grammar utility functions
 */

import type { Grammar } from "./types";

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
  const lower = language.toLowerCase();

  for (const grammar of grammars) {
    // Check name
    if (grammar.name.toLowerCase() === lower) {
      return grammar;
    }

    // Check aliases
    if (grammar.aliases) {
      for (const alias of grammar.aliases) {
        if (alias.toLowerCase() === lower) {
          return grammar;
        }
      }
    }
  }

  return null;
}
