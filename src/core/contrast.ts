/**
 * WCAG contrast ratio utilities for theme validation
 */

import type { Theme } from "./types";
import { getNamedColor } from "./named-colors";
import { isSafeCssColorFunction } from "./safety";

type RGB = [number, number, number];
type RGBA = [number, number, number, number];

const WHITE: RGB = [255, 255, 255];

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
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(hex);
  if (!match?.[1]) {
    throw new TypeError("Color must use #rgb or #rrggbb hexadecimal syntax");
  }

  const h =
    match[1].length === 3
      ? [...match[1]].map((digit) => digit + digit).join("")
      : match[1];
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
  const background = flattenColor(parseCSSColor(color2), WHITE);
  const foreground = flattenColor(parseCSSColor(color1), background);
  return contrastRatioFromRGB(foreground, background);
}

function contrastRatioFromRGB(color1: RGB, color2: RGB): number {
  const [r1, g1, b1] = color1;
  const [r2, g2, b2] = color2;

  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

function parseCSSColor(value: string): RGBA {
  const color = value.trim().toLowerCase();
  const named = getNamedColor(color);
  if (named) return [named[0], named[1], named[2], 1];
  if (color === "transparent") return [0, 0, 0, 0];
  if (color === "currentcolor") {
    throw new TypeError("currentcolor requires an explicit color context");
  }

  const hex = /^#([\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.exec(
    color,
  )?.[1];
  if (hex) {
    const expanded =
      hex.length <= 4
        ? [...hex].map((digit) => digit + digit).join("")
        : hex;
    return [
      parseInt(expanded.slice(0, 2), 16),
      parseInt(expanded.slice(2, 4), 16),
      parseInt(expanded.slice(4, 6), 16),
      expanded.length === 8
        ? parseInt(expanded.slice(6, 8), 16) / 255
        : 1,
    ];
  }

  const functional = /^([a-z]+)\((.*)\)$/i.exec(color);
  if (
    !functional?.[1] ||
    functional[2] === undefined ||
    !isSafeCssColorFunction(color)
  ) {
    throw new TypeError(`Unsupported CSS color: ${value}`);
  }
  const components = functional[2]
    .replace(/[,/]/g, " ")
    .trim()
    .split(/\s+/);
  if (components.length < 3 || components.length > 4) {
    throw new TypeError(`Unsupported CSS color: ${value}`);
  }

  const alpha = parseAlpha(components[3]);
  switch (functional[1]) {
    case "rgb":
    case "rgba":
      return [
        parseRGBComponent(components[0]!),
        parseRGBComponent(components[1]!),
        parseRGBComponent(components[2]!),
        alpha,
      ];
    case "hsl":
    case "hsla": {
      const rgb = hslToRGB(
        parseHue(components[0]!),
        parsePercentage(components[1]!),
        parsePercentage(components[2]!),
      );
      return [...rgb, alpha];
    }
    case "hwb": {
      const rgb = hwbToRGB(
        parseHue(components[0]!),
        parsePercentage(components[1]!),
        parsePercentage(components[2]!),
      );
      return [...rgb, alpha];
    }
    case "lab": {
      const rgb = labToRGB(
        parseLightness(components[0]!),
        parseLabAxis(components[1]!),
        parseLabAxis(components[2]!),
      );
      return [...rgb, alpha];
    }
    case "lch": {
      const chroma = parseLCHChroma(components[1]!);
      const hue = degreesToRadians(parseHue(components[2]!));
      const rgb = labToRGB(
        parseLightness(components[0]!),
        chroma * Math.cos(hue),
        chroma * Math.sin(hue),
      );
      return [...rgb, alpha];
    }
    case "oklab": {
      const rgb = oklabToRGB(
        parseOKLightness(components[0]!),
        parseOKAxis(components[1]!),
        parseOKAxis(components[2]!),
      );
      return [...rgb, alpha];
    }
    case "oklch": {
      const chroma = parseOKAxis(components[1]!);
      const hue = degreesToRadians(parseHue(components[2]!));
      const rgb = oklabToRGB(
        parseOKLightness(components[0]!),
        chroma * Math.cos(hue),
        chroma * Math.sin(hue),
      );
      return [...rgb, alpha];
    }
    default:
      throw new TypeError(`Unsupported CSS color: ${value}`);
  }
}

function parseNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`Invalid CSS color component: ${value}`);
  }
  return parsed;
}

function parseRGBComponent(value: string): number {
  const parsed = parseNumber(value);
  return clamp(value.endsWith("%") ? parsed * 2.55 : parsed, 0, 255);
}

function parsePercentage(value: string): number {
  return clamp(parseNumber(value) / 100, 0, 1);
}

function parseLightness(value: string): number {
  return clamp(parseNumber(value), 0, 100);
}

function parseOKLightness(value: string): number {
  const parsed = parseNumber(value);
  return clamp(value.endsWith("%") ? parsed / 100 : parsed, 0, 1);
}

function parseLabAxis(value: string): number {
  const parsed = parseNumber(value);
  return value.endsWith("%") ? parsed * 1.25 : parsed;
}

function parseLCHChroma(value: string): number {
  const parsed = parseNumber(value);
  return value.endsWith("%") ? parsed * 1.5 : parsed;
}

function parseOKAxis(value: string): number {
  const parsed = parseNumber(value);
  return value.endsWith("%") ? parsed * 0.004 : parsed;
}

function parseAlpha(value: string | undefined): number {
  if (value === undefined) return 1;
  const parsed = parseNumber(value);
  return clamp(value.endsWith("%") ? parsed / 100 : parsed, 0, 1);
}

function parseHue(value: string): number {
  const parsed = parseNumber(value);
  let degrees = parsed;
  if (value.endsWith("grad")) degrees = parsed * 0.9;
  else if (value.endsWith("rad")) degrees = (parsed * 180) / Math.PI;
  else if (value.endsWith("turn")) degrees = parsed * 360;
  return ((degrees % 360) + 360) % 360;
}

function hslToRGB(hue: number, saturation: number, lightness: number): RGB {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const [red, green, blue] =
    section < 1
      ? [chroma, secondary, 0]
      : section < 2
        ? [secondary, chroma, 0]
        : section < 3
          ? [0, chroma, secondary]
          : section < 4
            ? [0, secondary, chroma]
            : section < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  const offset = lightness - chroma / 2;
  return [
    (red + offset) * 255,
    (green + offset) * 255,
    (blue + offset) * 255,
  ];
}

function hwbToRGB(hue: number, whiteness: number, blackness: number): RGB {
  if (whiteness + blackness >= 1) {
    const gray = (whiteness / (whiteness + blackness)) * 255;
    return [gray, gray, gray];
  }
  const base = hslToRGB(hue, 1, 0.5);
  const scale = 1 - whiteness - blackness;
  return base.map(
    (component) => (component / 255) * scale * 255 + whiteness * 255,
  ) as RGB;
}

function labToRGB(lightness: number, a: number, b: number): RGB {
  const fy = (lightness + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const inverse = (value: number): number =>
    value ** 3 > 216 / 24389
      ? value ** 3
      : (116 * value - 16) / 903.3;

  const x50 = 0.96422 * inverse(fx);
  const y50 = inverse(fy);
  const z50 = 0.82521 * inverse(fz);
  const x65 = 0.9555766 * x50 - 0.0230393 * y50 + 0.0631636 * z50;
  const y65 = -0.0282895 * x50 + 1.0099416 * y50 + 0.0210077 * z50;
  const z65 = 0.0122982 * x50 - 0.020483 * y50 + 1.3299098 * z50;
  return linearRGBToRGB([
    3.2404542 * x65 - 1.5371385 * y65 - 0.4985314 * z65,
    -0.969266 * x65 + 1.8760108 * y65 + 0.041556 * z65,
    0.0556434 * x65 - 0.2040259 * y65 + 1.0572252 * z65,
  ]);
}

function oklabToRGB(lightness: number, a: number, b: number): RGB {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return linearRGBToRGB([
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]);
}

function linearRGBToRGB(linear: RGB): RGB {
  return linear.map((component) => {
    const encoded =
      component <= 0.0031308
        ? 12.92 * component
        : 1.055 * component ** (1 / 2.4) - 0.055;
    return clamp(encoded * 255, 0, 255);
  }) as RGB;
}

function flattenColor(color: RGBA, background: RGB): RGB {
  const alpha = color[3];
  return [
    color[0] * alpha + background[0] * (1 - alpha),
    color[1] * alpha + background[1] * (1 - alpha),
    color[2] * alpha + background[2] * (1 - alpha),
  ];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

/**
 * Check if a color pair meets WCAG AA requirements
 *
 * @param foreground - Foreground CSS color
 * @param background - Background CSS color
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
  if (!Number.isFinite(minRatio) || minRatio < 1 || minRatio > 21) {
    throw new RangeError("minRatio must be a finite number between 1 and 21");
  }
  const results: ContrastResult[] = [];
  let passed = true;

  const backgroundColor = resolveThemeColor(theme.background, theme.foreground);
  const background = flattenColor(parseCSSColor(backgroundColor), WHITE);
  const foregroundColor = resolveThemeColor(theme.foreground, theme.foreground);
  const foreground = flattenColor(parseCSSColor(foregroundColor), background);

  // Check foreground
  const fgRatio = contrastRatioFromRGB(foreground, background);
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
    const tokenColor = resolveThemeColor(color, theme.foreground);
    const ratio = contrastRatioFromRGB(
      flattenColor(parseCSSColor(tokenColor), background),
      background,
    );
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

function resolveThemeColor(color: string, currentColor: string): string {
  return color.trim().toLowerCase() === "currentcolor" ? currentColor : color;
}
