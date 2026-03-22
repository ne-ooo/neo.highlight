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
 * Generate a dual-theme stylesheet that switches between light and dark themes.
 *
 * @param lightTheme - Theme for light mode
 * @param darkTheme - Theme for dark mode
 * @param options - Configuration options
 * @returns CSS string with both themes
 *
 * @example
 * ```typescript
 * // Media query based (default)
 * const css = getDualThemeStylesheet(githubLight, githubDark)
 *
 * // Class-based toggle
 * const css = getDualThemeStylesheet(githubLight, githubDark, {
 *   darkSelector: '.dark'
 * })
 * ```
 */
export function getDualThemeStylesheet(
  lightTheme: Theme,
  darkTheme: Theme,
  options: { darkSelector?: string; classPrefix?: string } = {},
): string {
  const { darkSelector, classPrefix = DEFAULT_CLASS_PREFIX } = options
  const lines: string[] = []

  // Light theme variables (default)
  lines.push(`.${classPrefix} {`)
  lines.push(`  --${classPrefix}-bg: ${lightTheme.background};`)
  lines.push(`  --${classPrefix}-fg: ${lightTheme.foreground};`)
  lines.push(`  background: var(--${classPrefix}-bg);`)
  lines.push(`  color: var(--${classPrefix}-fg);`)
  for (const [tokenType, color] of Object.entries(lightTheme.tokenColors)) {
    if (color) {
      lines.push(`  --${classPrefix}-${tokenType}: ${color};`)
    }
  }
  lines.push(`}`)
  lines.push("")

  // Dark theme variables
  if (darkSelector) {
    // Class-based: .dark .neo-hl { ... }
    lines.push(`${darkSelector} .${classPrefix} {`)
  } else {
    // Media query based (default)
    lines.push(`@media (prefers-color-scheme: dark) {`)
    lines.push(`.${classPrefix} {`)
  }

  lines.push(`  --${classPrefix}-bg: ${darkTheme.background};`)
  lines.push(`  --${classPrefix}-fg: ${darkTheme.foreground};`)
  for (const [tokenType, color] of Object.entries(darkTheme.tokenColors)) {
    if (color) {
      lines.push(`  --${classPrefix}-${tokenType}: ${color};`)
    }
  }

  lines.push(`}`)
  if (!darkSelector) {
    lines.push(`}`) // Close @media
  }
  lines.push("")

  // Token classes (use CSS variables, works for both themes)
  for (const tokenType of new Set([
    ...Object.keys(lightTheme.tokenColors),
    ...Object.keys(darkTheme.tokenColors),
  ])) {
    lines.push(`.${classPrefix}-${tokenType} { color: var(--${classPrefix}-${tokenType}); }`)
  }

  return lines.join("\n")
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
