import type { ScanOptions } from "../core/types";
import { scan, observe, autoHighlight as coreAutoHighlight } from "../core/scanner";

export { scan, observe };

export type { ScanOptions };

/**
 * Auto-highlight: scan the page for code blocks and optionally observe for new ones.
 *
 * @param options - Scan options
 * @returns Cleanup function to stop observing
 *
 * @example
 * ```ts
 * import { autoHighlight } from '@lpm.dev/neo.highlight/vanilla'
 * import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
 *
 * const cleanup = autoHighlight({
 *   languages: [javascript],
 *   theme: 'github-dark',
 *   observe: true,
 * })
 *
 * // Later: cleanup()
 * ```
 */
export function autoHighlight(options: ScanOptions): () => void {
  return coreAutoHighlight(options);
}
