import { describe, it, expect } from "vitest";
import { renderToHTML } from "../../../src/core/renderer";
import { tokenize } from "../../../src/core/tokenizer";
import { javascript } from "../../../src/grammars/javascript";
import { css } from "../../../src/grammars/css";
import { python } from "../../../src/grammars/python";
import { githubDark } from "../../../src/themes/github-dark";
import type { Token, TokenNode } from "../../../src/core/types";

function parseRenderedHTML(html: string): HTMLDivElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}

function getAssistiveText(node: Node): string {
  if (node instanceof HTMLElement && node.getAttribute("aria-hidden") === "true") {
    return "";
  }
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  return [...node.childNodes].map(getAssistiveText).join("");
}

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

  it("should escape the complete data-language attribute", () => {
    const html = renderToHTML(["hello"], {
      language: 'js&<"\'',
    });
    expect(html).toContain('data-language="js&amp;&lt;&quot;&#39;"');
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

  it("should reject unsafe class names from custom tokens", () => {
    const tokens: Token[] = [
      {
        type: 'keyword" onmouseover="alert(1)',
        content: "const",
        length: 5,
      },
    ];
    expect(() => renderToHTML(tokens, { wrapCode: false })).toThrow(
      /token type/i,
    );
  });

  it("should reject unsafe aliases from custom tokens", () => {
    const tokens: Token[] = [
      {
        type: "keyword",
        alias: 'string\" onmouseover=\"alert(1)',
        content: "const",
        length: 5,
      },
    ];
    expect(() => renderToHTML(tokens, { wrapCode: false })).toThrow(
      /token alias/i,
    );
  });

  it("should reject an unsafe class prefix", () => {
    expect(() =>
      renderToHTML(["hello"], {
        classPrefix: 'neo" onmouseover="alert(1)',
      }),
    ).toThrow(/class prefix/i);
  });

  it("should render line numbers when enabled", () => {
    const tokens: Token[] = ["line1\nline2\nline3"];
    const html = renderToHTML(tokens, { lineNumbers: true });
    const numbers = parseRenderedHTML(html).querySelectorAll(
      ".neo-hl-line-number",
    );
    expect([...numbers].map((number) => number.textContent)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("hides decorative line numbers and diff gutters from assistive text", () => {
    const html = renderToHTML(["alpha\nbeta"], {
      lineNumbers: true,
      diffHighlight: { added: [1], modified: [2] },
    });
    const container = parseRenderedHTML(html);
    const decorations = container.querySelectorAll(
      ".neo-hl-line-number, .neo-hl-diff-gutter",
    );
    const lines = container.querySelectorAll(".neo-hl-line");

    expect(decorations).toHaveLength(4);
    expect([...decorations].every((item) => item.getAttribute("aria-hidden") === "true"))
      .toBe(true);
    expect([...lines].map(getAssistiveText)).toEqual(["alpha", "beta"]);
  });

  it("should treat CRLF and bare CR as line boundaries", () => {
    const html = renderToHTML(["windows\r\nclassic\rmac"], {
      lineNumbers: true,
    });
    const lines = parseRenderedHTML(html).querySelectorAll(
      ".neo-hl-line-content",
    );

    expect([...lines].map((line) => line.textContent)).toEqual([
      "windows",
      "classic",
      "mac",
    ]);
    expect(html).not.toContain("\r");
  });

  it("should use the active line-number color on highlighted lines", () => {
    const html = renderToHTML(["line1\nline2"], {
      theme: githubDark,
      lineNumbers: true,
      highlightLines: [2],
    });
    const line2Number = parseRenderedHTML(html).querySelector(
      ".neo-hl-line-highlighted .neo-hl-line-number",
    );

    expect(line2Number?.getAttribute("style")).toContain(
      `var(--neo-hl-line-number-active, ${githubDark.lineNumberActive})`,
    );
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

  it("should apply token colors without a separate stylesheet", () => {
    const tokens = tokenize("const x = 42;", javascript);
    const html = renderToHTML(tokens, { theme: githubDark });
    expect(html).toContain(
      `color: var(--neo-hl-keyword, ${githubDark.tokenColors.keyword})`,
    );
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

  it("should enforce token, output, and line budgets", () => {
    const nodes: Token[] = Array.from({ length: 5 }, () => ({
      type: "keyword",
      content: "x",
      length: 1,
    }));
    expect(() =>
      renderToHTML(nodes, { wrapCode: false, maxTokenCount: 4 }),
    ).toThrow(/maxTokenCount/i);
    expect(() =>
      renderToHTML(["<&"], { wrapCode: false, maxRenderedLength: 5 }),
    ).toThrow(/maxRenderedLength/i);
    expect(() =>
      renderToHTML(["a\nb\nc"], { wrapCode: false, maxLines: 2 }),
    ).toThrow(/maxLines/i);
  });

  it("should reject cyclic and overly deep public token trees", () => {
    const cyclic: TokenNode = {
      type: "cycle",
      content: [],
      length: 0,
    };
    (cyclic.content as Token[]).push(cyclic);
    expect(() => renderToHTML([cyclic], { wrapCode: false })).toThrow(/cycle/i);

    const nested: TokenNode = {
      type: "outer",
      content: [{
        type: "inner",
        content: "x",
        length: 1,
      }],
      length: 1,
    };
    expect(() =>
      renderToHTML([nested], { wrapCode: false, maxTokenDepth: 0 }),
    ).toThrow(/maxTokenDepth/i);
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

      const container = parseRenderedHTML(html);
      const code = container.querySelector("code");
      const lines = code?.querySelectorAll(":scope > .neo-hl-line") ?? [];

      expect(lines).toHaveLength(2);
      expect(code?.children).toHaveLength(2);
      expect(lines[0]?.querySelector(".neo-hl-selector")?.textContent).toBe(
        "first",
      );
      expect(lines[1]?.querySelector(".neo-hl-selector")?.textContent).toBe(
        "second",
      );
    });

    it("should preserve nested token spans across CRLF and bare CR", () => {
      const tokens: Token[] = [
        {
          type: "comment",
          content: [
            "first\r\n",
            { type: "important", content: "second\rthird", length: 12 },
          ],
          length: 19,
        },
      ];
      const html = renderToHTML(tokens, { lineNumbers: true });
      const lines = parseRenderedHTML(html).querySelectorAll(".neo-hl-line");

      expect(lines).toHaveLength(3);
      expect([...lines].map((line) => line.textContent?.replace(/^\d/, "")))
        .toEqual(["first", "second", "third"]);
      expect(lines[1]?.querySelector(".neo-hl-comment .neo-hl-important"))
        .not.toBeNull();
      expect(lines[2]?.querySelector(".neo-hl-comment .neo-hl-important"))
        .not.toBeNull();
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

      const lines = parseRenderedHTML(html).querySelectorAll(".neo-hl-line");

      expect(lines).toHaveLength(2);
      for (const line of lines) {
        expect(line.querySelectorAll(".neo-hl-line")).toHaveLength(0);
        expect(line.querySelectorAll(".neo-hl-line-number")).toHaveLength(1);
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
      const lines = parseRenderedHTML(html).querySelectorAll(".neo-hl-line");
      expect(lines).toHaveLength(4);
      for (const line of lines) {
        expect(line.querySelectorAll(".neo-hl-line-number")).toHaveLength(1);
      }
    });

    it("should handle real CSS with empty lines between selectors", () => {
      const code = `/* comment */\n:root {\n  --x: 1;\n}\n\n.card {\n  color: red;\n}`;
      const tokens = tokenize(code, css);
      const html = renderToHTML(tokens, { lineNumbers: true });

      const numbers = html.match(/neo-hl-line-number/g) || [];
      expect(numbers.length).toBe(8);

      // Verify line numbers are sequential 1-8
      const renderedNumbers = parseRenderedHTML(html).querySelectorAll(
        ".neo-hl-line-number",
      );
      expect([...renderedNumbers].map((number) => number.textContent)).toEqual(
        Array.from({ length: 8 }, (_, index) => String(index + 1)),
      );
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

    it("should make each generated line a block without external CSS", () => {
      const html = renderToHTML(["line1\nline2"], { lineNumbers: true });
      expect(html.match(/style="display: block"/g)).toHaveLength(2);
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
      const line2 = parseRenderedHTML(html).querySelectorAll(".neo-hl-line")[1];
      const reopened = line2?.querySelector(
        ".neo-hl-string.neo-hl-template-string",
      );
      expect(reopened?.textContent).toBe('second"');
    });
  });
});
