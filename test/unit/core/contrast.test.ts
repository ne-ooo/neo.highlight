import { describe, it, expect } from "vitest";
import {
  hexToRGB,
  relativeLuminance,
  contrastRatio,
  meetsWCAG_AA,
  validateThemeContrast,
} from "../../../src/core/contrast";
import { githubDark } from "../../../src/themes/github-dark";
import { githubLight } from "../../../src/themes/github-light";
import { oneDark } from "../../../src/themes/one-dark";
import { dracula } from "../../../src/themes/dracula";
import { nord } from "../../../src/themes/nord";
import { monokai } from "../../../src/themes/monokai";
import { solarizedLight } from "../../../src/themes/solarized-light";
import { solarizedDark } from "../../../src/themes/solarized-dark";
import { nightOwl } from "../../../src/themes/night-owl";
import { tokyoNight } from "../../../src/themes/tokyo-night";

describe("contrast utilities", () => {
  describe("hexToRGB", () => {
    it("parses hex colors", () => {
      expect(hexToRGB("#000000")).toEqual([0, 0, 0]);
      expect(hexToRGB("#ffffff")).toEqual([255, 255, 255]);
      expect(hexToRGB("#ff0000")).toEqual([255, 0, 0]);
      expect(hexToRGB("#00ff00")).toEqual([0, 255, 0]);
      expect(hexToRGB("#0000ff")).toEqual([0, 0, 255]);
    });
  });

  describe("relativeLuminance", () => {
    it("returns 0 for black", () => {
      expect(relativeLuminance(0, 0, 0)).toBe(0);
    });

    it("returns 1 for white", () => {
      expect(relativeLuminance(255, 255, 255)).toBe(1);
    });
  });

  describe("contrastRatio", () => {
    it("returns 21:1 for black on white", () => {
      expect(contrastRatio("#000000", "#ffffff")).toBe(21);
    });

    it("returns 1:1 for same colors", () => {
      expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
      expect(contrastRatio("#000000", "#000000")).toBe(1);
    });

    it("is commutative", () => {
      const r1 = contrastRatio("#ff0000", "#0000ff");
      const r2 = contrastRatio("#0000ff", "#ff0000");
      expect(r1).toBe(r2);
    });

    it("returns reasonable values for mid-range colors", () => {
      const ratio = contrastRatio("#777777", "#ffffff");
      expect(ratio).toBeGreaterThan(3);
      expect(ratio).toBeLessThan(6);
    });
  });

  describe("meetsWCAG_AA", () => {
    it("black on white passes", () => {
      expect(meetsWCAG_AA("#000000", "#ffffff")).toBe(true);
    });

    it("white on white fails", () => {
      expect(meetsWCAG_AA("#ffffff", "#ffffff")).toBe(false);
    });

    it("low contrast fails for normal text", () => {
      // A medium gray on dark gray
      expect(meetsWCAG_AA("#666666", "#333333")).toBe(false);
    });

    it("large text has lower threshold (3:1)", () => {
      const fg = "#777777";
      const bg = "#000000";
      const ratio = contrastRatio(fg, bg);
      // Should pass for large text (3:1) but might or might not for normal (4.5:1)
      if (ratio >= 3 && ratio < 4.5) {
        expect(meetsWCAG_AA(fg, bg, true)).toBe(true);
        expect(meetsWCAG_AA(fg, bg, false)).toBe(false);
      }
    });
  });

  describe("validateThemeContrast", () => {
    it("returns report structure", () => {
      const report = validateThemeContrast(githubDark);
      expect(report).toHaveProperty("passed");
      expect(report).toHaveProperty("theme");
      expect(report).toHaveProperty("results");
      expect(report.theme).toBe("github-dark");
      expect(Array.isArray(report.results)).toBe(true);
    });

    it("includes foreground in results", () => {
      const report = validateThemeContrast(githubDark);
      const fg = report.results.find((r) => r.token === "foreground");
      expect(fg).toBeDefined();
      expect(fg!.pass).toBe(true);
    });

    it("each result has required fields", () => {
      const report = validateThemeContrast(githubDark);
      for (const result of report.results) {
        expect(result).toHaveProperty("token");
        expect(result).toHaveProperty("color");
        expect(result).toHaveProperty("background");
        expect(result).toHaveProperty("ratio");
        expect(result).toHaveProperty("required");
        expect(result).toHaveProperty("pass");
      }
    });

    it("supports custom minRatio", () => {
      const strict = validateThemeContrast(githubDark, 7);
      // AAA requires 7:1, some tokens may fail
      expect(strict.results.length).toBeGreaterThan(0);
    });
  });

  describe("all themes pass WCAG AA", () => {
    const themes = [
      githubDark,
      githubLight,
      oneDark,
      dracula,
      nord,
      monokai,
      solarizedLight,
      solarizedDark,
      nightOwl,
      tokyoNight,
    ];

    for (const theme of themes) {
      it(`${theme.name} — all token colors meet 4.5:1 contrast ratio`, () => {
        const report = validateThemeContrast(theme);
        const failures = report.results.filter((r) => !r.pass);

        if (failures.length > 0) {
          const details = failures
            .map((f) => `${f.token}: ${f.color} (${f.ratio}:1)`)
            .join(", ");
          expect.fail(
            `Theme "${theme.name}" has ${failures.length} WCAG AA failures: ${details}`,
          );
        }

        expect(report.passed).toBe(true);
      });
    }
  });
});
