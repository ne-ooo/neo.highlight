/* -------------------------------------------------------------------------------------------------
 * Theme System — CSS Custom Properties based theming
 * -----------------------------------------------------------------------------------------------*/

import type { Theme } from "./types";
import {
  assertSafeCssIdentifier,
  assertSafeCssSelector,
  assertSafeCssValue,
} from "./safety";

const DEFAULT_CLASS_PREFIX = "neo-hl";

/** Theme registry for name-based lookups */
const themeRegistry = new Map<string, Theme>();

interface AppliedTheme {
  css: string;
  element: HTMLStyleElement;
  owned: boolean;
  references: number;
}

const appliedThemes = new Map<string, AppliedTheme>();

/**
 * Register a theme for name-based lookup.
 */
export function registerTheme<T extends Theme>(theme: T): T {
  themeRegistry.set(theme.name, theme);
  return theme;
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

/** Resolve a theme or fail explicitly instead of silently rendering unthemed. */
export function resolveThemeOrThrow(theme: Theme | string): Theme {
  const resolved = resolveTheme(theme);
  if (!resolved) {
    throw new RangeError(
      `Unknown theme "${theme}". Import and register it before using its name.`,
    );
  }
  return resolved;
}

/** Validate every value interpolated into generated CSS. */
export function validateThemeForCSS(
  theme: Theme,
  classPrefix = DEFAULT_CLASS_PREFIX,
): void {
  assertSafeCssIdentifier(classPrefix, "class prefix");
  assertSafeCssValue(theme.background, "theme background");
  assertSafeCssValue(theme.foreground, "theme foreground");

  const optionalColors: Array<[string, string | undefined]> = [
    ["theme selection", theme.selection],
    ["theme line number", theme.lineNumber],
    ["theme active line number", theme.lineNumberActive],
    ["theme line highlight", theme.lineHighlight],
    ["theme added diff background", theme.diffAddedBg],
    ["theme removed diff background", theme.diffRemovedBg],
    ["theme modified diff background", theme.diffModifiedBg],
  ];
  for (const [label, color] of optionalColors) {
    if (color !== undefined) assertSafeCssValue(color, label);
  }

  for (const [tokenType, color] of Object.entries(theme.tokenColors)) {
    assertSafeCssIdentifier(tokenType, "theme token type");
    if (color !== undefined) {
      assertSafeCssValue(color, `theme token color (${tokenType})`);
    }
  }
}

/**
 * Generate CSS string for a theme using CSS custom properties.
 */
export function getThemeCSS(theme: Theme, classPrefix = DEFAULT_CLASS_PREFIX): string {
  validateThemeForCSS(theme, classPrefix);
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
  if (theme.diffAddedBg) {
    lines.push(`  --${classPrefix}-diff-added-bg: ${theme.diffAddedBg};`);
  }
  if (theme.diffRemovedBg) {
    lines.push(`  --${classPrefix}-diff-removed-bg: ${theme.diffRemovedBg};`);
  }
  if (theme.diffModifiedBg) {
    lines.push(`  --${classPrefix}-diff-modified-bg: ${theme.diffModifiedBg};`);
  }

  // Token color variables
  for (const [tokenType, color] of Object.entries(theme.tokenColors)) {
    if (color) {
      lines.push(`  --${classPrefix}-${tokenType}: ${color};`);
    }
  }

  lines.push(`}`);
  lines.push("");

  // Structural styles required by renderer line markup.
  lines.push(`.${classPrefix}-line { display: block; min-height: 1em; }`);
  lines.push(`.${classPrefix}-line-number { display: inline-block; min-width: 3ch; margin-right: 1em; text-align: right; user-select: none; }`);
  lines.push(`.${classPrefix}-diff-gutter { display: inline-block; width: 1.5em; text-align: center; user-select: none; }`);
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
  if (theme.lineNumberActive) {
    lines.push(`.${classPrefix}-line-highlighted .${classPrefix}-line-number { color: var(--${classPrefix}-line-number-active); }`);
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
      lines.push(`.${classPrefix}-diff-added { background: var(--${classPrefix}-diff-added-bg); }`);
    }
    if (theme.diffRemovedBg) {
      lines.push(`.${classPrefix}-diff-removed { background: var(--${classPrefix}-diff-removed-bg); }`);
    }
    if (theme.diffModifiedBg) {
      lines.push(`.${classPrefix}-diff-modified { background: var(--${classPrefix}-diff-modified-bg); }`);
    }
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
  validateThemeForCSS(lightTheme, classPrefix)
  validateThemeForCSS(darkTheme, classPrefix)
  if (darkSelector !== undefined) {
    assertSafeCssSelector(darkSelector, "dark selector")
  }
  const lines: string[] = []

  // Light theme variables (default)
  lines.push(`.${classPrefix} {`)
  lines.push(`  --${classPrefix}-bg: ${lightTheme.background};`)
  lines.push(`  --${classPrefix}-fg: ${lightTheme.foreground};`)
  lines.push(`  background: var(--${classPrefix}-bg);`)
  lines.push(`  color: var(--${classPrefix}-fg);`)
  appendOptionalThemeVariables(lines, lightTheme, classPrefix)
  for (const [tokenType, color] of Object.entries(lightTheme.tokenColors)) {
    if (color) {
      lines.push(`  --${classPrefix}-${tokenType}: ${color};`)
    }
  }
  lines.push(`}`)
  lines.push("")

  lines.push(`.${classPrefix}-line { display: block; min-height: 1em; }`)
  lines.push(`.${classPrefix}-line-number { display: inline-block; min-width: 3ch; margin-right: 1em; text-align: right; user-select: none; }`)
  lines.push(`.${classPrefix}-diff-gutter { display: inline-block; width: 1.5em; text-align: center; user-select: none; }`)
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
  appendOptionalThemeVariables(lines, darkTheme, classPrefix)
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

  if (lightTheme.selection || darkTheme.selection) {
    lines.push("")
    lines.push(`.${classPrefix} ::selection { background: var(--${classPrefix}-selection); }`)
  }
  if (lightTheme.lineNumber || darkTheme.lineNumber) {
    lines.push("")
    lines.push(`.${classPrefix}-line-number { color: var(--${classPrefix}-line-number); }`)
  }
  if (lightTheme.lineNumberActive || darkTheme.lineNumberActive) {
    lines.push(`.${classPrefix}-line-highlighted .${classPrefix}-line-number { color: var(--${classPrefix}-line-number-active); }`)
  }
  if (lightTheme.lineHighlight || darkTheme.lineHighlight) {
    lines.push("")
    lines.push(`.${classPrefix}-line-highlighted { background: var(--${classPrefix}-line-highlight); }`)
  }
  if (lightTheme.diffAddedBg || darkTheme.diffAddedBg) {
    lines.push("")
    lines.push(`.${classPrefix}-diff-added { background: var(--${classPrefix}-diff-added-bg); }`)
  }
  if (lightTheme.diffRemovedBg || darkTheme.diffRemovedBg) {
    lines.push(`.${classPrefix}-diff-removed { background: var(--${classPrefix}-diff-removed-bg); }`)
  }
  if (lightTheme.diffModifiedBg || darkTheme.diffModifiedBg) {
    lines.push(`.${classPrefix}-diff-modified { background: var(--${classPrefix}-diff-modified-bg); }`)
  }

  return lines.join("\n")
}

function appendOptionalThemeVariables(
  lines: string[],
  theme: Theme,
  classPrefix: string,
): void {
  const variables: Array<[string, string | undefined]> = [
    ["selection", theme.selection],
    ["line-number", theme.lineNumber],
    ["line-number-active", theme.lineNumberActive],
    ["line-highlight", theme.lineHighlight],
    ["diff-added-bg", theme.diffAddedBg],
    ["diff-removed-bg", theme.diffRemovedBg],
    ["diff-modified-bg", theme.diffModifiedBg],
  ]
  for (const [name, value] of variables) {
    if (value) lines.push(`  --${classPrefix}-${name}: ${value};`)
  }
}

/**
 * Apply a theme by injecting a <style> tag into the document.
 * Returns a cleanup function to remove the style element.
 *
 * @param theme - Theme object or name
 * @param classPrefix - CSS class prefix
 * @returns Cleanup function, or undefined outside a browser
 * @throws RangeError when a string name is not registered
 */
export function applyTheme(
  theme: Theme | string,
  classPrefix = DEFAULT_CLASS_PREFIX,
): (() => void) | undefined {
  if (typeof document === "undefined") return undefined;

  const resolved = resolveThemeOrThrow(theme);

  const css = getThemeCSS(resolved, classPrefix);
  const styleId = `${classPrefix}-theme-${resolved.name}`;

  const active = appliedThemes.get(styleId);
  if (
    active &&
    active.element.ownerDocument === document &&
    active.element.isConnected
  ) {
    active.references++;
    if (active.css !== css) {
      active.css = css;
      active.element.textContent = css;
    }
    return createThemeRelease(styleId, active);
  }
  if (active) appliedThemes.delete(styleId);

  const existing = document.getElementById(styleId);
  const style =
    existing instanceof HTMLStyleElement
      ? existing
      : document.createElement("style");
  const owned = !style.isConnected;
  if (owned) style.id = styleId;
  style.textContent = css;
  if (owned) document.head.appendChild(style);

  const record: AppliedTheme = {
    css,
    element: style,
    owned,
    references: 1,
  };
  appliedThemes.set(styleId, record);
  return createThemeRelease(styleId, record);
}

function createThemeRelease(
  styleId: string,
  record: AppliedTheme,
): () => void {
  let released = false;
  return () => {
    if (released) return;
    released = true;

    if (appliedThemes.get(styleId) !== record) return;
    record.references--;
    if (record.references > 0) return;

    if (record.owned) record.element.remove();
    appliedThemes.delete(styleId);
  };
}
