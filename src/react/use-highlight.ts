import { useMemo } from "react";
import type { DiffHighlight, Grammar, RenderOptions, Token } from "../core/types";
import { tokenize } from "../core/tokenizer";
import { renderToHTML } from "../core/renderer";
import { useHighlightContext } from "./context";

export interface UseHighlightOptions {
  theme?: RenderOptions["theme"];
  lineNumbers?: boolean;
  highlightLines?: number[];
  /** Line diff highlighting (added/removed/modified lines) */
  diffHighlight?: DiffHighlight;
  classPrefix?: string;
  wrapCode?: boolean;
}

export interface UseHighlightResult {
  tokens: Token[];
  html: string;
}

/**
 * Hook for syntax highlighting.
 * Returns memoized tokens and HTML string.
 *
 * @param code - Source code to highlight
 * @param language - Grammar definition
 * @param options - Rendering options
 */
export function useHighlight(
  code: string,
  language: Grammar,
  options: UseHighlightOptions = {},
): UseHighlightResult {
  const ctx = useHighlightContext();

  const {
    theme = ctx.theme,
    lineNumbers = ctx.lineNumbers,
    highlightLines,
    diffHighlight,
    classPrefix = ctx.classPrefix,
    wrapCode = false,
  } = options;

  const tokens = useMemo(
    () => tokenize(code, language),
    [code, language],
  );

  const html = useMemo(
    () =>
      renderToHTML(tokens, {
        theme,
        lineNumbers,
        highlightLines,
        diffHighlight,
        language: language.name,
        classPrefix,
        wrapCode,
      }),
    [tokens, theme, lineNumbers, highlightLines, diffHighlight, language.name, classPrefix, wrapCode],
  );

  return { tokens, html };
}
