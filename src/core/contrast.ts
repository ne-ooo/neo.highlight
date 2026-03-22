/**
 * WCAG contrast ratio utilities for theme validation
 */

import type { Theme } from "./types";

/**
 * Result of validating a single token's contrast
 */
export interface ContrastResult {
  token: string;
  color: string;
  background: string;
  ratio: number;
  required: number;
  pass: boolean;
}

/**
 * Result of validating an entire theme
 */
export interface ThemeContrastReport {
  passed: boolean;
  theme: string;
  results: ContrastResult[];
}

/**
 * Parse hex color to RGB values
 */
export function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return [r, g, b];
}

/**
 * Calculate relative luminance per WCAG 2.0
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const linearize = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linearize(r / 255) + 0.7152 * linearize(g / 255) + 0.0722 * linearize(b / 255);
}

/**
 * Calculate contrast ratio between two colors
 * Returns a value between 1 and 21
 */
export function contrastRatio(color1: string, color2: string): number {
  const [r1, g1, b1] = hexToRGB(color1);
  const [r2, g2, b2] = hexToRGB(color2);

  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color pair meets WCAG AA requirements
 *
 * @param foreground - Foreground hex color
 * @param background - Background hex color
 * @param isLargeText - Whether the text is large (>=18px or >=14px bold)
 * @returns true if the contrast ratio meets WCAG AA
 */
export function meetsWCAG_AA(
  foreground: string,
  background: string,
  isLargeText = false,
): boolean {
  const ratio = contrastRatio(foreground, background);
  return ratio >= (isLargeText ? 3 : 4.5);
}

/**
 * Validate all token colors in a theme against WCAG AA contrast requirements
 *
 * @param theme - Theme to validate
 * @param minRatio - Minimum contrast ratio (default: 4.5 for normal text)
 * @returns Validation report with per-token results
 *
 * @example
 * ```typescript
 * import { validateThemeContrast } from '@lpm.dev/neo.highlight'
 * import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'
 *
 * const report = validateThemeContrast(githubDark)
 * console.log(report.passed) // true if all tokens meet WCAG AA
 * ```
 */
export function validateThemeContrast(
  theme: Theme,
  minRatio = 4.5,
): ThemeContrastReport {
  const results: ContrastResult[] = [];
  let passed = true;

  // Check foreground
  const fgRatio = contrastRatio(theme.foreground, theme.background);
  const fgPass = fgRatio >= minRatio;
  if (!fgPass) passed = false;
  results.push({
    token: "foreground",
    color: theme.foreground,
    background: theme.background,
    ratio: Math.round(fgRatio * 100) / 100,
    required: minRatio,
    pass: fgPass,
  });

  // Check each token color
  for (const [token, color] of Object.entries(theme.tokenColors)) {
    if (!color) continue;
    const ratio = contrastRatio(color, theme.background);
    const tokenPass = ratio >= minRatio;
    if (!tokenPass) passed = false;
    results.push({
      token,
      color,
      background: theme.background,
      ratio: Math.round(ratio * 100) / 100,
      required: minRatio,
      pass: tokenPass,
    });
  }

  return { passed, theme: theme.name, results };
}
