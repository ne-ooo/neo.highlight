# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [1.4.0] - Unreleased

- Update Vitest to 4.1.11 for GHSA-82fw-gwwq-j7x9. Built package and worker checks retain Node 18 coverage.

- Add opt-in `wrapLines: "source"` for physical code rows with preserved line endings and bounded rendering.

### Experimental incremental processing

- Added JS/TS streams with highlighted provisional suffixes, complete-input parity, and cumulative resource budgets.
- Added edit sessions with checkpoints, suffix reuse, revision checks, and isolated token updates.
- Added a bounded worker-session handler and a token-update helper through the optional `experimental` entry.

See [incremental processing](./docs/incremental.md) for supported languages, resource limits, and protocol boundaries.

### Workers

- Added a selected-grammar worker factory and explicit listener installation through `worker/core`.
- Added a Promise client with bounded queues, source budgets, aborts, replacement keys, and queue-inclusive deadlines.
- Active cancellation and deadlines terminate the worker. Queued requests continue in a replacement worker with their original deadlines.
- Added worker failure recovery, stale-response rejection, deterministic disposal, and worker-side resource ceilings.
- Preserved the all-grammar worker entry, message protocol, and synchronous APIs.

See [background highlighting](./docs/workers.md) for ownership, error handling, and runtime limits.

### Word highlighting

- Added bounded UTF-16 source ranges with overlap merging and Unicode boundary checks.
- Added word backgrounds across nested tokens and lines, with unchanged source text and hook offsets.
- Added React range updates without repeated tokenization, plus single and dual theme styles.

See [word highlighting](./docs/word-highlighting.md) for offsets, adapters, and limits.

### Rendering hooks

- Added synchronous token, line, code, and pre decorators with validated classes and escaped attributes.
- Added exact source offsets and displayed line offsets through `startLine`.
- Added React forwarding without repeated tokenization for rendering changes.
- Kept resource limits active for decorated output and empty line wrappers.

See [rendering hooks](./docs/render-hooks.md) for callback order and supported attributes.

### Fixed

- Function and class expressions retain division context, including selected typed return annotations and nested heritage expressions.
- Escaped JavaScript identifiers retain complete spans. TSX generic arrows support trivia, constraints, defaults, and `const` parameters.
- HTML handles escaped script states and raw-text self-closing slashes. Incomplete Vue interpolations preserve host boundaries.
- Added 120 exact-span regression cases across JavaScript, TypeScript, JSX, TSX, HTML, Vue, and Svelte.

- Python f-strings retain nested fields, format specifications, conversions, debug expressions, and Python 3.12 quote reuse.
- CSS preserves multiline selectors, declaration boundaries, escaped identifiers, custom-property blocks, strings, and URLs.
- HTML protects quoted attributes and raw-text boundaries, with embedded JavaScript, JSON, and CSS tokens.
- Vue and Svelte retain nested template expressions and select TypeScript or SCSS from script and style attributes.
- Unsupported embedded languages retain plain text. SCSS and Less comments preserve their boundaries in inherited CSS rules.

- Token markup reuses validated styles within each render call. Text without HTML delimiters avoids repeated escape replacements.
- Theme stylesheets preserve primary-token, first-alias, and overlapping diff color priority in class mode.

- JavaScript and TypeScript templates retain nested interpolation boundaries and tokenize expression bodies.
- Comments, strings, and regex literals no longer compete for text inside another lexical context.
- JSX and TSX preserve body text and tokenize nested attribute and child expressions.
- TSX retains TypeScript tokens inside expressions and supports generic components with nested type arguments.
- TypeScript generic calls support nested type arguments without a fixed regex depth.
- Unicode identifiers, member names, decimal points, numeric separators, and BigInt suffixes retain their token boundaries.
- Incomplete templates, strings, and JSX attributes retain source text without delimiter backtracking.

### Added

- Reviewed Python, CSS, HTML, Vue, and Svelte span fixtures, plus built Markdown integration and resource checks.

- Optional class output shares a theme stylesheet across blocks and omits generated style attributes.
- Runtime measurements report startup, heap, and output costs through `lpm run bench:efficiency`.

- Reviewed source-span fixtures for JavaScript, TypeScript, JSX, and TSX.
- An optional read-only nesting context for custom token matchers.
- Scanner cases in the timeout, scaling, and heap-limit checks.

Token trees inside templates and JSX now contain additional expression tokens.
Consumers that inspect token trees must account for these nested tokens.
The outer JavaScript template token remains `string` with the `template-string` alias.
Python f-strings, CSS selectors, attributes, and embedded bodies also contain additional nested tokens.
HTML, Vue, and Svelte imports now include their supported embedded grammars, which increases bundle size and parsing work.
See [grammar coverage](./docs/grammar-accuracy.md) for behavior and limits.

## [1.3.0] - 2026-08-25

### Security

- Repaired adversarial regular-expression scaling in all built-in grammar families.
- Added subprocess timeouts and scaling cases for all 55 exported grammars.
- Added limits for input, matches, token nodes, HTML output, lines, and nesting depth.
- Added 64 MB heap tests for dense tokens, large output, and high line counts.
- Documented custom grammars as trusted regular-expression configuration.

### Performance

- Reduced tokenizer allocation by accepting matches in one pass and merging adjacent compatible tokens.
- Prevented the DOM observer from traversing spans that it generated.
- Made the language cache detect grammar changes and return independent result objects.

## [1.2.0] - 2026-03-30

### Added

- **25 new language grammars** — expanded from 30 to 55 languages:
  - **Tier 1 (Web & Modern):** Lua, Dart, Elixir, Scala, R, Svelte, Vue, Astro, Zig, WASM/WAT
  - **Tier 2 (Enterprise & DevOps):** Haskell, Erlang, Clojure, OCaml, Perl, Objective-C, PowerShell, Terraform/HCL, Prisma, Nix, LaTeX, Less, Handlebars
  - **Tier 3 (Specialized):** Solidity, CSV
- Framework grammars (Svelte, Vue, Astro, Handlebars) extend HTML grammar with framework-specific syntax
- Language composition: Less extends CSS, Objective-C extends C
- 450 tests (up from 350)

### Language Details

| Language | Import | Aliases |
|----------|--------|---------|
| Lua | `lua` | — |
| Dart | `dart` | — |
| Elixir | `elixir` | `ex`, `exs` |
| Scala | `scala` | `sc` |
| R | `r` | `rlang` |
| Svelte | `svelte` | — |
| Vue | `vue` | `vue-html` |
| Astro | `astro` | — |
| Zig | `zig` | — |
| WASM | `wasm` | `wat`, `wast` |
| Haskell | `haskell` | `hs` |
| Erlang | `erlang` | `erl` |
| Clojure | `clojure` | `clj`, `cljs`, `cljc`, `edn` |
| OCaml | `ocaml` | `ml` |
| Perl | `perl` | `pl` |
| Objective-C | `objectivec` | `objc`, `obj-c` |
| PowerShell | `powershell` | `ps1`, `posh` |
| Terraform | `terraform` | `hcl`, `tf` |
| Prisma | `prisma` | — |
| Nix | `nix` | `nixos` |
| LaTeX | `latex` | `tex` |
| Less | `less` | — |
| Handlebars | `handlebars` | `hbs`, `mustache` |
| Solidity | `solidity` | `sol` |
| CSV | `csv` | `tsv` |

## [1.1.1] - 2026-03-22

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
