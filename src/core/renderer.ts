/* -------------------------------------------------------------------------------------------------
 * Renderer — Converts token arrays to HTML strings
 * -----------------------------------------------------------------------------------------------*/

import type { RenderOptions, Theme, Token, TokenNode } from "./types";
import { getThemeCSS, resolveTheme } from "./themes";

const DEFAULT_CLASS_PREFIX = "neo-hl";

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
    diffHighlight,
  } = options;

  const resolvedTheme = theme ? resolveTheme(theme) : undefined;

  // Render tokens to inline HTML
  const codeHTML = tokens.map((token) => renderToken(token, classPrefix)).join("");

  if (!wrapCode) return codeHTML;

  // Split into lines for line numbers and line highlighting
  const lines = codeHTML.split("\n");
  const highlightSet = highlightLines ? new Set(highlightLines) : null;
  const needsLineWrapping = lineNumbers || highlightSet || diffHighlight;

  // Build diff line sets
  const diffAdded = diffHighlight?.added ? new Set(diffHighlight.added) : null;
  const diffRemoved = diffHighlight?.removed ? new Set(diffHighlight.removed) : null;
  const diffModified = diffHighlight?.modified ? new Set(diffHighlight.modified) : null;

  let bodyHTML: string;

  if (needsLineWrapping) {
    bodyHTML = lines
      .map((line, i) => {
        const lineNum = i + 1;
        const isHighlighted = highlightSet?.has(lineNum) ?? false;

        // Build line classes
        const lineClasses = [`${classPrefix}-line`];
        if (isHighlighted) lineClasses.push(`${classPrefix}-line-highlighted`);
        if (diffAdded?.has(lineNum)) lineClasses.push(`${classPrefix}-diff-added`);
        if (diffRemoved?.has(lineNum)) lineClasses.push(`${classPrefix}-diff-removed`);
        if (diffModified?.has(lineNum)) lineClasses.push(`${classPrefix}-diff-modified`);

        // Diff gutter marker
        let gutterSpan = "";
        if (diffAdded?.has(lineNum)) {
          gutterSpan = `<span class="${classPrefix}-diff-gutter">+</span>`;
        } else if (diffRemoved?.has(lineNum)) {
          gutterSpan = `<span class="${classPrefix}-diff-gutter">-</span>`;
        } else if (diffModified?.has(lineNum)) {
          gutterSpan = `<span class="${classPrefix}-diff-gutter">~</span>`;
        }

        const numberSpan = lineNumbers
          ? `<span class="${classPrefix}-line-number">${lineNum}</span>`
          : "";

        return `<span class="${lineClasses.join(" ")}">${gutterSpan}${numberSpan}<span class="${classPrefix}-line-content">${line}</span></span>`;
      })
      .join("\n");
  } else {
    bodyHTML = codeHTML;
  }

  // Build wrapper attributes
  const langAttr = language ? ` data-language="${escapeAttr(language)}"` : "";
  const themeCSS = resolvedTheme ? ` style="${escapeAttr(getThemeInlineStyles(resolvedTheme))}"` : "";

  return `<pre class="${classPrefix}"${langAttr}${themeCSS}><code class="${classPrefix}-code">${bodyHTML}</code></pre>`;
}

/**
 * Render a single token to HTML.
 */
function renderToken(token: Token, classPrefix: string): string {
  if (typeof token === "string") {
    return escapeHTML(token);
  }

  const classes = getTokenClasses(token, classPrefix);
  const classAttr = classes.length > 0 ? ` class="${classes.join(" ")}"` : "";

  let content: string;
  if (typeof token.content === "string") {
    content = escapeHTML(token.content);
  } else {
    content = token.content.map((t) => renderToken(t, classPrefix)).join("");
  }

  return `<span${classAttr}>${content}</span>`;
}

/**
 * Get CSS classes for a token.
 */
function getTokenClasses(token: TokenNode, classPrefix: string): string[] {
  const classes = [`${classPrefix}-${token.type}`];
  if (token.alias) {
    const aliases = Array.isArray(token.alias) ? token.alias : [token.alias];
    for (const alias of aliases) {
      classes.push(`${classPrefix}-${alias}`);
    }
  }
  return classes;
}

/**
 * Generate inline CSS custom properties from a theme for use in style attribute.
 */
function getThemeInlineStyles(theme: Theme): string {
  const vars: string[] = [
    `--neo-hl-bg: ${theme.background}`,
    `--neo-hl-fg: ${theme.foreground}`,
    `background: ${theme.background}`,
    `color: ${theme.foreground}`,
  ];

  if (theme.selection) {
    vars.push(`--neo-hl-selection: ${theme.selection}`);
  }
  if (theme.lineNumber) {
    vars.push(`--neo-hl-line-number: ${theme.lineNumber}`);
  }
  if (theme.lineHighlight) {
    vars.push(`--neo-hl-line-highlight: ${theme.lineHighlight}`);
  }

  for (const [tokenType, color] of Object.entries(theme.tokenColors)) {
    if (color) {
      vars.push(`--neo-hl-${tokenType}: ${color}`);
    }
  }

  return vars.join("; ");
}

/**
 * Generate a complete CSS stylesheet for a theme.
 * Useful for SSR or injecting into <style> tags.
 */
export function getThemeStylesheet(theme: Theme | string, classPrefix = DEFAULT_CLASS_PREFIX): string {
  const resolved = resolveTheme(theme);
  if (!resolved) return "";

  const css = getThemeCSS(resolved, classPrefix);
  return css;
}

/**
 * Escape HTML special characters.
 */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Escape attribute value.
 */
function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
