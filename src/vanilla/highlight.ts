import type { Grammar, RenderOptions, Token, TokenizeOptions } from "../core/types";
import { tokenize } from "../core/tokenizer";
import { renderToHTML } from "../core/renderer";

export interface HighlightOptions extends Omit<RenderOptions, "language"> {
  /** Maximum UTF-16 code units accepted by the tokenizer. */
  maxInputLength?: TokenizeOptions["maxInputLength"];
}

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
  const { maxInputLength, ...renderOptions } = options;
  const tokens: Token[] = tokenize(code, language, { maxInputLength });
  return renderToHTML(tokens, {
    ...renderOptions,
    language: language.name,
  });
}
