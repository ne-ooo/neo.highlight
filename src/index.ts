/* -------------------------------------------------------------------------------------------------
 * @lpm.dev/neo.highlight — Main entry point
 *
 * Re-exports core functionality for direct usage.
 * Framework-specific adapters are available at:
 *   - @lpm.dev/neo.highlight/react
 *   - @lpm.dev/neo.highlight/vanilla
 * -----------------------------------------------------------------------------------------------*/

// Core API
export { tokenize, getPlainText, createRegistry } from "./core/tokenizer";
export { renderToHTML, getThemeStylesheet } from "./core/renderer";
export { applyTheme, registerTheme, registerThemes, getTheme, getThemeCSS, resolveTheme, getDualThemeStylesheet } from "./core/themes";
export { resolveGrammar } from "./core/grammar-utils";
export { scan, observe, autoHighlight } from "./core/scanner";
export { detectLanguage, scoreTokenization, clearDetectCache } from "./core/detect";
export { renderCopyButton, initCopyButtons } from "./core/copy-button";
export { validateThemeContrast, contrastRatio, meetsWCAG_AA, hexToRGB, relativeLuminance } from "./core/contrast";

// Types
export type {
  Token,
  TokenNode,
  TokenPattern,
  TokenDefinition,
  Grammar,
  GrammarTokens,
  Theme,
  ThemeTokenColors,
  RenderOptions,
  ScanOptions,
  GrammarRegistry,
  DetectResult,
  DetectOptions,
  DiffHighlight,
} from "./core/types";
export type { ContrastResult, ThemeContrastReport } from "./core/contrast";
