import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { scan, observe, autoHighlight } from "../../../src/core/scanner";
import { javascript } from "../../../src/grammars/javascript";
import { python } from "../../../src/grammars/python";
import { githubDark } from "../../../src/themes/github-dark";

function createCodeBlock(code: string, language: string): HTMLPreElement {
  const pre = document.createElement("pre");
  const codeEl = document.createElement("code");
  codeEl.className = `language-${language}`;
  codeEl.textContent = code;
  pre.appendChild(codeEl);
  return pre;
}

describe("scan", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should highlight code blocks matching the selector", () => {
    container.appendChild(createCodeBlock("const x = 42;", "js"));
    const count = scan({
      languages: [javascript],
      container,
    });
    expect(count).toBe(1);
    const code = container.querySelector("code");
    expect(code?.innerHTML).toContain("neo-hl-keyword");
    expect(code?.getAttribute("data-neo-highlighted")).toBe("true");
  });

  it("should skip non-matching languages", () => {
    container.appendChild(createCodeBlock("const x = 42;", "rust"));
    const count = scan({
      languages: [javascript],
      container,
    });
    expect(count).toBe(0);
  });

  it("should detect language from class attribute", () => {
    container.appendChild(createCodeBlock("def hello():", "python"));
    const count = scan({
      languages: [python],
      container,
    });
    expect(count).toBe(1);
    const code = container.querySelector("code");
    expect(code?.innerHTML).toContain("neo-hl-keyword");
  });

  it("should detect language from data-language attribute", () => {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.setAttribute("data-language", "js");
    code.textContent = "const x = 42;";
    pre.appendChild(code);
    container.appendChild(pre);

    const count = scan({
      languages: [javascript],
      container,
    });
    expect(count).toBe(1);
  });

  it("should not re-highlight already highlighted elements", () => {
    container.appendChild(createCodeBlock("const x = 42;", "js"));
    const count1 = scan({ languages: [javascript], container });
    const count2 = scan({ languages: [javascript], container });
    expect(count1).toBe(1);
    expect(count2).toBe(0);
  });

  it("should highlight multiple code blocks", () => {
    container.appendChild(createCodeBlock("const x = 42;", "js"));
    container.appendChild(createCodeBlock("def hello():", "py"));
    const count = scan({
      languages: [javascript, python],
      container,
    });
    expect(count).toBe(2);
  });

  it("should use custom selector", () => {
    const div = document.createElement("div");
    const code = document.createElement("code");
    code.className = "language-js";
    code.textContent = "const x = 42;";
    div.appendChild(code);
    container.appendChild(div);

    const count = scan({
      languages: [javascript],
      container,
      selector: "div code",
    });
    expect(count).toBe(1);
  });

  it("should skip empty code blocks", () => {
    const pre = document.createElement("pre");
    const code = document.createElement("code");
    code.className = "language-js";
    code.textContent = "";
    pre.appendChild(code);
    container.appendChild(pre);

    const count = scan({ languages: [javascript], container });
    expect(count).toBe(0);
  });

  it("should add the highlight CSS class to code elements", () => {
    container.appendChild(createCodeBlock("const x = 42;", "js"));
    scan({ languages: [javascript], container });
    const code = container.querySelector("code");
    expect(code?.classList.contains("neo-hl")).toBe(true);
  });
});

describe("observe", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should highlight existing code blocks on init", () => {
    container.appendChild(createCodeBlock("const x = 42;", "js"));
    const cleanup = observe({ languages: [javascript], container });
    const code = container.querySelector("code");
    expect(code?.innerHTML).toContain("neo-hl-keyword");
    cleanup();
  });

  it("should return a cleanup function", () => {
    const cleanup = observe({ languages: [javascript], container });
    expect(typeof cleanup).toBe("function");
    cleanup();
  });
});

describe("autoHighlight", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should scan without observe when observe=false", () => {
    container.appendChild(createCodeBlock("const x = 42;", "js"));
    const cleanup = autoHighlight({
      languages: [javascript],
      container,
      observe: false,
    });
    const code = container.querySelector("code");
    expect(code?.innerHTML).toContain("neo-hl-keyword");
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("should observe when observe=true", () => {
    const cleanup = autoHighlight({
      languages: [javascript],
      container,
      observe: true,
    });
    expect(typeof cleanup).toBe("function");
    cleanup();
  });
});
