const CSS_IDENTIFIER = /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/;
const UNSAFE_CSS_VALUE = /[;{}<>\u0000-\u001f\u007f]|\/\*|\*\//;
const UNSAFE_CSS_FUNCTION = /(?:url|expression)\s*\(/i;
const UNSAFE_CSS_SELECTOR = /[;{}<>\u0000-\u001f\u007f]|\/\*|\*\//;

/** Escape text for an HTML text node. */
export function escapeHTML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape a value for a quoted HTML attribute. */
export function escapeHTMLAttribute(value: string): string {
  return escapeHTML(value);
}

/**
 * Restrict generated class names and custom-property names to a conservative
 * ASCII CSS identifier subset. This avoids both HTML attribute injection and
 * selector/custom-property injection in generated stylesheets.
 */
export function assertSafeCssIdentifier(value: string, label: string): void {
  if (!CSS_IDENTIFIER.test(value)) {
    throw new TypeError(`${label} must be a safe CSS identifier`);
  }
}

/**
 * Theme fields are CSS values, not arbitrary declarations. Reject characters
 * that can terminate a declaration/style element and functions that can load
 * external resources or execute in legacy CSS engines.
 */
export function assertSafeCssValue(value: string, label: string): void {
  if (
    value.length === 0 ||
    UNSAFE_CSS_VALUE.test(value) ||
    UNSAFE_CSS_FUNCTION.test(value)
  ) {
    throw new TypeError(`${label} must be a safe CSS color value`);
  }
}

/** Validate a selector fragment before interpolating it into a stylesheet. */
export function assertSafeCssSelector(value: string, label: string): void {
  if (value.length === 0 || UNSAFE_CSS_SELECTOR.test(value)) {
    throw new TypeError(`${label} must be a safe CSS selector`);
  }
}
