# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [1.1.0] - 2026-03-22

### WCAG AA Theme Compliance

- All 10 built-in themes now pass WCAG AA contrast requirements (4.5:1 minimum)
- Fixed comment colors in: one-dark, dracula, nord, monokai, solarized-light, solarized-dark, night-owl, tokyo-night
- Fixed additional token colors in: one-dark (variable/tag/property), nord (number/important/decorator), monokai (keyword/operator), solarized-light (27 tokens adjusted), solarized-dark (14 tokens adjusted)

### Added

- `validateThemeContrast(theme)` — Validate any theme's token colors against WCAG AA (4.5:1 contrast ratio). Returns detailed per-token report.
- `contrastRatio(color1, color2)` — Calculate contrast ratio between two hex colors
- `meetsWCAG_AA(foreground, background, isLargeText?)` — Check if a color pair meets WCAG AA
- `hexToRGB(hex)` — Parse hex color to RGB tuple
- `relativeLuminance(r, g, b)` — Calculate WCAG 2.0 relative luminance
- `getDualThemeStylesheet(lightTheme, darkTheme, options?)` — Generate CSS with both light and dark theme variables, using `@media (prefers-color-scheme: dark)` or custom class selector
- `resolveGrammar(language, grammars)` — Resolve language strings ("js", "py") to Grammar objects by checking name and aliases
- 350 tests (up from 310)

## [1.0.1] - 2026-03-21

### Fixed

- **Multi-line token rendering** — Tokens spanning multiple lines (e.g. multi-line comments, template strings) now produce correctly balanced HTML per line. Each line is a self-contained fragment with proper tag nesting, fixing broken line numbers and line highlighting for code with multi-line syntax constructs.

### Changed

- **Benchmarks restructured** — Moved from `bench/` to `test/benchmarks/` for consistency with the test directory structure
- **README rewritten** — Comprehensive documentation with comparison table, full React/Vanilla API reference, SSR guide, custom themes, and bundle size breakdown
- **MIGRATION.md removed** — Migration guidance now integrated directly into the README

### Added

- 310 tests (up from 177) — new renderer tests covering multi-line token edge cases across CSS, Python, and JavaScript grammars

## [0.1.0] - 2026-03-09

### Added

- **Core tokenizer** — `tokenize()`, `getPlainText()`, `createRegistry()` — grammar-based syntax tokenization
- **Renderer** — `renderToHTML()`, `getThemeStylesheet()` — convert tokens to styled HTML
- **Theme system** — `applyTheme()`, `registerTheme()`, `registerThemes()`, `getTheme()`, `getThemeCSS()`, `resolveTheme()`
- **Auto-scan** — `scan()`, `observe()`, `autoHighlight()` — auto-detect and highlight code blocks in the DOM
- **Language detection** — `detectLanguage()`, `scoreTokenization()`, `clearDetectCache()`
- **Copy button** — `renderCopyButton()`, `initCopyButtons()` — copy-to-clipboard UI for code blocks
- **React adapter** — `<Highlight>`, `<CopyButton>` components via `@lpm.dev/neo.highlight/react`
- **Vanilla adapter** — `highlight()`, `highlightAll()` via `@lpm.dev/neo.highlight/vanilla`
- **Grammars** — JavaScript, TypeScript, JSX, TSX, CSS, HTML, JSON, Markdown, Bash, Python, Rust, Go, and more via `@lpm.dev/neo.highlight/grammars/*`
- **Themes** — GitHub Dark/Light, One Dark, Dracula, Nord, Solarized, and more via `@lpm.dev/neo.highlight/themes/*`
- Sub-path exports: `/react`, `/vanilla`, `/grammars`, `/grammars/*`, `/themes`, `/themes/*`
- Optional React peer dependency (`>=17.0.0`)
- Zero runtime dependencies
- ESM + CJS dual output with full TypeScript declaration files
- 177 tests across core, React adapter, vanilla adapter, scanner, detector, and copy button
