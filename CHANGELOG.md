# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

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
