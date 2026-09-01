import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { scan, observe, autoHighlight } from "../../../src/core/scanner";
import { javascript } from "../../../src/grammars/javascript";
import { python } from "../../../src/grammars/python";
import { githubDark } from "../../../src/themes/github-dark";
import type { Grammar } from "../../../src/core/types";

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
    vi.unstubAllGlobals();
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

  it("should render line numbers inside an existing code element", () => {
    container.appendChild(createCodeBlock("const x = 1;\nlet y = 2;", "js"));
    scan({ languages: [javascript], container, lineNumbers: true });

    const code = container.querySelector("code");
    expect(code?.querySelectorAll(".neo-hl-line")).toHaveLength(2);
    expect(code?.querySelectorAll(".neo-hl-line-number")).toHaveLength(2);
    expect(code?.querySelector("pre")).toBeNull();
  });

  it("should force-refresh existing markup without treating line numbers as source", () => {
    const source = "const x = 1;\nlet y = 2;";
    container.appendChild(createCodeBlock(source, "js"));
    scan({ languages: [javascript], container, lineNumbers: true });

    const count = scan({
      languages: [javascript],
      container,
      force: true,
      lineNumbers: false,
      classPrefix: "custom-hl",
    });
    const code = container.querySelector("code");

    expect(count).toBe(1);
    expect(code?.textContent).toBe(source);
    expect(code?.querySelector(".custom-hl-keyword")?.textContent).toBe("const");
    expect(code?.querySelector(".custom-hl-line-number")).toBeNull();
    expect(code?.classList.contains("neo-hl")).toBe(false);
  });

  it("should use updated element text during a forced refresh", () => {
    container.appendChild(createCodeBlock("const oldValue = 1;", "js"));
    scan({ languages: [javascript], container });
    const code = container.querySelector("code")!;
    code.textContent = "let updatedValue = 2;";

    const count = scan({ languages: [javascript], container, force: true });

    expect(count).toBe(1);
    expect(code.textContent).toBe("let updatedValue = 2;");
    expect(code.querySelector(".neo-hl-keyword")?.textContent).toBe("let");
  });

  it("should preserve exact line endings when generated DOM is unchanged", () => {
    const lineEndingGrammar: Grammar = {
      name: "line-endings",
      aliases: ["le"],
      tokens: {
        crlf: /\r\n/,
        cr: /\r/,
      },
    };
    const source = "first\r\nsecond\rthird";
    container.appendChild(createCodeBlock(source, "le"));
    scan({
      languages: [lineEndingGrammar],
      container,
      lineNumbers: true,
    });

    const count = scan({
      languages: [lineEndingGrammar],
      container,
      force: true,
      lineNumbers: false,
    });
    const code = container.querySelector("code")!;

    expect(count).toBe(1);
    expect(code.querySelector(".neo-hl-crlf")).not.toBeNull();
    expect(code.querySelector(".neo-hl-cr")).not.toBeNull();
  });

  it("should preserve foreign content added beside generated line wrappers", () => {
    const lineEndingGrammar: Grammar = {
      name: "line-endings-with-keywords",
      aliases: ["le"],
      tokens: {
        crlf: /\r\n/,
        keyword: /\b(?:const|let)\b/,
      },
    };
    const source = "const first = 1;\r\nlet second = 2;";
    container.appendChild(createCodeBlock(source, "le"));
    scan({ languages: [lineEndingGrammar], container, lineNumbers: true });
    const code = container.querySelector("code")!;
    code.append(" const appended = 3;");

    const count = scan({
      languages: [lineEndingGrammar],
      container,
      force: true,
      lineNumbers: false,
    });

    expect(count).toBe(1);
    expect(code.textContent).toBe(
      `${source.replace("\r\n", "\n")} const appended = 3;`,
    );
    expect(code.querySelector(".neo-hl-crlf")).not.toBeNull();
    expect(code.querySelectorAll(".neo-hl-keyword")).toHaveLength(3);
  });

  it("should not leak a stylesheet during a one-shot themed scan", () => {
    container.appendChild(createCodeBlock("const x = 42;", "js"));
    scan({ languages: [javascript], container, theme: githubDark });

    expect(document.getElementById("neo-hl-theme-github-dark")).toBeNull();
    expect(container.querySelector(".neo-hl-keyword")?.getAttribute("style"))
      .toContain(githubDark.tokenColors.keyword);
    const code = container.querySelector("code") as HTMLElement;
    expect(code.style.backgroundColor).not.toBe("");
    expect(code.style.color).not.toBe("");
  });

  it("should isolate per-element input errors", () => {
    container.appendChild(createCodeBlock("x".repeat(100), "js"));
    container.appendChild(createCodeBlock("const ok = 1;", "js"));
    const onError = vi.fn();

    const count = scan({
      languages: [javascript],
      container,
      maxInputLength: 20,
      onError,
    });

    const blocks = container.querySelectorAll("code");
    expect(count).toBe(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(blocks[0]?.hasAttribute("data-neo-highlighted")).toBe(false);
    expect(blocks[1]?.querySelector(".neo-hl-keyword")?.textContent).toBe("const");
  });
});

describe("observe", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("should re-highlight code when its text changes", async () => {
    container.appendChild(createCodeBlock("const x = 1;", "js"));
    const cleanup = observe({ languages: [javascript], container });
    const code = container.querySelector("code")!;

    code.textContent = "let updated = 2;";

    await vi.waitFor(() => {
      expect(code.querySelector(".neo-hl-keyword")?.textContent).toBe("let");
      expect(code.textContent).toBe("let updated = 2;");
    });
    cleanup();
  });

  it("should highlight an initially empty block when text is inserted", async () => {
    container.appendChild(createCodeBlock("", "js"));
    const cleanup = observe({ languages: [javascript], container });
    const code = container.querySelector("code")!;

    expect(code.hasAttribute("data-neo-highlighted")).toBe(false);
    code.textContent = "const later = 1;";

    await vi.waitFor(() => {
      expect(code.getAttribute("data-neo-highlighted")).toBe("true");
      expect(code.querySelector(".neo-hl-keyword")?.textContent).toBe("const");
    });
    cleanup();
  });

  it("should preserve an external change batched with internal highlighting", async () => {
    container.appendChild(createCodeBlock("const original = 1;", "js"));
    const cleanup = observe({ languages: [javascript], container });
    const code = container.querySelector("code")!;
    let replaced = false;
    const externalObserver = new MutationObserver(() => {
      if (!replaced && code.textContent === "let interim = 2;") {
        replaced = true;
        code.textContent = "const finalValue = 3;";
      }
    });
    externalObserver.observe(code, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    code.textContent = "let interim = 2;";

    await vi.waitFor(() => {
      expect(replaced).toBe(true);
      expect(code.textContent).toBe("const finalValue = 3;");
      expect(code.querySelector(".neo-hl-keyword")?.textContent).toBe("const");
    });
    externalObserver.disconnect();
    cleanup();
  });

  it("should not process generated spans with a broad selector", async () => {
    const cleanup = observe({
      languages: [javascript],
      container,
      selector: "span",
    });
    const target = document.createElement("span");
    target.className = "language-js";
    target.textContent = "const x = 1;";
    container.appendChild(target);

    await vi.waitFor(() => {
      expect(target.getAttribute("data-neo-highlighted")).toBe("true");
      expect(
        container.querySelectorAll("[data-neo-highlighted]"),
      ).toHaveLength(1);
    });
    cleanup();
  });

  it("should not traverse generated token spans after dynamic highlighting", async () => {
    const matches = vi.spyOn(Element.prototype, "matches");
    const queryAll = vi.spyOn(Element.prototype, "querySelectorAll");
    const cleanup = observe({
      languages: [javascript],
      container,
    });
    const target = createCodeBlock(
      Array.from({ length: 2_000 }, (_, index) => `const x${index}=${index};`).join(""),
      "js",
    );
    container.appendChild(target);
    const code = target.querySelector("code")!;

    await vi.waitFor(() => {
      expect(code.getAttribute("data-neo-highlighted")).toBe("true");
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(matches.mock.calls.length).toBeLessThan(10);
    expect(queryAll.mock.calls.length).toBeLessThan(10);
    cleanup();
  });

  it("should release its theme when MutationObserver is unavailable", () => {
    vi.stubGlobal("MutationObserver", undefined);
    const cleanup = observe({
      languages: [javascript],
      container,
      theme: githubDark,
    });

    expect(document.getElementById("neo-hl-theme-github-dark")).toBeTruthy();
    cleanup();
    expect(document.getElementById("neo-hl-theme-github-dark")).toBeNull();
  });

  it("should not leak a theme when selector setup fails", () => {
    expect(() =>
      observe({
        languages: [],
        container,
        theme: githubDark,
        selector: "[",
      }),
    ).toThrow();

    expect(document.getElementById("neo-hl-theme-github-dark")).toBeNull();
  });
});

describe("autoHighlight", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
