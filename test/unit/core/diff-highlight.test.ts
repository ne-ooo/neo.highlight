import { describe, it, expect } from "vitest";
import { renderToHTML } from "../../../src/core/renderer";
import { tokenize } from "../../../src/core/tokenizer";
import { getThemeCSS } from "../../../src/core/themes";
import { javascript } from "../../../src/grammars/javascript";
import type { Theme } from "../../../src/core/types";

const code = `const a = 1;
let b = 2;
const c = 3;
let d = 4;
const e = 5;`;

const tokens = tokenize(code, javascript);

describe("Diff Highlighting — Renderer", () => {
  it("adds diff-added class to added lines", () => {
    const html = renderToHTML(tokens, {
      diffHighlight: { added: [1, 3] },
    });
    expect(html).toContain("neo-hl-diff-added");
    // Lines 1 and 3 should have the class
    const lines = html.match(/neo-hl-diff-added/g);
    expect(lines).toHaveLength(2);
  });

  it("adds diff-removed class to removed lines", () => {
    const html = renderToHTML(tokens, {
      diffHighlight: { removed: [2, 4] },
    });
    expect(html).toContain("neo-hl-diff-removed");
    const lines = html.match(/neo-hl-diff-removed/g);
    expect(lines).toHaveLength(2);
  });

  it("adds diff-modified class to modified lines", () => {
    const html = renderToHTML(tokens, {
      diffHighlight: { modified: [5] },
    });
    expect(html).toContain("neo-hl-diff-modified");
    const lines = html.match(/neo-hl-diff-modified/g);
    expect(lines).toHaveLength(1);
  });

  it("adds + gutter marker to added lines", () => {
    const html = renderToHTML(tokens, {
      diffHighlight: { added: [1] },
    });
    expect(html).toContain('class="neo-hl-diff-gutter">+</span>');
  });

  it("adds - gutter marker to removed lines", () => {
    const html = renderToHTML(tokens, {
      diffHighlight: { removed: [2] },
    });
    expect(html).toContain('class="neo-hl-diff-gutter">-</span>');
  });

  it("adds ~ gutter marker to modified lines", () => {
    const html = renderToHTML(tokens, {
      diffHighlight: { modified: [3] },
    });
    expect(html).toContain('class="neo-hl-diff-gutter">~</span>');
  });

  it("combines diff with line numbers", () => {
    const html = renderToHTML(tokens, {
      lineNumbers: true,
      diffHighlight: { added: [1], removed: [2] },
    });
    // Should have both gutter and line number spans
    expect(html).toContain("neo-hl-diff-gutter");
    expect(html).toContain("neo-hl-line-number");
  });

  it("combines diff with line highlighting", () => {
    const html = renderToHTML(tokens, {
      highlightLines: [1],
      diffHighlight: { added: [1] },
    });
    // Line 1 should have both highlight and diff classes
    expect(html).toContain("neo-hl-line-highlighted");
    expect(html).toContain("neo-hl-diff-added");
  });

  it("handles all three diff types simultaneously", () => {
    const html = renderToHTML(tokens, {
      diffHighlight: { added: [1], removed: [2], modified: [3] },
    });
    expect(html).toContain("neo-hl-diff-added");
    expect(html).toContain("neo-hl-diff-removed");
    expect(html).toContain("neo-hl-diff-modified");
    // Each type appears once
    expect(html.match(/neo-hl-diff-added/g)).toHaveLength(1);
    expect(html.match(/neo-hl-diff-removed/g)).toHaveLength(1);
    expect(html.match(/neo-hl-diff-modified/g)).toHaveLength(1);
  });

  it("does not add diff classes to unmarked lines", () => {
    const html = renderToHTML(tokens, {
      diffHighlight: { added: [1] },
    });
    // Count how many times diff-added appears (should be 1 — only line 1)
    const addedCount = (html.match(/neo-hl-diff-added/g) ?? []).length;
    expect(addedCount).toBe(1);
    // Lines 2-5 should have plain line class without any diff class
    // Total lines = 5, diff lines = 1, so 4 lines are unmarked
    const allLineSpans = html.match(/<span class="neo-hl-line">/g) ?? [];
    expect(allLineSpans.length).toBe(4);
  });

  it("does not wrap lines when wrapCode is false", () => {
    const html = renderToHTML(tokens, {
      wrapCode: false,
      diffHighlight: { added: [1] },
    });
    // wrapCode: false returns raw token HTML without line wrapping
    expect(html).not.toContain("neo-hl-diff-added");
    expect(html).not.toContain("neo-hl-line");
  });

  it("uses custom class prefix for diff classes", () => {
    const html = renderToHTML(tokens, {
      classPrefix: "my-code",
      diffHighlight: { added: [1] },
    });
    expect(html).toContain("my-code-diff-added");
    expect(html).toContain("my-code-diff-gutter");
  });
});

describe("Diff Highlighting — Theme CSS", () => {
  const themeWithDiff: Theme = {
    name: "test-diff",
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    diffAddedBg: "rgba(46, 160, 67, 0.15)",
    diffRemovedBg: "rgba(248, 81, 73, 0.15)",
    diffModifiedBg: "rgba(210, 153, 34, 0.15)",
    tokenColors: {
      keyword: "#569cd6",
    },
  };

  it("generates diff-added CSS rule", () => {
    const css = getThemeCSS(themeWithDiff);
    expect(css).toContain("neo-hl-diff-added");
    expect(css).toContain("rgba(46, 160, 67, 0.15)");
  });

  it("generates diff-removed CSS rule", () => {
    const css = getThemeCSS(themeWithDiff);
    expect(css).toContain("neo-hl-diff-removed");
    expect(css).toContain("rgba(248, 81, 73, 0.15)");
  });

  it("generates diff-modified CSS rule", () => {
    const css = getThemeCSS(themeWithDiff);
    expect(css).toContain("neo-hl-diff-modified");
    expect(css).toContain("rgba(210, 153, 34, 0.15)");
  });

  it("generates diff-gutter CSS rule", () => {
    const css = getThemeCSS(themeWithDiff);
    expect(css).toContain("neo-hl-diff-gutter");
    expect(css).toContain("user-select: none");
  });

  it("does not generate diff CSS when no diff colors in theme", () => {
    const themeNoDiff: Theme = {
      name: "no-diff",
      background: "#fff",
      foreground: "#000",
      tokenColors: { keyword: "#00f" },
    };
    const css = getThemeCSS(themeNoDiff);
    expect(css).not.toContain("diff-added");
    expect(css).not.toContain("diff-removed");
    expect(css).not.toContain("diff-modified");
  });
});
