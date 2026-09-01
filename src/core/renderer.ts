/* -------------------------------------------------------------------------------------------------
 * Renderer — Converts token arrays to HTML strings
 * -----------------------------------------------------------------------------------------------*/

import type { RenderOptions, Theme, Token, TokenNode } from "./types";
import {
  getThemeCSS,
  resolveThemeOrThrow,
  validateThemeForCSS,
} from "./themes";
import {
  assertSafeCssIdentifier,
  escapeHTML,
  escapeHTMLAttribute,
} from "./safety";
import {
  DEFAULT_MAX_TOKEN_COUNT,
  DEFAULT_MAX_TOKEN_DEPTH,
} from "./tokenizer";

const DEFAULT_CLASS_PREFIX = "neo-hl";
export const DEFAULT_MAX_RENDERED_LENGTH = 10_000_000;
export const DEFAULT_MAX_LINES = 10_000;

interface RenderContext {
  readonly maxRenderedLength: number;
  readonly maxLines: number;
  readonly maxTokenCount: number;
  readonly maxTokenDepth: number;
  readonly activeNodes: Set<TokenNode>;
  tokenCount: number;
  lineCount: number;
  previousWasCR: boolean;
}

/**
 * Render tokens to an HTML string.
 *
 * @param tokens - Array of tokens from the tokenizer
 * @param options - Rendering options (theme, line numbers, etc.)
 * @returns HTML string
 */
export function renderToHTML(tokens: Token[], options: RenderOptions = {}): string {
  const {
    theme,
    lineNumbers = false,
    highlightLines,
    language,
    classPrefix = DEFAULT_CLASS_PREFIX,
    wrapCode = true,
    wrapLines = false,
    diffHighlight,
    maxTokenCount = DEFAULT_MAX_TOKEN_COUNT,
    maxRenderedLength = DEFAULT_MAX_RENDERED_LENGTH,
    maxLines = DEFAULT_MAX_LINES,
    maxTokenDepth = DEFAULT_MAX_TOKEN_DEPTH,
  } = options;

  assertLimit(maxTokenCount, "maxTokenCount");
  assertLimit(maxRenderedLength, "maxRenderedLength");
  assertLimit(maxLines, "maxLines");
  assertLimit(maxTokenDepth, "maxTokenDepth");

  assertSafeCssIdentifier(classPrefix, "class prefix");
  const resolvedTheme = theme ? resolveThemeOrThrow(theme) : undefined;
  if (resolvedTheme) validateThemeForCSS(resolvedTheme, classPrefix);

  const renderContext: RenderContext = {
    maxRenderedLength,
    maxLines,
    maxTokenCount,
    maxTokenDepth,
    activeNodes: new Set<TokenNode>(),
    tokenCount: 0,
    lineCount: tokens.length === 0 ? 0 : 1,
    previousWasCR: false,
  };
  if (renderContext.lineCount > maxLines) {
    throw new RangeError(`Line count exceeds maxLines ${maxLines}`);
  }

  const renderedTokens: string[] = [];
  let codeHTMLLength = 0;
  for (const token of tokens) {
    const rendered = renderToken(
      token,
      classPrefix,
      resolvedTheme,
      renderContext,
      0,
    );
    codeHTMLLength += rendered.length;
    assertRenderedLength(codeHTMLLength, maxRenderedLength);
    renderedTokens.push(rendered);
  }
  const codeHTML = renderedTokens.join("");

  const highlightSet = highlightLines?.length ? new Set(highlightLines) : null;
  const hasDiffLines = Boolean(
    diffHighlight?.added?.length ||
      diffHighlight?.removed?.length ||
      diffHighlight?.modified?.length,
  );
  const needsLineWrapping = wrapLines || lineNumbers || Boolean(highlightSet) || hasDiffLines;

  if (!wrapCode && !needsLineWrapping) return codeHTML;

  // Build diff line sets
  const diffAdded = diffHighlight?.added ? new Set(diffHighlight.added) : null;
  const diffRemoved = diffHighlight?.removed ? new Set(diffHighlight.removed) : null;
  const diffModified = diffHighlight?.modified ? new Set(diffHighlight.modified) : null;

  let bodyHTML: string;

  if (needsLineWrapping) {
    // Split only when line markup is requested. This avoids an unnecessary
    // second pass for the default rendering path.
    const lines = splitHTMLIntoLines(codeHTML, maxLines);
    const renderedLines: string[] = [];
    let bodyLength = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const lineNum = i + 1;
      const isHighlighted = highlightSet?.has(lineNum) ?? false;

      // Build line classes
      const lineClasses = [`${classPrefix}-line`];
      if (isHighlighted) lineClasses.push(`${classPrefix}-line-highlighted`);
      if (diffAdded?.has(lineNum)) lineClasses.push(`${classPrefix}-diff-added`);
      if (diffRemoved?.has(lineNum)) lineClasses.push(`${classPrefix}-diff-removed`);
      if (diffModified?.has(lineNum)) lineClasses.push(`${classPrefix}-diff-modified`);

      const lineStyles = ["display: block"];
      const background = getLineBackground(
        resolvedTheme,
        isHighlighted,
        diffAdded?.has(lineNum) ?? false,
        diffRemoved?.has(lineNum) ?? false,
        diffModified?.has(lineNum) ?? false,
        classPrefix,
      );
      if (background) lineStyles.push(background);

      // Diff gutter marker
      let gutterSpan = "";
      if (diffAdded?.has(lineNum)) {
        gutterSpan = `<span class="${classPrefix}-diff-gutter" aria-hidden="true" style="display: inline-block; width: 1.5em; text-align: center; user-select: none">+</span>`;
      } else if (diffRemoved?.has(lineNum)) {
        gutterSpan = `<span class="${classPrefix}-diff-gutter" aria-hidden="true" style="display: inline-block; width: 1.5em; text-align: center; user-select: none">-</span>`;
      } else if (diffModified?.has(lineNum)) {
        gutterSpan = `<span class="${classPrefix}-diff-gutter" aria-hidden="true" style="display: inline-block; width: 1.5em; text-align: center; user-select: none">~</span>`;
      }

      const numberStyle = getLineNumberStyle(
        resolvedTheme,
        classPrefix,
        isHighlighted,
      );
      const numberSpan = lineNumbers
        ? `<span class="${classPrefix}-line-number" aria-hidden="true" style="${escapeHTMLAttribute(numberStyle)}">${lineNum}</span>`
        : "";

      const renderedLine = `<span class="${lineClasses.join(" ")}" style="${escapeHTMLAttribute(lineStyles.join("; "))}">${gutterSpan}${numberSpan}<span class="${classPrefix}-line-content">${line}</span></span>`;
      bodyLength += renderedLine.length;
      assertRenderedLength(bodyLength, maxRenderedLength);
      renderedLines.push(renderedLine);
    }
    bodyHTML = renderedLines.join("");
  } else {
    bodyHTML = codeHTML;
  }

  if (!wrapCode) return bodyHTML;

  // Build wrapper attributes
  const langAttr = language ? ` data-language="${escapeHTMLAttribute(language)}"` : "";
  const themeCSS = resolvedTheme
    ? ` style="${escapeHTMLAttribute(getThemeInlineStyles(resolvedTheme, classPrefix))}"`
    : "";

  const result = `<pre class="${classPrefix}"${langAttr}${themeCSS}><code class="${classPrefix}-code">${bodyHTML}</code></pre>`;
  assertRenderedLength(result.length, maxRenderedLength);
  return result;
}

/**
 * Render a single token to HTML.
 */
function renderToken(
  token: Token,
  classPrefix: string,
  theme: Theme | undefined,
  context: RenderContext,
  depth: number,
): string {
  if (typeof token === "string") {
    countLines(token, context);
    const escaped = escapeHTML(token);
    assertRenderedLength(escaped.length, context.maxRenderedLength);
    return escaped;
  }

  if (depth > context.maxTokenDepth) {
    throw new RangeError(
      `Token nesting exceeds maxTokenDepth ${context.maxTokenDepth}`,
    );
  }
  if (context.activeNodes.has(token)) {
    throw new TypeError("Token tree contains a cycle");
  }
  context.tokenCount++;
  if (context.tokenCount > context.maxTokenCount) {
    throw new RangeError(
      `Token count exceeds maxTokenCount ${context.maxTokenCount}`,
    );
  }
  context.activeNodes.add(token);

  try {
    const classes = getTokenClasses(token, classPrefix);
    const classAttr = classes.length > 0 ? ` class="${classes.join(" ")}"` : "";
    const color = getTokenColor(token, theme);
    const styleAttr = color
      ? ` style="${escapeHTMLAttribute(`color: var(--${classPrefix}-${color.tokenType}, ${color.value})`)}"`
      : "";

    let content: string;
    if (typeof token.content === "string") {
      countLines(token.content, context);
      content = escapeHTML(token.content);
    } else {
      content = token.content
        .map((t) => renderToken(t, classPrefix, theme, context, depth + 1))
        .join("");
    }

    const rendered = `<span${classAttr}${styleAttr}>${content}</span>`;
    assertRenderedLength(rendered.length, context.maxRenderedLength);
    return rendered;
  } finally {
    context.activeNodes.delete(token);
  }
}

function countLines(text: string, context: RenderContext): void {
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "\n") {
      if (context.previousWasCR) {
        context.previousWasCR = false;
        continue;
      }
      context.lineCount++;
    } else if (text[index] === "\r") {
      context.lineCount++;
      context.previousWasCR = true;
    } else {
      context.previousWasCR = false;
    }
    if (context.lineCount > context.maxLines) {
      throw new RangeError(`Line count exceeds maxLines ${context.maxLines}`);
    }
  }
}

function assertLimit(value: number, name: string): void {
  if (
    value !== Number.POSITIVE_INFINITY &&
    (!Number.isInteger(value) || value < 0)
  ) {
    throw new RangeError(`${name} must be a non-negative integer or Infinity`);
  }
}

function assertRenderedLength(length: number, maxRenderedLength: number): void {
  if (length > maxRenderedLength) {
    throw new RangeError(
      `Rendered length exceeds maxRenderedLength ${maxRenderedLength}`,
    );
  }
}

/**
 * Get CSS classes for a token.
 */
function getTokenClasses(token: TokenNode, classPrefix: string): string[] {
  assertSafeCssIdentifier(token.type, "token type");
  const classes = [`${classPrefix}-${token.type}`];
  if (token.alias) {
    const aliases = Array.isArray(token.alias) ? token.alias : [token.alias];
    for (const alias of aliases) {
      assertSafeCssIdentifier(alias, "token alias");
      classes.push(`${classPrefix}-${alias}`);
    }
  }
  return classes;
}

/**
 * Generate inline CSS custom properties from a theme for use in style attribute.
 */
function getThemeInlineStyles(theme: Theme, classPrefix: string): string {
  const vars: string[] = [
    `background: var(--${classPrefix}-bg, ${theme.background})`,
    `color: var(--${classPrefix}-fg, ${theme.foreground})`,
  ];

  if (theme.selection) {
    vars.push(`--${classPrefix}-selection: ${theme.selection}`);
  }
  if (theme.lineNumber) {
    vars.push(`--${classPrefix}-line-number: ${theme.lineNumber}`);
  }
  if (theme.lineNumberActive) {
    vars.push(`--${classPrefix}-line-number-active: ${theme.lineNumberActive}`);
  }
  if (theme.lineHighlight) {
    vars.push(`--${classPrefix}-line-highlight: ${theme.lineHighlight}`);
  }
  if (theme.diffAddedBg) {
    vars.push(`--${classPrefix}-diff-added-bg: ${theme.diffAddedBg}`);
  }
  if (theme.diffRemovedBg) {
    vars.push(`--${classPrefix}-diff-removed-bg: ${theme.diffRemovedBg}`);
  }
  if (theme.diffModifiedBg) {
    vars.push(`--${classPrefix}-diff-modified-bg: ${theme.diffModifiedBg}`);
  }

  for (const [tokenType, color] of Object.entries(theme.tokenColors)) {
    if (color) {
      vars.push(`--${classPrefix}-${tokenType}: ${color}`);
    }
  }

  return vars.join("; ");
}

function getTokenColor(
  token: TokenNode,
  theme: Theme | undefined,
): { tokenType: string; value: string } | undefined {
  if (!theme) return undefined;

  const directColor = theme.tokenColors[token.type];
  if (directColor) return { tokenType: token.type, value: directColor };

  const aliases = token.alias
    ? Array.isArray(token.alias)
      ? token.alias
      : [token.alias]
    : [];
  for (const alias of aliases) {
    const aliasColor = theme.tokenColors[alias];
    if (aliasColor) return { tokenType: alias, value: aliasColor };
  }

  return undefined;
}

function getLineNumberStyle(
  theme: Theme | undefined,
  classPrefix: string,
  highlighted: boolean,
): string {
  const styles = [
    "display: inline-block",
    "min-width: 3ch",
    "margin-right: 1em",
    "text-align: right",
    "user-select: none",
  ];
  if (highlighted && theme?.lineNumberActive) {
    styles.push(
      `color: var(--${classPrefix}-line-number-active, ${theme.lineNumberActive})`,
    );
  } else if (theme?.lineNumber) {
    styles.push(
      `color: var(--${classPrefix}-line-number, ${theme.lineNumber})`,
    );
  }
  return styles.join("; ");
}

function getLineBackground(
  theme: Theme | undefined,
  highlighted: boolean,
  added: boolean,
  removed: boolean,
  modified: boolean,
  classPrefix: string,
): string | undefined {
  if (!theme) return undefined;
  if (added && theme.diffAddedBg) {
    return `background: var(--${classPrefix}-diff-added-bg, ${theme.diffAddedBg})`;
  }
  if (removed && theme.diffRemovedBg) {
    return `background: var(--${classPrefix}-diff-removed-bg, ${theme.diffRemovedBg})`;
  }
  if (modified && theme.diffModifiedBg) {
    return `background: var(--${classPrefix}-diff-modified-bg, ${theme.diffModifiedBg})`;
  }
  if (highlighted && theme.lineHighlight) {
    return `background: var(--${classPrefix}-line-highlight, ${theme.lineHighlight})`;
  }
  return undefined;
}

/**
 * Generate a complete CSS stylesheet for a theme.
 * Useful for SSR or injecting into <style> tags.
 */
export function getThemeStylesheet(theme: Theme | string, classPrefix = DEFAULT_CLASS_PREFIX): string {
  const resolved = resolveThemeOrThrow(theme);

  const css = getThemeCSS(resolved, classPrefix);
  return css;
}

/**
 * Split an HTML string into lines, properly handling tags that span multiple lines.
 * At each newline boundary, any open tags are closed and reopened on the next line
 * so that each line is a self-contained HTML fragment with valid nesting.
 */
function splitHTMLIntoLines(html: string, maxLines: number): string[] {
  const lines: string[] = [];
  let currentLine = "";
  // Stack of open tag strings (e.g. '<span class="neo-hl-keyword">')
  const openTags: string[] = [];
  let previousBoundaryWasCR = false;

  let i = 0;
  while (i < html.length) {
    if (html[i] === "\n" || html[i] === "\r") {
      const boundary = html[i]!;
      if (boundary === "\n" && previousBoundaryWasCR) {
        previousBoundaryWasCR = false;
        i++;
        continue;
      }
      // Close all open tags for this line
      for (let t = openTags.length - 1; t >= 0; t--) {
        currentLine += "</span>";
      }
      lines.push(currentLine);
      if (lines.length >= maxLines) {
        throw new RangeError(`Line count exceeds maxLines ${maxLines}`);
      }
      // Start new line and reopen all tags
      currentLine = "";
      for (const tag of openTags) {
        currentLine += tag;
      }
      // A following LF is part of this boundary even if token markup appears
      // between the two source characters.
      previousBoundaryWasCR = boundary === "\r";
      i++;
    } else if (html[i] === "<") {
      // Find the end of the tag
      const closeIdx = html.indexOf(">", i);
      if (closeIdx === -1) {
        // Malformed — just append rest
        currentLine += html.slice(i);
        break;
      }
      const tag = html.slice(i, closeIdx + 1);

      if (tag.startsWith("</")) {
        // Closing tag — pop from stack
        openTags.pop();
        currentLine += tag;
      } else if (tag.endsWith("/>")) {
        // Self-closing tag — just append
        currentLine += tag;
      } else {
        // Opening tag — push to stack
        openTags.push(tag);
        currentLine += tag;
      }
      i = closeIdx + 1;
    } else {
      previousBoundaryWasCR = false;
      currentLine += html[i];
      i++;
    }
  }

  // Push the last line
  lines.push(currentLine);
  return lines;
}
