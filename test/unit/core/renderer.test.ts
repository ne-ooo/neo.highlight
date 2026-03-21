import { describe, it, expect } from "vitest";
import { renderToHTML } from "../../../src/core/renderer";
import { tokenize } from "../../../src/core/tokenizer";
import { javascript } from "../../../src/grammars/javascript";
import { css } from "../../../src/grammars/css";
import { python } from "../../../src/grammars/python";
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

  describe("multi-line token handling", () => {
    it("each line should be a self-contained span with balanced tags", () => {
      // Token that spans 2 lines (like CSS selector spanning comment + :root)
      const tokens: Token[] = [
        {
          type: "selector",
          content: "first\nsecond",
          length: 12,
        },
      ];
      const html = renderToHTML(tokens, { lineNumbers: true });

      // Each neo-hl-line should have balanced open/close spans
      const lineSpans = html.match(/<span class="neo-hl-line">.*?<\/span><\/span>(?:<\/span>)*/g);
      expect(lineSpans).not.toBeNull();
      for (const line of lineSpans!) {
        const opens = (line.match(/<span/g) || []).length;
        const closes = (line.match(/<\/span>/g) || []).length;
        expect(opens).toBe(closes);
      }
    });

    it("each line should contain exactly one line-number", () => {
      const tokens: Token[] = [
        {
          type: "selector",
          content: "line1\nline2\nline3",
          length: 17,
        },
      ];
      const html = renderToHTML(tokens, { lineNumbers: true });

      const numberCount = (html.match(/neo-hl-line-number/g) || []).length;
      expect(numberCount).toBe(3);
    });

    it("no neo-hl-line should be nested inside another neo-hl-line", () => {
      const tokens: Token[] = [
        {
          type: "comment",
          content: "/* line1 */",
          length: 11,
        },
        {
          type: "selector",
          content: "\n:root",
          length: 6,
        },
      ];
      const html = renderToHTML(tokens, { lineNumbers: true });

      // Split by line boundaries — each segment should only have ONE line-number
      const segments = html.split(/<span class="neo-hl-line">/g).filter(Boolean);
      for (const seg of segments) {
        const lineNumCount = (seg.match(/neo-hl-line-number/g) || []).length;
        expect(lineNumCount).toBeLessThanOrEqual(1);
      }
    });

    it("should handle CSS with multi-line selectors correctly", () => {
      const code = `/* comment */\n:root {\n  --color: #fff;\n}`;
      const tokens = tokenize(code, css);
      const html = renderToHTML(tokens, { lineNumbers: true });

      // Must have exactly 4 line numbers
      const numbers = html.match(/neo-hl-line-number/g) || [];
      expect(numbers.length).toBe(4);

      // Each neo-hl-line should have exactly 1 line-number
      const lineBlocks = html.split(/<span class="neo-hl-line">/g).filter(s => s.includes("neo-hl-line-number"));
      for (const block of lineBlocks) {
        const count = (block.match(/neo-hl-line-number/g) || []).length;
        expect(count).toBe(1);
      }
    });

    it("should handle real CSS with empty lines between selectors", () => {
      const code = `/* comment */\n:root {\n  --x: 1;\n}\n\n.card {\n  color: red;\n}`;
      const tokens = tokenize(code, css);
      const html = renderToHTML(tokens, { lineNumbers: true });

      const numbers = html.match(/neo-hl-line-number/g) || [];
      expect(numbers.length).toBe(8);

      // Verify line numbers are sequential 1-8
      for (let i = 1; i <= 8; i++) {
        expect(html).toContain(`neo-hl-line-number">${i}</span>`);
      }
    });

    it("should handle Python multi-line strings correctly", () => {
      const code = `x = """line1\nline2\nline3"""`;
      const tokens = tokenize(code, python);
      const html = renderToHTML(tokens, { lineNumbers: true });

      const numbers = html.match(/neo-hl-line-number/g) || [];
      expect(numbers.length).toBe(3);
    });

    it("should not have newlines between line spans", () => {
      const tokens: Token[] = ["line1\nline2"];
      const html = renderToHTML(tokens, { lineNumbers: true });

      // After a closing </span> for neo-hl-line, the next char should be < not \n
      expect(html).not.toMatch(/<\/span>\s*\n\s*<span class="neo-hl-line">/);
    });

    it("reopened tags should preserve original classes", () => {
      const tokens: Token[] = [
        {
          type: "string",
          content: '"first\nsecond"',
          alias: "template-string",
          length: 14,
        },
      ];
      const html = renderToHTML(tokens, { lineNumbers: true });

      // Line 2 content should have the string+alias span reopened
      const afterLine2 = html.split('neo-hl-line-number">2</span>')[1] ?? '';
      expect(afterLine2).toContain("neo-hl-string");
      expect(afterLine2).toContain("neo-hl-template-string");
    });
  });
});
