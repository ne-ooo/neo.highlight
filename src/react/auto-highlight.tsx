import { useEffect, useRef } from "react";
import type { Grammar, Theme } from "../core/types";
import { observe } from "../core/scanner";
import { useHighlightContext } from "./context";

export interface AutoHighlightProps {
  children: React.ReactNode;
  languages?: Grammar[];
  theme?: Theme | string;
  selector?: string;
  lineNumbers?: boolean;
  classPrefix?: string;
  className?: string;
  style?: React.CSSProperties;
  /** Auto-detect language when no language hint is found */
  autoDetect?: boolean;
  /** Maximum UTF-16 code units accepted by the tokenizer. */
  maxInputLength?: number;
  /** Maximum regex matches examined by the tokenizer. */
  maxMatchCount?: number;
  /** Maximum structured token nodes created or rendered. */
  maxTokenCount?: number;
  /** Maximum generated HTML length in UTF-16 code units. */
  maxRenderedLength?: number;
  /** Maximum source lines rendered. */
  maxLines?: number;
  /** Maximum grammar and token-tree nesting depth. */
  maxTokenDepth?: number;
  /** Called when one code block cannot be highlighted. */
  onError?: (error: unknown, element: Element) => void;
}

/**
 * Auto-scan component that highlights all `<code>` elements within its children.
 * Uses MutationObserver to watch for dynamically added content.
 *
 * Usage:
 * ```tsx
 * <AutoHighlight languages={[javascript, python]} theme="github-dark">
 *   <article dangerouslySetInnerHTML={{ __html: markdownHtml }} />
 * </AutoHighlight>
 * ```
 */
export function AutoHighlight({
  children,
  languages: languagesProp,
  theme: themeProp,
  selector = "pre code",
  lineNumbers: lineNumbersProp,
  classPrefix: classPrefixProp,
  className,
  style,
  autoDetect,
  maxInputLength,
  maxMatchCount,
  maxTokenCount,
  maxRenderedLength,
  maxLines,
  maxTokenDepth,
  onError,
}: AutoHighlightProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ctx = useHighlightContext();

  const languages = languagesProp ?? ctx.languages;
  const theme = themeProp ?? ctx.theme;
  const lineNumbers = lineNumbersProp ?? ctx.lineNumbers;
  const classPrefix = classPrefixProp ?? ctx.classPrefix;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || languages.length === 0) return;

    const cleanup = observe({
      selector,
      languages,
      theme,
      lineNumbers,
      container,
      classPrefix,
      observe: true,
      autoDetect,
      maxInputLength,
      maxMatchCount,
      maxTokenCount,
      maxRenderedLength,
      maxLines,
      maxTokenDepth,
      force: true,
      onError,
    });

    return cleanup;
  }, [
    selector,
    languages,
    theme,
    lineNumbers,
    classPrefix,
    autoDetect,
    maxInputLength,
    maxMatchCount,
    maxTokenCount,
    maxRenderedLength,
    maxLines,
    maxTokenDepth,
    onError,
  ]);

  return (
    <div ref={containerRef} className={className} style={style}>
      {children}
    </div>
  );
}
