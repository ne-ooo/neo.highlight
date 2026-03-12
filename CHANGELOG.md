# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

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
