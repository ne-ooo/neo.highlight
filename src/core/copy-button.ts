/* -------------------------------------------------------------------------------------------------
 * Copy Button — Copy-to-clipboard utilities for code blocks
 * -----------------------------------------------------------------------------------------------*/

const DEFAULT_CLASS_PREFIX = "neo-hl";
const DEFAULT_LABEL = "Copy";
const DEFAULT_COPIED_LABEL = "Copied!";
const COPIED_DURATION = 2000;

export interface CopyButtonOptions {
  /** Button label (default: "Copy") */
  label?: string | undefined;
  /** Label shown after copying (default: "Copied!") */
  copiedLabel?: string | undefined;
  /** CSS class prefix (default: "neo-hl") */
  classPrefix?: string | undefined;
}

/**
 * Render a copy button HTML string.
 * The button stores the code in a `data-code` attribute.
 *
 * @param code - The raw code to be copied
 * @param options - Button options
 * @returns HTML string for the copy button
 */
export function renderCopyButton(code: string, options: CopyButtonOptions = {}): string {
  const {
    label = DEFAULT_LABEL,
    copiedLabel = DEFAULT_COPIED_LABEL,
    classPrefix = DEFAULT_CLASS_PREFIX,
  } = options;

  const escapedCode = code
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<button class="${classPrefix}-copy-button" data-code="${escapedCode}" data-label="${label}" data-copied-label="${copiedLabel}" type="button" aria-label="${label}">${label}</button>`;
}

/**
 * Copy text to the clipboard.
 * Uses navigator.clipboard.writeText with execCommand fallback.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  // Modern API
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback for older browsers
  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      const success = document.execCommand("copy");
      document.body.removeChild(textarea);
      return success;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  }

  return false;
}

/**
 * Initialize click handlers for all copy buttons within a container.
 * Finds all buttons with the `neo-hl-copy-button` class and wires up click events.
 *
 * @param container - Container element to search in (default: document.body)
 * @param classPrefix - CSS class prefix (default: "neo-hl")
 * @returns Cleanup function to remove event listeners
 */
export function initCopyButtons(
  container?: Element | undefined,
  classPrefix = DEFAULT_CLASS_PREFIX,
): () => void {
  const root = container ?? (typeof document !== "undefined" ? document.body : null);
  if (!root) return () => {};

  const buttons = root.querySelectorAll<HTMLButtonElement>(`.${classPrefix}-copy-button`);
  const cleanups: Array<() => void> = [];

  for (const button of buttons) {
    const handler = () => {
      const code = button.getAttribute("data-code") ?? "";
      const label = button.getAttribute("data-label") ?? DEFAULT_LABEL;
      const copiedLabel = button.getAttribute("data-copied-label") ?? DEFAULT_COPIED_LABEL;

      void copyToClipboard(code).then((success) => {
        if (success) {
          button.textContent = copiedLabel;
          button.classList.add(`${classPrefix}-copy-button-copied`);

          setTimeout(() => {
            button.textContent = label;
            button.classList.remove(`${classPrefix}-copy-button-copied`);
          }, COPIED_DURATION);
        }
      });
    };

    button.addEventListener("click", handler);
    cleanups.push(() => button.removeEventListener("click", handler));
  }

  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
  };
}
