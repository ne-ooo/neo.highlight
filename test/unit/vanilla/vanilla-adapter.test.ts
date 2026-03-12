import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { highlight } from "../../../src/vanilla/highlight";
import { autoHighlight, scan } from "../../../src/vanilla/auto-highlight";
import { javascript } from "../../../src/grammars/javascript";
import { python } from "../../../src/grammars/python";
import { githubDark } from "../../../src/themes/github-dark";

describe("highlight (vanilla)", () => {
  it("should return highlighted HTML string", () => {
    const html = highlight("const x = 42;", javascript);
    expect(html).toContain("neo-hl-keyword");
    expect(html).toContain("neo-hl-number");
    expect(html).toContain("<pre");
    expect(html).toContain("<code");
  });

  it("should include data-language attribute", () => {
    const html = highlight("const x = 42;", javascript);
    expect(html).toContain('data-language="javascript"');
  });

  it("should apply theme when provided", () => {
    const html = highlight("const x = 42;", javascript, { theme: githubDark });
    expect(html).toContain(githubDark.background);
  });

  it("should show line numbers when enabled", () => {
    const html = highlight("line 1\nline 2", javascript, { lineNumbers: true });
    expect(html).toContain("neo-hl-line-number");
  });

  it("should highlight specific lines", () => {
    const html = highlight("a\nb\nc", javascript, { highlightLines: [2] });
    expect(html).toContain("neo-hl-line-highlighted");
  });

  it("should not wrap in pre/code when wrapCode is false", () => {
    const html = highlight("const x = 42;", javascript, { wrapCode: false });
    expect(html).not.toContain("<pre");
    expect(html).not.toContain("<code");
    expect(html).toContain("neo-hl-keyword");
  });

  it("should use custom class prefix", () => {
    const html = highlight("const x = 42;", javascript, { classPrefix: "hl" });
    expect(html).toContain("hl-keyword");
    expect(html).not.toContain("neo-hl-keyword");
  });

  it("should highlight Python code correctly", () => {
    const html = highlight("def hello():\n    print('hi')", python);
    expect(html).toContain("neo-hl-keyword");
    expect(html).toContain('data-language="python"');
  });
});

describe("scan (vanilla)", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should highlight code blocks in container", () => {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = "language-js";
    code.textContent = "const x = 42;";
    pre.appendChild(code);
    container.appendChild(pre);

    const count = scan({
      languages: [javascript],
      container,
    });

    expect(count).toBe(1);
    expect(code.innerHTML).toContain("neo-hl-keyword");
  });
});

describe("autoHighlight (vanilla)", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should return a cleanup function", () => {
    const cleanup = autoHighlight({
      languages: [javascript],
      container,
    });
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("should scan existing code blocks", () => {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = "language-js";
    code.textContent = "const x = 42;";
    pre.appendChild(code);
    container.appendChild(pre);

    const cleanup = autoHighlight({
      languages: [javascript],
      container,
      observe: false,
    });

    expect(code.innerHTML).toContain("neo-hl-keyword");
    cleanup();
  });
});
