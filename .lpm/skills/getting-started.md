---
name: getting-started
description: How to use neo.highlight — React components (Highlight, AutoHighlight, HighlightProvider, CopyButton), useHighlight hook, vanilla JS (highlight, scan, observe), core API (tokenize, renderToHTML), neo.markdown highlight plugin integration, 30 grammars, 10 themes, custom themes, SSR/edge, line highlighting, diff highlighting, tree-shaking
version: "1.0.1"
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# Getting Started with @lpm.dev/neo.highlight

## Overview

neo.highlight is a zero-dependency syntax highlighter. ~3.8 KB gzipped core, 30 languages, 10 themes, first-class React adapter, vanilla JS adapter, fully synchronous (SSR/edge-ready), tree-shakeable.

## React API

### `<Highlight>` — Core Component

```tsx
import { Highlight } from '@lpm.dev/neo.highlight/react'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'

function CodeBlock({ code }: { code: string }) {
  return (
    <Highlight
      language={javascript}
      theme={githubDark}
      showLineNumbers
      highlightLines={[2, 3]}
      copyButton
    >
      {code}
    </Highlight>
  )
}
```

**Props:**
- `language` — Grammar object (required)
- `theme` — Theme object or registered name
- `showLineNumbers` — Show line numbers
- `highlightLines` — Array of 1-indexed line numbers to highlight
- `copyButton` — Show copy-to-clipboard button
- `copyButtonLabel` / `copyButtonCopiedLabel` — Button text (default: "Copy" / "Copied!")
- `onCopy` — Callback `(code: string) => void`
- `classPrefix` — CSS class prefix (default: `"neo-hl"`)
- `diffHighlight` — `{ added?: number[], removed?: number[], modified?: number[] }`
- `className` / `style` — Standard React props

### `<AutoHighlight>` — Auto-Scan Container

```tsx
import { AutoHighlight } from '@lpm.dev/neo.highlight/react'
import { javascript, python, typescript } from '@lpm.dev/neo.highlight/grammars'

// Automatically highlights all <code> elements within children
<AutoHighlight
  languages={[javascript, python, typescript]}
  theme="github-dark"
  autoDetect
  lineNumbers
>
  <article dangerouslySetInnerHTML={{ __html: markdownHtml }} />
</AutoHighlight>
```

Detects language from `class="language-javascript"`, `class="lang-js"`, or `data-language="javascript"`. Falls back to auto-detection if `autoDetect` is true. Uses MutationObserver for dynamically added code blocks (SPAs).

### `<HighlightProvider>` — Context Provider

```tsx
import { HighlightProvider } from '@lpm.dev/neo.highlight/react'
import { tokyoNight } from '@lpm.dev/neo.highlight/themes/tokyo-night'
import { javascript, python } from '@lpm.dev/neo.highlight/grammars'

// All nested Highlight components inherit these defaults
<HighlightProvider
  theme={tokyoNight}
  languages={[javascript, python]}
  lineNumbers
>
  <App />
</HighlightProvider>
```

### `useHighlight` Hook — Custom Rendering

```tsx
import { useHighlight } from '@lpm.dev/neo.highlight/react'
import { rust } from '@lpm.dev/neo.highlight/grammars/rust'
import { nord } from '@lpm.dev/neo.highlight/themes/nord'

function CustomCodeBlock({ code }: { code: string }) {
  const { tokens, html } = useHighlight(code, rust, {
    theme: nord,
    lineNumbers: true,
    wrapCode: false, // returns inner HTML only, no <pre><code> wrapper
  })

  // Use `html` directly or iterate `tokens` for custom rendering
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
```

### `<CopyButton>` — Standalone Copy Button

```tsx
import { CopyButton } from '@lpm.dev/neo.highlight/react'

<CopyButton
  code={sourceCode}
  label="Copy"
  copiedLabel="Copied!"
  onCopy={(code) => console.log('Copied:', code)}
/>
```

## Vanilla JS API

### `highlight()` — Returns HTML String

```typescript
import { highlight } from '@lpm.dev/neo.highlight/vanilla'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'

const html = highlight(`const x = 42;`, javascript, {
  theme: githubDark,
  lineNumbers: true,
  highlightLines: [1],
  classPrefix: 'neo-hl',
  wrapCode: true,
})

document.getElementById('code').innerHTML = html
```

### `scan()` / `observe()` — DOM Auto-Highlighting

```typescript
import { scan, observe } from '@lpm.dev/neo.highlight/vanilla'
import { javascript, typescript } from '@lpm.dev/neo.highlight/grammars'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'

// One-shot: highlight all matching elements now
const count = scan({
  languages: [javascript, typescript],
  theme: githubDark,
  selector: 'pre code',         // CSS selector (default)
  container: document.body,     // Scope (default)
  lineNumbers: false,
  autoDetect: true,
})
console.log(`Highlighted ${count} blocks`)

// Continuous: scan + MutationObserver for SPAs
const cleanup = observe({
  languages: [javascript, typescript],
  theme: githubDark,
  observe: true,
})
// Later: cleanup() to disconnect observer
```

### `autoHighlight()` — Convenience Wrapper

```typescript
import { autoHighlight } from '@lpm.dev/neo.highlight/vanilla'

// Calls observe() if observe: true, else scan()
const cleanup = autoHighlight({
  languages: [javascript, typescript],
  theme: githubDark,
  observe: true,
})
```

## Core API (Framework-Agnostic)

For Vue, Svelte, Astro, plain Node.js, or custom pipelines:

```typescript
import { tokenize, renderToHTML, getThemeStylesheet } from '@lpm.dev/neo.highlight'
import { python } from '@lpm.dev/neo.highlight/grammars/python'
import { dracula } from '@lpm.dev/neo.highlight/themes/dracula'

// Step 1: Tokenize
const tokens = tokenize(code, python)

// Step 2: Render to HTML
const html = renderToHTML(tokens, {
  theme: dracula,
  lineNumbers: true,
  highlightLines: [1, 5],
  diffHighlight: { added: [2], removed: [4], modified: [6] },
  classPrefix: 'neo-hl',
  wrapCode: true,
})

// Step 3: Get theme CSS (for <style> injection)
const css = getThemeStylesheet(dracula)
```

## neo.markdown Integration

neo.highlight integrates with `@lpm.dev/neo.markdown` via its highlight plugin. Pass `tokenize`, `renderToHTML`, and `getThemeStylesheet` directly:

```typescript
import { createParser } from '@lpm.dev/neo.markdown'
import { highlightPlugin } from '@lpm.dev/neo.markdown/plugins/highlight'
import { tokenize, renderToHTML, getThemeStylesheet } from '@lpm.dev/neo.highlight'
import { javascript, typescript, python } from '@lpm.dev/neo.highlight/grammars'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'

const parser = createParser({
  plugins: [
    highlightPlugin({
      grammars: [javascript, typescript, python],
      tokenize,
      renderToHTML,
      getThemeStylesheet,
      theme: githubDark,
    }),
  ],
})

const html = parser.parse(markdownString)
// Code blocks with known languages get syntax-highlighted automatically
// getThemeStylesheet generates the CSS that maps .neo-hl-keyword → var(--neo-hl-keyword)
```

The `getThemeStylesheet` option injects a `<style>` tag into the HTML output with the token color CSS. For React apps, generate the CSS separately and include it in a `<style>` element:

```tsx
const themeCSS = getThemeStylesheet(githubDark)
// Include as <style>{themeCSS}</style> in your component
```

## SSR & Edge Runtimes

neo.highlight is fully synchronous — no async init, no WASM, no DOM required. Works in Node.js, Deno, Bun, Cloudflare Workers, Vercel Edge.

### Next.js Server Components (zero client JS)

```tsx
import { tokenize, renderToHTML } from '@lpm.dev/neo.highlight'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'

export default function CodeBlock({ code }: { code: string }) {
  const tokens = tokenize(code, javascript)
  const html = renderToHTML(tokens, { theme: githubDark })
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
```

### Theme CSS for SSR

```typescript
import { getThemeStylesheet } from '@lpm.dev/neo.highlight'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'

// Generate CSS for <head> injection
const css = getThemeStylesheet(githubDark)
// Returns scoped CSS with --neo-hl-* custom properties
```

## Grammars (30 Languages)

All tree-shakeable — import only what you need:

```typescript
// Individual imports (recommended for production)
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { python } from '@lpm.dev/neo.highlight/grammars/python'

// Bulk import (convenient for dev)
import { javascript, typescript, python, rust, go, java, kotlin, swift,
  ruby, php, c, cpp, csharp, bash, shell, sql, html, css, scss,
  json, yaml, markdown, graphql, docker, diff, regex, toml, ini,
  jsx, tsx } from '@lpm.dev/neo.highlight/grammars'
```

Each grammar has `name`, optional `aliases` (e.g., `["js", "mjs"]` for JavaScript), and `tokens`.

Custom grammars are supported — define a `Grammar` object with `name` and `tokens`. See the `Grammar` type export for the full interface.

## Themes (10 Built-in)

```typescript
import { githubDark, githubLight, oneDark, dracula, nord,
  monokai, solarizedLight, solarizedDark, nightOwl, tokyoNight
} from '@lpm.dev/neo.highlight/themes'

// Or individual imports
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'
```

### Custom Themes

```typescript
import type { Theme } from '@lpm.dev/neo.highlight'

const myTheme: Theme = {
  name: 'my-theme',
  background: '#1a1b26',
  foreground: '#c0caf5',
  tokenColors: {
    comment: '#565f89',
    keyword: '#bb9af7',
    string: '#9ece6a',
    number: '#ff9e64',
    function: '#7aa2f7',
    operator: '#89ddff',
    // ... additional token types as needed
  },
}
```

Themes use CSS custom properties (`--neo-hl-*`). Each theme is < 1KB.

## Line & Diff Highlighting

```typescript
// Highlight specific lines
renderToHTML(tokens, {
  theme: githubDark,
  highlightLines: [2, 3, 4],    // 1-indexed
})

// Diff markers with colored gutters
renderToHTML(tokens, {
  theme: githubDark,
  diffHighlight: {
    added: [1, 2],     // Green background + "+" gutter
    removed: [5],      // Red background + "-" gutter
    modified: [8],     // Yellow background + "~" gutter
  },
})
```

## Language Auto-Detection

```typescript
import { detectLanguage } from '@lpm.dev/neo.highlight'
import { javascript, python, rust } from '@lpm.dev/neo.highlight/grammars'

const result = detectLanguage(code, [javascript, python, rust])
if (result) {
  console.log(result.grammar.name) // 'python'
  console.log(result.score)        // 0.72
  console.log(result.candidates)   // all scored grammars
}
```

Uses keyword density (35%), coverage ratio (30%), token diversity (20%), and high-value tokens (15%). Cached with LRU (100 entries). Use explicit `class="language-*"` attributes when possible — auto-detect is a fallback.

## Tree-Shaking

```typescript
// Core + 1 grammar ≈ 4.2 KB gzipped
import { highlight } from '@lpm.dev/neo.highlight/vanilla'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'

// Only JavaScript grammar and GitHub Dark theme are bundled
```

`sideEffects: false` in package.json — bundlers eliminate all unused code.

## TypeScript Types

```typescript
import type {
  Token, TokenNode, TokenPattern, TokenDefinition,
  Grammar, GrammarTokens, GrammarRegistry,
  Theme, ThemeTokenColors,
  RenderOptions, ByteFormatOptions,
  DetectResult, DetectOptions,
  DiffHighlight,
  // React types
  HighlightProps, AutoHighlightProps,
  UseHighlightOptions, UseHighlightResult,
  HighlightContextValue,
  CopyButtonProps,
  // Vanilla types
  HighlightOptions, ScanOptions,
} from '@lpm.dev/neo.highlight'
```
