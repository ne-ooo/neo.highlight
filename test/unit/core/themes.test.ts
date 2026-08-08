import { describe, it, expect, beforeEach } from "vitest";
import {
  registerTheme,
  registerThemes,
  getTheme,
  resolveTheme,
  getThemeCSS,
  getDualThemeStylesheet,
  applyTheme,
} from "../../../src/core/themes";
import { githubDark } from "../../../src/themes/github-dark";
import { githubLight } from "../../../src/themes/github-light";
import type { Theme } from "../../../src/core/types";

describe("Theme Registry", () => {
  beforeEach(() => {
    // Register themes for tests
    registerThemes([githubDark, githubLight]);
  });

  it("should register and retrieve a theme by name", () => {
    expect(getTheme("github-dark")).toBe(githubDark);
    expect(getTheme("github-light")).toBe(githubLight);
  });

  it("should return undefined for unknown theme", () => {
    expect(getTheme("nonexistent")).toBeUndefined();
  });

  it("should resolve theme from string name", () => {
    expect(resolveTheme("github-dark")).toBe(githubDark);
  });

  it("should resolve theme from object", () => {
    expect(resolveTheme(githubDark)).toBe(githubDark);
  });

  it("should return undefined for unknown theme name", () => {
    expect(resolveTheme("unknown")).toBeUndefined();
  });
});

describe("getThemeCSS", () => {
  it("should generate CSS with custom properties", () => {
    const css = getThemeCSS(githubDark);
    expect(css).toContain(".neo-hl {");
    expect(css).toContain(`--neo-hl-bg: ${githubDark.background}`);
    expect(css).toContain(`--neo-hl-fg: ${githubDark.foreground}`);
  });

  it("should include token color variables", () => {
    const css = getThemeCSS(githubDark);
    expect(css).toContain("--neo-hl-keyword:");
    expect(css).toContain("--neo-hl-string:");
    expect(css).toContain("--neo-hl-comment:");
  });

  it("should generate token class rules", () => {
    const css = getThemeCSS(githubDark);
    expect(css).toContain(".neo-hl-keyword { color: var(--neo-hl-keyword); }");
    expect(css).toContain(".neo-hl-string { color: var(--neo-hl-string); }");
  });

  it("should include structural styles for line rendering", () => {
    const css = getThemeCSS(githubDark);
    expect(css).toContain(".neo-hl-line { display: block;");
    expect(css).toContain(".neo-hl-line-number { display: inline-block;");
  });

  it("should include selection styling when defined", () => {
    const css = getThemeCSS(githubDark);
    expect(css).toContain("::selection");
    expect(css).toContain("--neo-hl-selection:");
  });

  it("should include line number styling when defined", () => {
    const css = getThemeCSS(githubDark);
    expect(css).toContain("--neo-hl-line-number:");
    expect(css).toContain("--neo-hl-line-number-active:");
    expect(css).toContain(".neo-hl-line-number");
    expect(css).toContain(
      ".neo-hl-line-highlighted .neo-hl-line-number",
    );
  });

  it("should expose diff colors as theme variables", () => {
    const css = getThemeCSS(githubDark);
    expect(css).toContain(
      `--neo-hl-diff-added-bg: ${githubDark.diffAddedBg}`,
    );
    expect(css).toContain(
      "background: var(--neo-hl-diff-added-bg)",
    );
  });

  it("should include line highlight styling when defined", () => {
    const css = getThemeCSS(githubDark);
    expect(css).toContain("--neo-hl-line-highlight:");
    expect(css).toContain(".neo-hl-line-highlighted");
  });

  it("should use custom class prefix", () => {
    const css = getThemeCSS(githubDark, "code-hl");
    expect(css).toContain(".code-hl {");
    expect(css).toContain("--code-hl-bg:");
    expect(css).toContain(".code-hl-keyword");
  });

  it("should handle theme with minimal properties", () => {
    const minimal: Theme = {
      name: "minimal",
      background: "#000",
      foreground: "#fff",
      tokenColors: {
        keyword: "#f00",
      },
    };
    const css = getThemeCSS(minimal);
    expect(css).toContain("--neo-hl-bg: #000");
    expect(css).toContain("--neo-hl-fg: #fff");
    expect(css).toContain("--neo-hl-keyword: #f00");
    expect(css).not.toContain("::selection");
    expect(css).toContain(".neo-hl-line-number { display: inline-block;");
  });

  it("should reject CSS declaration injection in theme values", () => {
    const malicious: Theme = {
      name: "malicious",
      background: "#000; } body { display: none",
      foreground: "#fff",
      tokenColors: { keyword: "#fff" },
    };

    expect(() => getThemeCSS(malicious)).toThrow(/background/i);
  });

  it("should reject style-element termination in theme values", () => {
    const malicious: Theme = {
      name: "malicious-style-tag",
      background: "</style><script>alert(1)</script>",
      foreground: "#fff",
      tokenColors: { keyword: "#fff" },
    };

    expect(() => getThemeCSS(malicious)).toThrow(/background/i);
  });

  it("should reject injection in a dual-theme dark selector", () => {
    expect(() =>
      getDualThemeStylesheet(githubLight, githubDark, {
        darkSelector: ".dark } body { display: none; /*",
      }),
    ).toThrow(/dark selector/i);
  });

  it("should reject an unsafe class prefix", () => {
    expect(() => getThemeCSS(githubDark, "neo-hl, body")).toThrow(
      /class prefix/i,
    );
  });
});

describe("applyTheme", () => {
  it("should inject a style element into the document", () => {
    const cleanup = applyTheme(githubDark);
    expect(cleanup).toBeDefined();

    const style = document.getElementById("neo-hl-theme-github-dark");
    expect(style).toBeTruthy();
    expect(style?.tagName).toBe("STYLE");
    expect(style?.textContent).toContain("--neo-hl-bg:");

    cleanup?.();
    expect(document.getElementById("neo-hl-theme-github-dark")).toBeNull();
  });

  it("should replace existing theme style when called again", () => {
    const cleanup1 = applyTheme(githubDark);
    const cleanup2 = applyTheme(githubDark);

    const styles = document.querySelectorAll("#neo-hl-theme-github-dark");
    expect(styles.length).toBe(1);

    cleanup1?.();
    expect(document.getElementById("neo-hl-theme-github-dark")).toBeTruthy();

    cleanup2?.();
    expect(document.getElementById("neo-hl-theme-github-dark")).toBeNull();
  });

  it("should accept theme by name", () => {
    registerTheme(githubDark);
    const cleanup = applyTheme("github-dark");
    expect(cleanup).toBeDefined();

    const style = document.getElementById("neo-hl-theme-github-dark");
    expect(style).toBeTruthy();

    cleanup?.();
  });

  it("should fail explicitly for an unknown theme name", () => {
    expect(() => applyTheme("nonexistent-theme")).toThrow(/unknown theme/i);
  });
});
