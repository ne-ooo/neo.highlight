import { describe, it, expect } from "vitest";
import { getDualThemeStylesheet } from "../../../src/core/themes";
import { githubLight } from "../../../src/themes/github-light";
import { githubDark } from "../../../src/themes/github-dark";
import { oneDark } from "../../../src/themes/one-dark";

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
});
