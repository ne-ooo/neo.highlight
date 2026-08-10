import { useMemo } from "react";
import type { DiffHighlight, Grammar, Theme } from "../core/types";
import { tokenize } from "../core/tokenizer";
import { renderToHTML } from "../core/renderer";
import { useHighlightContext } from "./context";
import { CopyButton } from "./copy-button";

export interface HighlightProps {
  children: string;
  language: Grammar;
  theme?: Theme | string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  /** Line diff highlighting (added/removed/modified lines) */
  diffHighlight?: DiffHighlight;
  /** Show a copy-to-clipboard button */
  copyButton?: boolean;
  /** Label for the copy button (default: "Copy") */
  copyButtonLabel?: string;
  /** Label shown after copying (default: "Copied!") */
  copyButtonCopiedLabel?: string;
  /** Callback fired after successful copy */
  onCopy?: (code: string) => void;
  classPrefix?: string;
  className?: string;
  style?: React.CSSProperties;
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
}

/**
 * Component-mode syntax highlighter.
 *
 * Usage:
 * ```tsx
 * <Highlight language={javascript} theme="github-dark">
 *   {`const x = 42;`}
 * </Highlight>
 * ```
 */
export function Highlight({
  children,
  language,
  theme: themeProp,
  showLineNumbers,
  highlightLines,
  diffHighlight,
  copyButton = false,
  copyButtonLabel,
  copyButtonCopiedLabel,
  onCopy,
  classPrefix: classPrefixProp,
  className,
  style,
  maxInputLength,
  maxMatchCount,
  maxTokenCount,
  maxRenderedLength,
  maxLines,
  maxTokenDepth,
}: HighlightProps) {
  const ctx = useHighlightContext();

  const theme = themeProp ?? ctx.theme;
  const lineNumbers = showLineNumbers ?? ctx.lineNumbers;
  const classPrefix = classPrefixProp ?? ctx.classPrefix;

  const tokens = useMemo(
    () => tokenize(children, language, {
      maxInputLength,
      maxMatchCount,
      maxTokenCount,
      maxTokenDepth,
    }),
    [
      children,
      language,
      maxInputLength,
      maxMatchCount,
      maxTokenCount,
      maxTokenDepth,
    ],
  );

  const html = useMemo(() => {
    return renderToHTML(tokens, {
      theme,
      lineNumbers,
      highlightLines,
      diffHighlight,
      language: language.name,
      classPrefix,
      wrapCode: true,
      maxTokenCount,
      maxRenderedLength,
      maxLines,
      maxTokenDepth,
    });
  }, [
    tokens,
    language,
    theme,
    lineNumbers,
    highlightLines,
    diffHighlight,
    classPrefix,
    maxTokenCount,
    maxRenderedLength,
    maxLines,
    maxTokenDepth,
  ]);

  if (copyButton) {
    return (
      <div className={className} style={{ ...style, position: "relative" }}>
        <CopyButton
          code={children}
          label={copyButtonLabel}
          copiedLabel={copyButtonCopiedLabel}
          classPrefix={classPrefix}
          onCopy={onCopy}
        />
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }

  return (
    <div
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
