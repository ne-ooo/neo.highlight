import type { Grammar, RenderOptions, Token } from "../core/types";
import { tokenize } from "../core/tokenizer";
import { renderToHTML } from "../core/renderer";

export interface HighlightOptions extends Omit<RenderOptions, "language"> {}

/**
 * Highlight source code and return an HTML string.
 *
 * @param code - Source code to highlight
 * @param language - Grammar definition
 * @param options - Rendering options
 * @returns HTML string with syntax highlighting
 */
export function highlight(
  code: string,
  language: Grammar,
  options: HighlightOptions = {},
): string {
  const tokens: Token[] = tokenize(code, language);
  return renderToHTML(tokens, {
    ...options,
    language: language.name,
  });
}
