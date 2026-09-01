import { describe, it, expect } from "vitest";
import { getDualThemeStylesheet } from "../../../src/core/themes";
import { githubLight } from "../../../src/themes/github-light";
import { githubDark } from "../../../src/themes/github-dark";
import { oneDark } from "../../../src/themes/one-dark";
import type { Theme } from "../../../src/core/types";

describe("getDualThemeStylesheet", () => {
  it("generates @media prefers-color-scheme by default", () => {
    const css = getDualThemeStylesheet(githubLight, githubDark);
    expect(css).toContain("@media (prefers-color-scheme: dark)");
  });

  it("generates class-based toggle with darkSelector", () => {
    const css = getDualThemeStylesheet(githubLight, githubDark, {
      darkSelector: ".dark",
    });
    expect(css).toContain(".dark .neo-hl {");
    expect(css).not.toContain("@media");
  });

  it("generates data-attribute selector", () => {
    const css = getDualThemeStylesheet(githubLight, githubDark, {
      darkSelector: '[data-theme="dark"]',
    });
    expect(css).toContain('[data-theme="dark"] .neo-hl {');
  });

  it("scopes each selector in a comma-separated dark selector", () => {
    const css = getDualThemeStylesheet(githubLight, githubDark, {
      darkSelector: ".dark, .night",
    });

    expect(css).toContain(".dark .neo-hl, .night .neo-hl {");
    expect(css).not.toContain(".dark, .night .neo-hl {");
  });

  it("includes light theme variables", () => {
    const css = getDualThemeStylesheet(githubLight, githubDark);
    expect(css).toContain(`--neo-hl-bg: ${githubLight.background}`);
    expect(css).toContain(`--neo-hl-fg: ${githubLight.foreground}`);
  });

  it("includes dark theme variables in dark block", () => {
    const css = getDualThemeStylesheet(githubLight, githubDark);
    expect(css).toContain(`--neo-hl-bg: ${githubDark.background}`);
    expect(css).toContain(`--neo-hl-fg: ${githubDark.foreground}`);
  });

  it("includes token color variables for both themes", () => {
    const css = getDualThemeStylesheet(githubLight, githubDark);
    // Light theme keyword
    expect(css).toContain(`--neo-hl-keyword: ${githubLight.tokenColors.keyword}`);
    // Dark theme keyword (in dark block)
    expect(css).toContain(`--neo-hl-keyword: ${githubDark.tokenColors.keyword}`);
  });

  it("includes optional variables for both themes", () => {
    const css = getDualThemeStylesheet(githubLight, githubDark);

    expect(css).toContain(`--neo-hl-selection: ${githubLight.selection}`);
    expect(css).toContain(`--neo-hl-selection: ${githubDark.selection}`);
    expect(css).toContain(
      `--neo-hl-line-number-active: ${githubLight.lineNumberActive}`,
    );
    expect(css).toContain(
      `--neo-hl-line-number-active: ${githubDark.lineNumberActive}`,
    );
    expect(css).toContain(
      `--neo-hl-diff-added-bg: ${githubLight.diffAddedBg}`,
    );
    expect(css).toContain(
      `--neo-hl-diff-added-bg: ${githubDark.diffAddedBg}`,
    );
  });

  it("generates rules for optional theme features", () => {
    const css = getDualThemeStylesheet(githubLight, githubDark);

    expect(css).toContain(".neo-hl::selection, .neo-hl ::selection");
    expect(css).toContain(".neo-hl-line-highlighted .neo-hl-line-number");
    expect(css).toContain(".neo-hl-line-highlighted { background:");
    expect(css).toContain(".neo-hl-diff-added { background:");
    expect(css).toContain(".neo-hl-diff-removed { background:");
    expect(css).toContain(".neo-hl-diff-modified { background:");
  });

  it("generates token classes using CSS variables", () => {
    const css = getDualThemeStylesheet(githubLight, githubDark);
    expect(css).toContain(".neo-hl-keyword { color: var(--neo-hl-keyword); }");
    expect(css).toContain(".neo-hl-string { color: var(--neo-hl-string); }");
  });

  it("works with any two themes (not just matching pairs)", () => {
    const css = getDualThemeStylesheet(githubLight, oneDark);
    expect(css).toContain(`--neo-hl-bg: ${githubLight.background}`);
    expect(css).toContain(`--neo-hl-bg: ${oneDark.background}`);
  });

  it("supports custom classPrefix", () => {
    const css = getDualThemeStylesheet(githubLight, githubDark, {
      classPrefix: "code",
    });
    expect(css).toContain(".code {");
    expect(css).toContain("--code-bg:");
    expect(css).toContain(".code-keyword");
  });

  it("resets light-only variables in sparse dark themes", () => {
    const lightTheme: Theme = {
      name: "sparse-light",
      background: "#ffffff",
      foreground: "#111111",
      selection: "#eeeeee",
      tokenColors: { keyword: "#222222" },
    };
    const darkTheme: Theme = {
      name: "sparse-dark",
      background: "#111111",
      foreground: "#eeeeee",
      tokenColors: {},
    };

    const css = getDualThemeStylesheet(lightTheme, darkTheme, {
      darkSelector: ".dark",
    });
    const darkBlock = css.slice(css.indexOf(".dark .neo-hl {"));

    expect(darkBlock).toContain("--neo-hl-selection: initial;");
    expect(darkBlock).toContain("--neo-hl-keyword: initial;");
    expect(darkBlock).toContain(
      ".dark .neo-hl::selection, .dark .neo-hl ::selection { background: revert; }",
    );
  });

  it("scopes a dark-only selection color to dark mode", () => {
    const lightTheme: Theme = {
      name: "selection-light",
      background: "#ffffff",
      foreground: "#111111",
      tokenColors: {},
    };
    const darkTheme: Theme = {
      name: "selection-dark",
      background: "#111111",
      foreground: "#eeeeee",
      selection: "#333333",
      tokenColors: {},
    };

    const css = getDualThemeStylesheet(lightTheme, darkTheme, {
      darkSelector: ".dark",
    });
    expect(css).not.toMatch(
      /^\.neo-hl ::selection \{ background: var\(--neo-hl-selection\); \}$/m,
    );
    expect(css).toContain(
      ".dark .neo-hl::selection, .dark .neo-hl ::selection { background: var(--neo-hl-selection); }",
    );
  });
});
