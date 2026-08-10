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
import { applyTheme, resolveThemeOrThrow } from "./themes";
import { detectLanguage as detectLanguageAuto } from "./detect";
import { normalizeGrammarIdentifier } from "./grammar-utils";

const HIGHLIGHTED_ATTR = "data-neo-highlighted";
const DEFAULT_SELECTOR = "pre code";
const DEFAULT_CLASS_PREFIX = "neo-hl";

interface ElementHighlightState {
  source: string;
  classPrefix: string;
  originalBackgroundColor: string;
  originalBackgroundPriority: string;
  originalColor: string;
  originalColorPriority: string;
}

const highlightedElements = new WeakMap<Element, ElementHighlightState>();

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
    maxInputLength?: number | undefined;
  },
  force = false,
  internallyMutated?: WeakSet<Element>,
  reuseStoredSource = false,
): boolean {
  if (!force && element.hasAttribute(HIGHLIGHTED_ATTR)) return false;
  if (
    !force &&
    element.parentElement?.closest(`[${HIGHLIGHTED_ATTR}]`)
  ) {
    return false;
  }

  const classPrefix = options.classPrefix ?? DEFAULT_CLASS_PREFIX;
  const previousState = highlightedElements.get(element);
  const code =
    reuseStoredSource && previousState
      ? previousState.source
      : getElementCode(element, previousState?.classPrefix ?? classPrefix);
  if (code.length === 0) return false;

  // Try language hint from class/data attributes first
  const lang = detectLanguageHint(element);
  let grammar: Grammar | undefined;

  if (lang) {
    grammar = registry.get(normalizeGrammarIdentifier(lang));
  }

  // Fall back to auto-detection if enabled and no hint found
  if (!grammar && options.autoDetect && allLanguages.length > 0) {
    const detected = detectLanguageAuto(code, allLanguages);
    if (detected) {
      grammar = detected.grammar;
    }
  }

  if (!grammar) return false;

  const tokens = tokenize(code, grammar, {
    maxInputLength: options.maxInputLength,
  });
  const html = renderToHTML(tokens, {
    theme: options.theme,
    lineNumbers: options.lineNumbers,
    classPrefix: options.classPrefix,
    wrapCode: false, // We're inside an existing <code>, don't wrap again
    wrapLines: options.lineNumbers,
  });

  internallyMutated?.add(element);
  element.innerHTML = html;
  element.setAttribute(HIGHLIGHTED_ATTR, "true");
  if (previousState && previousState.classPrefix !== classPrefix) {
    element.classList.remove(previousState.classPrefix);
  }
  element.classList.add(classPrefix);

  const state =
    previousState ??
    captureElementHighlightState(element, code, classPrefix);
  state.source = code;
  state.classPrefix = classPrefix;
  highlightedElements.set(element, state);
  applyElementTheme(element, options.theme, state);

  return true;
}

function captureElementHighlightState(
  element: Element,
  source: string,
  classPrefix: string,
): ElementHighlightState {
  const style = element instanceof HTMLElement ? element.style : undefined;
  return {
    source,
    classPrefix,
    originalBackgroundColor: style?.getPropertyValue("background-color") ?? "",
    originalBackgroundPriority: style?.getPropertyPriority("background-color") ?? "",
    originalColor: style?.getPropertyValue("color") ?? "",
    originalColorPriority: style?.getPropertyPriority("color") ?? "",
  };
}

function applyElementTheme(
  element: Element,
  theme: Theme | undefined,
  state: ElementHighlightState,
): void {
  if (!(element instanceof HTMLElement)) return;

  if (theme) {
    element.style.setProperty("background-color", theme.background);
    element.style.setProperty("color", theme.foreground);
    return;
  }

  restoreStyleProperty(
    element,
    "background-color",
    state.originalBackgroundColor,
    state.originalBackgroundPriority,
  );
  restoreStyleProperty(
    element,
    "color",
    state.originalColor,
    state.originalColorPriority,
  );
}

function restoreStyleProperty(
  element: HTMLElement,
  property: string,
  value: string,
  priority: string,
): void {
  if (value) {
    element.style.setProperty(property, value, priority);
  } else {
    element.style.removeProperty(property);
  }
}

function tryHighlightElement(
  element: Element,
  registry: Map<string, Grammar>,
  allLanguages: Grammar[],
  options: Parameters<typeof highlightElement>[3],
  control: {
    force?: boolean;
    internallyMutated?: WeakSet<Element>;
    reuseStoredSource?: boolean;
    onError?: ScanOptions["onError"];
  } = {},
): boolean {
  try {
    return highlightElement(
      element,
      registry,
      allLanguages,
      options,
      control.force,
      control.internallyMutated,
      control.reuseStoredSource,
    );
  } catch (error) {
    try {
      control.onError?.(error, element);
    } catch {
      // An error reporter must not prevent the remaining elements from running.
    }
    return false;
  }
}

function getElementCode(element: Element, classPrefix: string): string {
  if (element.hasAttribute(HIGHLIGHTED_ATTR)) {
    const lineContents = element.querySelectorAll(`.${classPrefix}-line-content`);
    if (lineContents.length > 0) {
      return [...lineContents]
        .map((line) => line.textContent ?? "")
        .join("\n");
    }
  }
  return element.textContent ?? "";
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
    maxInputLength,
    force = false,
    onError,
  } = options;

  const root = container ?? (typeof document !== "undefined" ? document.body : null);
  if (!root) return 0;

  const registry = createRegistry(languages);
  const resolvedTheme = theme ? resolveThemeOrThrow(theme) : undefined;

  const elements = root.querySelectorAll(selector);
  let count = 0;

  for (const element of elements) {
    if (!root.contains(element)) continue;
    const highlighted = tryHighlightElement(
      element,
      registry,
      languages,
      {
        theme: resolvedTheme,
        lineNumbers,
        classPrefix,
        autoDetect,
        maxInputLength,
      },
      { force, reuseStoredSource: force, onError },
    );
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
    maxInputLength,
    force = false,
    onError,
  } = options;

  const root = container ?? (typeof document !== "undefined" ? document.body : null);
  if (!root) return () => {};

  const registry = createRegistry(languages);
  const resolvedTheme = theme ? resolveThemeOrThrow(theme) : undefined;

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
    maxInputLength,
  };

  // Initial scan
  const elements = root.querySelectorAll(selector);
  for (const element of elements) {
    if (!root.contains(element)) continue;
    tryHighlightElement(element, registry, languages, highlightOpts, {
      force,
      reuseStoredSource: force,
      onError,
    });
  }

  // Set up MutationObserver
  if (typeof MutationObserver === "undefined") {
    return () => themeCleanup?.();
  }

  const internallyMutated = new WeakSet<Element>();
  const observer = new MutationObserver((mutations) => {
    const changedHighlighted = new Set<Element>();
    const addedMatches = new Set<Element>();

    for (const mutation of mutations) {
      const target =
        mutation.target instanceof Element
          ? mutation.target
          : mutation.target.parentElement;
      const highlighted = target?.closest(`[${HIGHLIGHTED_ATTR}]`);
      if (highlighted?.matches(selector)) {
        changedHighlighted.add(highlighted);
      }

      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;

        if (
          node.matches(selector) &&
          !node.parentElement?.closest(`[${HIGHLIGHTED_ATTR}]`)
        ) {
          addedMatches.add(node);
        }

        const descendants = node.querySelectorAll(selector);
        for (const desc of descendants) {
          if (!desc.parentElement?.closest(`[${HIGHLIGHTED_ATTR}]`)) {
            addedMatches.add(desc);
          }
        }
      }
    }

    for (const element of changedHighlighted) {
      if (internallyMutated.has(element)) {
        internallyMutated.delete(element);
        continue;
      }
      if (!root.contains(element)) continue;
      tryHighlightElement(
        element,
        registry,
        languages,
        highlightOpts,
        { force: true, internallyMutated, onError },
      );
    }

    for (const element of addedMatches) {
      if (!root.contains(element) || element.hasAttribute(HIGHLIGHTED_ATTR)) {
        continue;
      }
      tryHighlightElement(
        element,
        registry,
        languages,
        highlightOpts,
        { internallyMutated, onError },
      );
    }
  });

  observer.observe(root, {
    childList: true,
    characterData: true,
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
