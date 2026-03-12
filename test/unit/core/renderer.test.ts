import { describe, it, expect } from "vitest";
import { renderToHTML } from "../../../src/core/renderer";
import { tokenize } from "../../../src/core/tokenizer";
import { javascript } from "../../../src/grammars/javascript";
import { githubDark } from "../../../src/themes/github-dark";
import type { Token, TokenNode } from "../../../src/core/types";

describe("renderToHTML", () => {
  it("should render plain text tokens", () => {
    const tokens: Token[] = ["hello world"];
    const html = renderToHTML(tokens, { wrapCode: false });
    expect(html).toBe("hello world");
  });

  it("should render token nodes with CSS classes", () => {
    const tokens: Token[] = [
      {
        type: "keyword",
        content: "const",
        length: 5,
      },
      " x = ",
      {
        type: "number",
        content: "42",
        length: 2,
      },
    ];
    const html = renderToHTML(tokens, { wrapCode: false });
    expect(html).toContain('<span class="neo-hl-keyword">const</span>');
    expect(html).toContain('<span class="neo-hl-number">42</span>');
    expect(html).toContain(" x = ");
  });

  it("should escape HTML special characters", () => {
    const tokens: Token[] = ['<div class="test">&amp;</div>'];
    const html = renderToHTML(tokens, { wrapCode: false });
    expect(html).toBe('&lt;div class=&quot;test&quot;&gt;&amp;amp;&lt;/div&gt;');
  });

  it("should wrap in pre/code tags by default", () => {
    const tokens: Token[] = ["hello"];
    const html = renderToHTML(tokens);
    expect(html).toMatch(/^<pre class="neo-hl"[^>]*><code class="neo-hl-code">hello<\/code><\/pre>$/);
  });

  it("should include data-language attribute", () => {
    const tokens: Token[] = ["hello"];
    const html = renderToHTML(tokens, { language: "javascript" });
    expect(html).toContain('data-language="javascript"');
  });

  it("should handle token aliases", () => {
    const tokens: Token[] = [
      {
        type: "template-string",
        content: "`hello`",
        alias: "string",
        length: 7,
      },
    ];
    const html = renderToHTML(tokens, { wrapCode: false });
    expect(html).toContain('class="neo-hl-template-string neo-hl-string"');
  });

  it("should handle array aliases", () => {
    const tokens: Token[] = [
      {
        type: "important",
        content: "TODO",
        alias: ["comment", "tag"],
        length: 4,
      },
    ];
    const html = renderToHTML(tokens, { wrapCode: false });
    expect(html).toContain('class="neo-hl-important neo-hl-comment neo-hl-tag"');
  });

  it("should render nested tokens", () => {
    const tokens: Token[] = [
      {
        type: "template-string",
        content: [
          "`hello ",
          {
            type: "interpolation",
            content: "${name}",
            length: 7,
          },
          "`",
        ],
        length: 15,
      },
    ];
    const html = renderToHTML(tokens, { wrapCode: false });
    expect(html).toContain('<span class="neo-hl-template-string">');
    expect(html).toContain('<span class="neo-hl-interpolation">${name}</span>');
  });

  it("should use custom class prefix", () => {
    const tokens: Token[] = [
      { type: "keyword", content: "const", length: 5 },
    ];
    const html = renderToHTML(tokens, { classPrefix: "hl", wrapCode: false });
    expect(html).toContain('class="hl-keyword"');
  });

  it("should render line numbers when enabled", () => {
    const tokens: Token[] = ["line1\nline2\nline3"];
    const html = renderToHTML(tokens, { lineNumbers: true });
    expect(html).toContain('class="neo-hl-line-number">1</span>');
    expect(html).toContain('class="neo-hl-line-number">2</span>');
    expect(html).toContain('class="neo-hl-line-number">3</span>');
  });

  it("should highlight specific lines", () => {
    const tokens: Token[] = ["line1\nline2\nline3"];
    const html = renderToHTML(tokens, { highlightLines: [2] });
    expect(html).toContain("neo-hl-line-highlighted");
    // Line 1 and 3 should not be highlighted
    const lines = html.split("\n");
    const highlightedCount = lines.filter((l) => l.includes("neo-hl-line-highlighted")).length;
    expect(highlightedCount).toBe(1);
  });

  it("should apply theme inline styles when theme is provided", () => {
    const tokens: Token[] = ["hello"];
    const html = renderToHTML(tokens, { theme: githubDark });
    expect(html).toContain("background:");
    expect(html).toContain(githubDark.background);
  });

  it("should render real JavaScript code correctly", () => {
    const code = 'const x = 42;';
    const tokens = tokenize(code, javascript);
    const html = renderToHTML(tokens, { wrapCode: false });
    expect(html).toContain('<span class="neo-hl-keyword">const</span>');
    expect(html).toContain('<span class="neo-hl-number">42</span>');
    expect(html).toContain('<span class="neo-hl-punctuation">;</span>');
  });

  it("should handle empty tokens", () => {
    const html = renderToHTML([], { wrapCode: false });
    expect(html).toBe("");
  });
});
