import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderCopyButton, initCopyButtons } from "../../../src/core/copy-button";

describe("renderCopyButton", () => {
  it("renders a button with default labels", () => {
    const html = renderCopyButton("const x = 42;");
    expect(html).toContain("<button");
    expect(html).toContain('class="neo-hl-copy-button"');
    expect(html).toContain(">Copy</button>");
    expect(html).toContain('data-label="Copy"');
    expect(html).toContain('data-copied-label="Copied!"');
  });

  it("stores code in data-code attribute", () => {
    const html = renderCopyButton("const x = 42;");
    expect(html).toContain('data-code="const x = 42;"');
  });

  it("escapes HTML in code", () => {
    const html = renderCopyButton('<div class="test">&');
    expect(html).toContain("&lt;div");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;");
  });

  it("uses custom labels", () => {
    const html = renderCopyButton("code", {
      label: "Kopieren",
      copiedLabel: "Kopiert!",
    });
    expect(html).toContain(">Kopieren</button>");
    expect(html).toContain('data-label="Kopieren"');
    expect(html).toContain('data-copied-label="Kopiert!"');
  });

  it("escapes labels before rendering HTML", () => {
    const label = '<img src=x onerror="alert(1)">';
    const copiedLabel = 'done" autofocus onfocus="alert(2)';
    const html = renderCopyButton("code", { label, copiedLabel });

    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    const button = wrapper.querySelector("button");

    expect(wrapper.querySelector("img")).toBeNull();
    expect(button?.textContent).toBe(label);
    expect(button?.getAttribute("data-copied-label")).toBe(copiedLabel);
    expect(button?.hasAttribute("autofocus")).toBe(false);
    expect(button?.hasAttribute("onfocus")).toBe(false);
  });

  it("rejects an unsafe class prefix", () => {
    expect(() =>
      renderCopyButton("code", { classPrefix: 'neo" onclick="alert(1)' }),
    ).toThrow(/class prefix/i);
  });

  it("uses custom class prefix", () => {
    const html = renderCopyButton("code", { classPrefix: "my-code" });
    expect(html).toContain('class="my-code-copy-button"');
  });

  it("has type=button attribute", () => {
    const html = renderCopyButton("code");
    expect(html).toContain('type="button"');
  });

  it("has aria-label attribute", () => {
    const html = renderCopyButton("code");
    expect(html).toContain('aria-label="Copy"');
  });

  it("renders a polite status region for copy feedback", () => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = renderCopyButton("code");
    const status = wrapper.querySelector('[role="status"]');

    expect(status?.getAttribute("aria-live")).toBe("polite");
    expect(status?.getAttribute("aria-atomic")).toBe("true");
  });
});

describe("initCopyButtons", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  it("returns a cleanup function", () => {
    const cleanup = initCopyButtons(container);
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("finds buttons by class name", () => {
    container.innerHTML = renderCopyButton("hello");
    const button = container.querySelector("button")!;
    expect(button).toBeDefined();
    expect(button.classList.contains("neo-hl-copy-button")).toBe(true);
  });

  it("clicking button shows copied label", async () => {
    // Mock clipboard API
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    container.innerHTML = renderCopyButton("const x = 42;");
    initCopyButtons(container);

    const button = container.querySelector("button")!;
    button.click();

    // Wait for async clipboard operation
    await vi.waitFor(() => {
      expect(button.textContent).toBe("Copied!");
      expect(container.querySelector('[role="status"]')?.textContent).toBe(
        "Copied!",
      );
    });

    expect(writeTextMock).toHaveBeenCalledWith("const x = 42;");
  });

  it("adds copied CSS class after click", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText: writeTextMock },
    });

    container.innerHTML = renderCopyButton("code");
    initCopyButtons(container);

    const button = container.querySelector("button")!;
    button.click();

    await vi.waitFor(() => {
      expect(button.classList.contains("neo-hl-copy-button-copied")).toBe(true);
    });
  });

  it("cleanup removes event listeners", () => {
    container.innerHTML = renderCopyButton("code");
    const cleanup = initCopyButtons(container);

    const button = container.querySelector("button")!;
    const spy = vi.spyOn(button, "removeEventListener");

    cleanup();
    expect(spy).toHaveBeenCalledWith("click", expect.any(Function));
  });

  it("handles custom class prefix", () => {
    container.innerHTML = renderCopyButton("code", { classPrefix: "custom" });
    const cleanup = initCopyButtons(container, "custom");
    const button = container.querySelector(".custom-copy-button");
    expect(button).not.toBeNull();
    cleanup();
  });

  it("returns noop when no container", () => {
    const cleanup = initCopyButtons(undefined);
    expect(typeof cleanup).toBe("function");
    cleanup(); // Should not throw
  });
});
