import type { RenderAttributes, RenderHooks } from "./types";
import { assertSafeCssIdentifier, escapeHTMLAttribute } from "./safety";

/** Check callback configuration before rendering any source. */
export function validateRenderHooks(hooks: RenderHooks): void {
  if (!hooks || typeof hooks !== "object") throw new TypeError("hooks must be an object");
  for (const key of ["token", "line", "code", "pre"] as const) {
    if (hooks[key] !== undefined && typeof hooks[key] !== "function") throw new TypeError(`hooks.${key} must be a function`);
  }
}

/** Decorate one generated opening tag. No user HTML enters this operation. */
export function decorateTag(tag: string, additions: RenderAttributes | void): string {
  if (additions === undefined) return tag;
  if (!additions || typeof additions !== "object" || Array.isArray(additions) || "then" in additions) throw new TypeError("A render hook must return attributes or undefined");
  if (additions.class !== undefined) {
    const classes = typeof additions.class === "string" ? additions.class.split(/\s+/).filter(Boolean) : additions.class;
    if (!Array.isArray(classes)) throw new TypeError("Hook classes must be a string or an array");
    for (const name of classes) {
      if (typeof name !== "string") throw new TypeError("Hook classes must be strings");
      assertSafeCssIdentifier(name, "hook class");
    }
    if (classes.length) {
      // The opening tag and its first class attribute come from this renderer.
      const end = tag.indexOf('"', tag.indexOf('class="') + 7);
      tag = tag.slice(0, end) + " " + classes.join(" ") + tag.slice(end);
    }
  }
  let attributes = "";
  if (additions.attributes !== undefined) {
    if (!additions.attributes || typeof additions.attributes !== "object" || Array.isArray(additions.attributes)) throw new TypeError("Hook attributes must be an object");
    for (const [name, value] of Object.entries(additions.attributes)) {
      if (!/^(?:id|title|role|tabindex|data-[a-z0-9_.:-]+|aria-[a-z0-9-]+)$/.test(name)) throw new TypeError(`Unsupported hook attribute: ${name}`);
      if (value === undefined) continue;
      if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") throw new TypeError("Hook attribute values must be strings, numbers, or booleans");
      if (typeof value === "number" && !Number.isFinite(value)) throw new TypeError("Hook attribute numbers must be finite");
      // Built-in attributes keep their meaning, including data-language.
      if (tag.includes(` ${name}="`)) throw new TypeError(`Hook attribute conflicts with generated attribute: ${name}`);
      attributes += ` ${name}="${escapeHTMLAttribute(String(value))}"`;
    }
  }
  return tag.slice(0, -1) + attributes + ">";
}
