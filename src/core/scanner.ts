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
  classPrefix: string;
  source: string;
  renderedHTML: string;
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
    maxMatchCount?: number | undefined;
    maxTokenCount?: number | undefined;
    maxRenderedLength?: number | undefined;
    maxLines?: number | undefined;
    maxTokenDepth?: number | undefined;
  },
  force = false,
  internallyMutated?: WeakSet<Element>,
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
  const code = getElementCode(
    element,
    previousState,
    previousState?.classPrefix ?? classPrefix,
  );
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
    maxMatchCount: options.maxMatchCount,
    maxTokenCount: options.maxTokenCount,
    maxTokenDepth: options.maxTokenDepth,
  });
  const html = renderToHTML(tokens, {
    theme: options.theme,
    lineNumbers: options.lineNumbers,
    classPrefix: options.classPrefix,
    wrapCode: false, // We're inside an existing <code>, don't wrap again
    wrapLines: options.lineNumbers,
    maxTokenCount: options.maxTokenCount,
    maxRenderedLength: options.maxRenderedLength,
    maxLines: options.maxLines,
    maxTokenDepth: options.maxTokenDepth,
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
    captureElementHighlightState(element, classPrefix);
  state.classPrefix = classPrefix;
  state.source = code;
  state.renderedHTML = element.innerHTML;
  highlightedElements.set(element, state);
  applyElementTheme(element, options.theme, state);

  return true;
}

function captureElementHighlightState(
  element: Element,
  classPrefix: string,
): ElementHighlightState {
  const style = element instanceof HTMLElement ? element.style : undefined;
  return {
    classPrefix,
    source: "",
    renderedHTML: "",
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

function getElementCode(
  element: Element,
  state: ElementHighlightState | undefined,
  classPrefix: string,
): string {
  if (element.hasAttribute(HIGHLIGHTED_ATTR)) {
    if (state && element.innerHTML === state.renderedHTML) {
      return state.source;
    }
    const lineClass = `${classPrefix}-line`;
    let lineCount = 0;
    for (const node of element.childNodes) {
      if (node instanceof Element && node.classList.contains(lineClass)) {
        lineCount++;
      }
    }
    if (lineCount > 0) {
      return getLineWrappedElementCode(
        element,
        lineCount,
        state?.source,
        classPrefix,
      );
    }
  }
  return element.textContent ?? "";
}

function getLineWrappedElementCode(
  element: Element,
  lineCount: number,
  previousSource: string | undefined,
  classPrefix: string,
): string {
  const lineEndings = previousSource?.match(/\r\n|\r|\n/g) ?? [];
  const lineClass = `${classPrefix}-line`;
  const code: string[] = [];
  let lineIndex = 0;

  for (const node of element.childNodes) {
    appendSourceText(node, classPrefix, code);
    if (!(node instanceof Element) || !node.classList.contains(lineClass)) {
      continue;
    }
    if (lineIndex < lineCount - 1) {
      code.push(lineEndings[lineIndex] ?? "\n");
    }
    lineIndex++;
  }

  return code.join("");
}

function appendSourceText(
  node: Node,
  classPrefix: string,
  output: string[],
): void {
  if (node instanceof Text) {
    output.push(node.data);
    return;
  }
  if (!(node instanceof Element)) return;
  if (
    node.classList.contains(`${classPrefix}-line-number`) ||
    node.classList.contains(`${classPrefix}-diff-gutter`)
  ) {
    return;
  }

  for (const child of node.childNodes) {
    appendSourceText(child, classPrefix, output);
  }
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
    maxMatchCount,
    maxTokenCount,
    maxRenderedLength,
    maxLines,
    maxTokenDepth,
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
        maxMatchCount,
        maxTokenCount,
        maxRenderedLength,
        maxLines,
        maxTokenDepth,
      },
      { force, onError },
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
    maxMatchCount,
    maxTokenCount,
    maxRenderedLength,
    maxLines,
    maxTokenDepth,
    force = false,
    onError,
  } = options;

  const root = container ?? (typeof document !== "undefined" ? document.body : null);
  if (!root) return () => {};

  const registry = createRegistry(languages);
  const resolvedTheme = theme ? resolveThemeOrThrow(theme) : undefined;
  // Resolve the selector before allocating theme resources so setup failures
  // cannot leak an injected stylesheet.
  const elements = root.querySelectorAll(selector);

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
    maxMatchCount,
    maxTokenCount,
    maxRenderedLength,
    maxLines,
    maxTokenDepth,
  };

  // Initial scan
  for (const element of elements) {
    if (!root.contains(element)) continue;
    tryHighlightElement(element, registry, languages, highlightOpts, {
      force,
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
    const externallyChangedHighlighted = new Set<Element>();
    const addedMatches = new Set<Element>();
    const skippedInternalRecords = new Set<Element>();

    for (const mutation of mutations) {
      const target =
        mutation.target instanceof Element
          ? mutation.target
          : mutation.target.parentElement;
      if (
        target?.matches(selector) &&
        !target.hasAttribute(HIGHLIGHTED_ATTR) &&
        !target.parentElement?.closest(`[${HIGHLIGHTED_ATTR}]`)
      ) {
        addedMatches.add(target);
      }
      const highlighted = target?.closest(`[${HIGHLIGHTED_ATTR}]`);
      if (highlighted?.matches(selector)) {
        changedHighlighted.add(highlighted);
      }

      // Setting innerHTML during highlighting produces one child-list record
      // whose target is the highlighted element. Avoid walking the generated
      // token spans. External records batched with it are still processed.
      if (
        highlighted &&
        internallyMutated.has(highlighted) &&
        !skippedInternalRecords.has(highlighted) &&
        mutation.type === "childList" &&
        mutation.target === highlighted
      ) {
        skippedInternalRecords.add(highlighted);
        continue;
      }

      if (highlighted?.matches(selector)) {
        externallyChangedHighlighted.add(highlighted);
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
        if (!externallyChangedHighlighted.has(element)) continue;
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
