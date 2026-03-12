/* -------------------------------------------------------------------------------------------------
 * Theme System — CSS Custom Properties based theming
 * -----------------------------------------------------------------------------------------------*/

import type { Theme } from "./types";

const DEFAULT_CLASS_PREFIX = "neo-hl";

/** Theme registry for name-based lookups */
const themeRegistry = new Map<string, Theme>();

/**
 * Register a theme for name-based lookup.
 */
export function registerTheme(theme: Theme): void {
  themeRegistry.set(theme.name, theme);
}

/**
 * Register multiple themes.
 */
export function registerThemes(themes: Theme[]): void {
  for (const theme of themes) {
    registerTheme(theme);
  }
}

/**
 * Get a theme by name from the registry.
 */
export function getTheme(name: string): Theme | undefined {
  return themeRegistry.get(name);
}

/**
 * Resolve a theme — accepts either a Theme object or a string name.
 * Returns the theme object, or undefined if not found.
 */
export function resolveTheme(theme: Theme | string): Theme | undefined {
  if (typeof theme === "string") {
    return themeRegistry.get(theme);
  }
  return theme;
}

/**
 * Generate CSS string for a theme using CSS custom properties.
 */
export function getThemeCSS(theme: Theme, classPrefix = DEFAULT_CLASS_PREFIX): string {
  const lines: string[] = [];

  // Root variables
  lines.push(`.${classPrefix} {`);
  lines.push(`  --${classPrefix}-bg: ${theme.background};`);
  lines.push(`  --${classPrefix}-fg: ${theme.foreground};`);
  lines.push(`  background: var(--${classPrefix}-bg);`);
  lines.push(`  color: var(--${classPrefix}-fg);`);

  if (theme.selection) {
    lines.push(`  --${classPrefix}-selection: ${theme.selection};`);
  }
  if (theme.lineNumber) {
    lines.push(`  --${classPrefix}-line-number: ${theme.lineNumber};`);
  }
  if (theme.lineNumberActive) {
    lines.push(`  --${classPrefix}-line-number-active: ${theme.lineNumberActive};`);
  }
  if (theme.lineHighlight) {
    lines.push(`  --${classPrefix}-line-highlight: ${theme.lineHighlight};`);
  }

  // Token color variables
  for (const [tokenType, color] of Object.entries(theme.tokenColors)) {
    if (color) {
      lines.push(`  --${classPrefix}-${tokenType}: ${color};`);
    }
  }

  lines.push(`}`);
  lines.push("");

  // Token classes
  for (const [tokenType, color] of Object.entries(theme.tokenColors)) {
    if (color) {
      lines.push(`.${classPrefix}-${tokenType} { color: var(--${classPrefix}-${tokenType}); }`);
    }
  }

  // Selection styling
  if (theme.selection) {
    lines.push("");
    lines.push(`.${classPrefix} ::selection { background: var(--${classPrefix}-selection); }`);
  }

  // Line numbers
  if (theme.lineNumber) {
    lines.push("");
    lines.push(`.${classPrefix}-line-number { color: var(--${classPrefix}-line-number); }`);
  }

  // Line highlighting
  if (theme.lineHighlight) {
    lines.push("");
    lines.push(`.${classPrefix}-line-highlighted { background: var(--${classPrefix}-line-highlight); }`);
  }

  // Diff highlighting
  if (theme.diffAddedBg || theme.diffRemovedBg || theme.diffModifiedBg) {
    lines.push("");
    if (theme.diffAddedBg) {
      lines.push(`.${classPrefix}-diff-added { background: ${theme.diffAddedBg}; }`);
    }
    if (theme.diffRemovedBg) {
      lines.push(`.${classPrefix}-diff-removed { background: ${theme.diffRemovedBg}; }`);
    }
    if (theme.diffModifiedBg) {
      lines.push(`.${classPrefix}-diff-modified { background: ${theme.diffModifiedBg}; }`);
    }
    lines.push(`.${classPrefix}-diff-gutter { display: inline-block; width: 1.5em; text-align: center; user-select: none; }`);
  }

  return lines.join("\n");
}

/**
 * Apply a theme by injecting a <style> tag into the document.
 * Returns a cleanup function to remove the style element.
 *
 * @param theme - Theme object or name
 * @param classPrefix - CSS class prefix
 * @returns Cleanup function, or undefined if theme not found or not in browser
 */
export function applyTheme(
  theme: Theme | string,
  classPrefix = DEFAULT_CLASS_PREFIX,
): (() => void) | undefined {
  if (typeof document === "undefined") return undefined;

  const resolved = resolveTheme(theme);
  if (!resolved) return undefined;

  const css = getThemeCSS(resolved, classPrefix);
  const styleId = `${classPrefix}-theme-${resolved.name}`;

  // Remove existing theme style if present
  const existing = document.getElementById(styleId);
  if (existing) {
    existing.remove();
  }

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);

  return () => {
    style.remove();
  };
}
