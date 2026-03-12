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
}: HighlightProps) {
  const ctx = useHighlightContext();

  const theme = themeProp ?? ctx.theme;
  const lineNumbers = showLineNumbers ?? ctx.lineNumbers;
  const classPrefix = classPrefixProp ?? ctx.classPrefix;

  const html = useMemo(() => {
    const tokens = tokenize(children, language);
    return renderToHTML(tokens, {
      theme,
      lineNumbers,
      highlightLines,
      diffHighlight,
      language: language.name,
      classPrefix,
      wrapCode: true,
    });
  }, [children, language, theme, lineNumbers, highlightLines, diffHighlight, classPrefix]);

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
