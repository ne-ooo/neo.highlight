/* -------------------------------------------------------------------------------------------------
 * Scanner — Auto-scan engine that finds and highlights <code> elements
 *
 * Two modes:
 * 1. scan() — One-shot: finds all matching elements and highlights them
 * 2. observe() — Continuous: uses MutationObserver to watch for new code blocks
 * -----------------------------------------------------------------------------------------------*/

import type { Grammar, ScanOptions, Theme } from "./types";
import { tokenize, createRegistry } from "./tokenizer";
import { renderToHTML } from "./renderer";
import { applyTheme, resolveTheme } from "./themes";
import { detectLanguage as detectLanguageAuto } from "./detect";

const HIGHLIGHTED_ATTR = "data-neo-highlighted";
const DEFAULT_SELECTOR = "pre code";
const DEFAULT_CLASS_PREFIX = "neo-hl";

/**
 * Detect language from a code element's class or data attribute.
 * Supports: class="language-xxx", class="lang-xxx", data-language="xxx"
 */
function detectLanguageHint(element: Element): string | undefined {
  // Check data attribute first
  const dataLang = element.getAttribute("data-language");
  if (dataLang) return dataLang;

  // Check parent's data attribute
  const parentLang = element.parentElement?.getAttribute("data-language");
  if (parentLang) return parentLang;

  // Check class names
  const classNames = [...element.classList, ...(element.parentElement?.classList ?? [])];
  for (const cls of classNames) {
    const match = /^(?:language|lang)-(.+)$/.exec(cls);
    if (match?.[1]) return match[1];
  }

  return undefined;
}

/**
 * Highlight a single code element.
 */
function highlightElement(
  element: Element,
  registry: Map<string, Grammar>,
  allLanguages: Grammar[],
  options: {
    theme?: Theme | undefined;
    lineNumbers?: boolean | undefined;
    classPrefix?: string | undefined;
    autoDetect?: boolean | undefined;
  },
): boolean {
  // Skip already highlighted elements
  if (element.hasAttribute(HIGHLIGHTED_ATTR)) return false;

  const code = element.textContent ?? "";
  if (code.length === 0) return false;

  // Try language hint from class/data attributes first
  const lang = detectLanguageHint(element);
  let grammar: Grammar | undefined;

  if (lang) {
    grammar = registry.get(lang);
  }

  // Fall back to auto-detection if enabled and no hint found
  if (!grammar && options.autoDetect && allLanguages.length > 0) {
    const detected = detectLanguageAuto(code, allLanguages);
    if (detected) {
      grammar = detected.grammar;
    }
  }

  if (!grammar) return false;

  const tokens = tokenize(code, grammar);
  const html = renderToHTML(tokens, {
    theme: options.theme,
    lineNumbers: options.lineNumbers,
    classPrefix: options.classPrefix,
    wrapCode: false, // We're inside an existing <code>, don't wrap again
  });

  element.innerHTML = html;
  element.setAttribute(HIGHLIGHTED_ATTR, "true");
  element.classList.add(options.classPrefix ?? DEFAULT_CLASS_PREFIX);

  return true;
}

/**
 * Scan a container for code elements and highlight them.
 *
 * @param options - Scan options
 * @returns Number of elements highlighted
 */
export function scan(options: ScanOptions): number {
  const {
    selector = DEFAULT_SELECTOR,
    languages,
    theme,
    lineNumbers = false,
    container,
    classPrefix = DEFAULT_CLASS_PREFIX,
    autoDetect = false,
  } = options;

  const root = container ?? (typeof document !== "undefined" ? document.body : null);
  if (!root) return 0;

  const registry = createRegistry(languages);
  const resolvedTheme = theme ? resolveTheme(theme) : undefined;

  // Apply theme CSS
  if (resolvedTheme && typeof document !== "undefined") {
    applyTheme(resolvedTheme, classPrefix);
  }

  const elements = root.querySelectorAll(selector);
  let count = 0;

  for (const element of elements) {
    const highlighted = highlightElement(element, registry, languages, {
      theme: resolvedTheme,
      lineNumbers,
      classPrefix,
      autoDetect,
    });
    if (highlighted) count++;
  }

  return count;
}

/**
 * Observe a container for new code elements and highlight them automatically.
 * Uses MutationObserver for dynamic content (SPA routing, lazy loading, etc.).
 *
 * @param options - Scan options (observe option is ignored)
 * @returns Cleanup function to stop observing
 */
export function observe(options: ScanOptions): () => void {
  const {
    selector = DEFAULT_SELECTOR,
    languages,
    theme,
    lineNumbers = false,
    container,
    classPrefix = DEFAULT_CLASS_PREFIX,
    autoDetect = false,
  } = options;

  const root = container ?? (typeof document !== "undefined" ? document.body : null);
  if (!root) return () => {};

  const registry = createRegistry(languages);
  const resolvedTheme = theme ? resolveTheme(theme) : undefined;

  // Apply theme CSS
  let themeCleanup: (() => void) | undefined;
  if (resolvedTheme && typeof document !== "undefined") {
    themeCleanup = applyTheme(resolvedTheme, classPrefix);
  }

  const highlightOpts = {
    theme: resolvedTheme,
    lineNumbers,
    classPrefix,
    autoDetect,
  };

  // Initial scan
  const elements = root.querySelectorAll(selector);
  for (const element of elements) {
    highlightElement(element, registry, languages, highlightOpts);
  }

  // Set up MutationObserver
  if (typeof MutationObserver === "undefined") return () => {};

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;

        // Check if the added node itself matches
        if (node.matches(selector)) {
          highlightElement(node, registry, languages, highlightOpts);
        }

        // Check descendants
        const descendants = node.querySelectorAll(selector);
        for (const desc of descendants) {
          highlightElement(desc, registry, languages, highlightOpts);
        }
      }
    }
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
  });

  return () => {
    observer.disconnect();
    themeCleanup?.();
  };
}

/**
 * Auto-highlight: scan and optionally observe for new code blocks.
 * Convenience function combining scan() and observe().
 *
 * @param options - Scan options
 * @returns Cleanup function
 */
export function autoHighlight(options: ScanOptions): () => void {
  if (options.observe) {
    return observe(options);
  }
  scan(options);
  return () => {};
}
