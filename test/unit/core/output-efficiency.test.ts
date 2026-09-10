import { describe, it, expect, afterEach } from "vitest";
import { renderToHTML, getThemeStylesheet } from "../../../src/core/renderer";
import { getDualThemeStylesheet } from "../../../src/core/themes";
import { tokenize } from "../../../src/core/tokenizer";
import { scan } from "../../../src/core/scanner";
import { javascript } from "../../../src/grammars/javascript";
import { githubDark } from "../../../src/themes/github-dark";
import { githubLight } from "../../../src/themes/github-light";
import type { Token, Theme } from "../../../src/core/types";

// JSDOM does not resolve custom properties. Substitute known literal colors so
// the browser CSS cascade can check selector specificity and theme scoping.
function literalCSS(css: string, theme: Theme, prefix: string): string {
  const values: Record<string, string | undefined> = {
    ...theme.tokenColors, bg: theme.background, fg: theme.foreground,
    "line-number": theme.lineNumber, "line-number-active": theme.lineNumberActive,
    "line-highlight": theme.lineHighlight, "diff-added-bg": theme.diffAddedBg,
    "diff-removed-bg": theme.diffRemovedBg, "diff-modified-bg": theme.diffModifiedBg,
  };
  return css.replace(new RegExp(`var\\(--${prefix}-([\\w-]+)\\)`, "g"), (_, key: string) => values[key] ?? "inherit");
}
function mount(css: string, html: string): void {
  document.head.innerHTML = `<style>${css}</style>`;
  document.body.innerHTML = html;
}
function color(selector: string, property = "color"): string {
  return getComputedStyle(document.querySelector(selector)!).getPropertyValue(property);
}
afterEach(() => { document.head.innerHTML = ""; document.body.innerHTML = ""; });

describe("class output", () => {
  it("preserves escaped source and token classes without inline attributes", () => {
    const source = 'const text = `<tag>${"<&>"}</tag>`;\r\n// café 😀\n';
    const tokens = tokenize(source, javascript);
    const inline = renderToHTML(tokens, { theme: githubDark });
    const html = renderToHTML(tokens, { theme: githubDark, styleMode: "class" });
    document.body.innerHTML = html;
    expect(document.querySelector("[style]")).toBeNull();
    // The HTML parser normalizes CRLF; the output string itself keeps it.
    expect(html).toContain("\r\n");
    expect(document.querySelector("code")!.textContent).toBe(source.replace(/\r\n/g, "\n"));
    expect(document.querySelector(".neo-hl-keyword")).not.toBeNull();
    expect(html.length).toBeLessThan(inline.length * 0.6);
    expect(renderToHTML(tokens, { theme: githubDark, styleMode: "inline" })).toBe(inline);
  });

  it("preserves primary and first-alias colors with conflicting stylesheet order", () => {
    const theme: Theme = { name: "aliases", background: "black", foreground: "white",
      tokenColors: { keyword: "red", string: "green", comment: "blue" } };
    const tokens: Token[] = [
      { type: "keyword", alias: ["string", "comment"], content: "one", length: 3 },
      { type: "custom", alias: ["string", "comment"], content: "two", length: 3 },
    ];
    mount(literalCSS(getThemeStylesheet(theme), theme, "neo-hl"), renderToHTML(tokens, { theme, styleMode: "class" }));
    expect(color(".neo-hl-keyword")).toBe("rgb(255, 0, 0)");
    expect(color(".neo-hl-custom")).toBe("rgb(0, 128, 0)");
  });

  it("preserves line layout, overlapping diff priority, and hidden gutters", () => {
    const theme: Theme = { ...githubDark, diffAddedBg: "green", diffRemovedBg: "red", diffModifiedBg: "orange" };
    const html = renderToHTML(["first\r", "\nsecond\nthird"], {
      theme, styleMode: "class", lineNumbers: true, highlightLines: [1, 2],
      diffHighlight: { added: [1], removed: [1, 2], modified: [1, 2, 3] },
    });
    mount(literalCSS(getThemeStylesheet(theme), theme, "neo-hl"), html);
    expect(document.querySelectorAll(".neo-hl-line")).toHaveLength(3);
    expect(color(".neo-hl-line", "display")).toBe("block");
    expect(color(".neo-hl-diff-added", "background-color")).toBe("rgb(0, 128, 0)");
    expect(color(".neo-hl-line:nth-child(2)", "background-color")).toBe("rgb(255, 0, 0)");
    expect(document.querySelectorAll('[aria-hidden="true"]')).toHaveLength(6);
    expect(document.querySelector("[style]")).toBeNull();
  });

  it("isolates multiple themes through distinct prefixes and supports dual-theme assets", () => {
    const tokens = tokenize("const x = 42", javascript);
    const css = literalCSS(getThemeStylesheet(githubDark, "night"), githubDark, "night")
      + literalCSS(getThemeStylesheet(githubLight, "day"), githubLight, "day");
    mount(css, renderToHTML(tokens, { theme: githubDark, classPrefix: "night", styleMode: "class" })
      + renderToHTML(tokens, { theme: githubLight, classPrefix: "day", styleMode: "class" }));
    expect(color(".night-keyword")).not.toBe(color(".day-keyword"));
    const dual = getDualThemeStylesheet(githubLight, githubDark, { darkSelector: ".dark" });
    expect(dual).toContain(".dark .neo-hl");
    expect(dual).toContain(".neo-hl-color-string[class]");
    expect(dual.indexOf(".neo-hl-diff-added {")).toBeGreaterThan(dual.indexOf(".neo-hl-diff-removed {"));
  });

  it("enforces limits, cycles, and unsafe theme or alias rejection in class mode", () => {
    const token: Token = { type: "string", content: "abc", length: 3 };
    const options = { styleMode: "class" as const, theme: githubDark };
    for (const limit of ["maxTokenCount", "maxRenderedLength", "maxLines"] as const) {
      expect(() => renderToHTML([token], { ...options, [limit]: 0 })).toThrow(limit);
    }
    const cycle: Token = { type: "string", content: [], length: 0 };
    (cycle.content as Token[]).push(cycle);
    expect(() => renderToHTML([cycle], options)).toThrow(/cycle/);
    expect(() => renderToHTML([{ ...token, content: [token] }], { ...options, maxTokenDepth: 0 })).toThrow(/maxTokenDepth/);
    expect(() => renderToHTML([{ ...token, alias: 'x" onclick="bad' }], options)).toThrow(/alias/);
    expect(() => renderToHTML([token], { ...options, theme: { ...githubDark, foreground: "url(evil)" } })).toThrow(/foreground/);
    expect(() => renderToHTML([token], { styleMode: "invalid" as "class" })).toThrow(/styleMode/);
  });

  it("does not reuse stale markup after callers mutate themes or aliases", () => {
    const theme: Theme = { ...githubDark, tokenColors: { ...githubDark.tokenColors, string: "red" } };
    const token: Token = { type: "custom", alias: ["string"], content: "x", length: 1 };
    expect(renderToHTML([token, token], { theme })).toContain("red");
    theme.tokenColors.string = "blue";
    expect(renderToHTML([token], { theme })).toContain("blue");
    token.alias = ["invalid alias"];
    expect(() => renderToHTML([token], { theme })).toThrow(/alias/);
  });

  it("supports fragments and forced DOM transitions between output modes", () => {
    const tokens = tokenize("const x = 1", javascript);
    expect(renderToHTML(tokens, { theme: githubDark, styleMode: "class", wrapCode: false })).not.toContain("<pre");
    document.body.innerHTML = '<pre><code class="language-js">const x = 1</code></pre>';
    scan({ languages: [javascript], theme: githubDark });
    expect(document.querySelector("code [style]")).not.toBeNull();
    scan({ languages: [javascript], theme: githubDark, styleMode: "class", force: true });
    expect(document.querySelector("code")!.getAttribute("style") ?? "").toBe("");
    expect(document.querySelector("code [style]")).toBeNull();
    expect(document.querySelector("code")!.textContent).toBe("const x = 1");
  });
});
