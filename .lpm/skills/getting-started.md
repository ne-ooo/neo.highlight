---
name: getting-started
description: Use neo.highlight with React, vanilla JavaScript, the core API, built-in grammars, themes, SSR, and line highlighting
version: "1.4.0"
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# Getting Started with @lpm.dev/neo.highlight

## Overview

neo.highlight is a synchronous, tree-shakeable syntax highlighter. It provides 55 languages, 10 themes, and React and vanilla adapters.

## React API

### `<Highlight>` — Core Component

```tsx
import { Highlight } from "@lpm.dev/neo.highlight/react";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

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
  );
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

**Security:** Sanitize untrusted HTML first. `<AutoHighlight>` does not sanitize its children.

```tsx
import { AutoHighlight } from "@lpm.dev/neo.highlight/react";
import {
  javascript,
  python,
  typescript,
} from "@lpm.dev/neo.highlight/grammars";

// Automatically highlights all <code> elements within children
<AutoHighlight
  languages={[javascript, python, typescript]}
  autoDetect
  lineNumbers
>
  <article dangerouslySetInnerHTML={{ __html: sanitizedMarkdownHtml }} />
</AutoHighlight>;
```

Detects language from `class="language-javascript"`, `class="lang-js"`, or `data-language="javascript"`. Falls back to auto-detection if `autoDetect` is true. Uses MutationObserver for dynamically added code blocks (SPAs).

### `<HighlightProvider>` — Context Provider

```tsx
import { HighlightProvider } from "@lpm.dev/neo.highlight/react";
import { tokyoNight } from "@lpm.dev/neo.highlight/themes/tokyo-night";
import { javascript, python } from "@lpm.dev/neo.highlight/grammars";

// All nested Highlight components inherit these defaults
<HighlightProvider
  theme={tokyoNight}
  languages={[javascript, python]}
  lineNumbers
>
  <App />
</HighlightProvider>;
```

### `useHighlight` Hook — Custom Rendering

```tsx
import { useHighlight } from "@lpm.dev/neo.highlight/react";
import { rust } from "@lpm.dev/neo.highlight/grammars/rust";
import { nord } from "@lpm.dev/neo.highlight/themes/nord";

function CustomCodeBlock({ code }: { code: string }) {
  const { tokens, html } = useHighlight(code, rust, {
    theme: nord,
    lineNumbers: true,
    wrapCode: false, // returns inner HTML only, no <pre><code> wrapper
  });

  // Use `html` directly or iterate `tokens` for custom rendering
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

### `<CopyButton>` — Standalone Copy Button

```tsx
import { CopyButton } from "@lpm.dev/neo.highlight/react";

<CopyButton
  code={sourceCode}
  label="Copy"
  copiedLabel="Copied!"
  onCopy={(code) => console.log("Copied:", code)}
/>;
```

## Vanilla JS API

### `highlight()` — Returns HTML String

```typescript
import { highlight } from "@lpm.dev/neo.highlight/vanilla";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

const html = highlight(`const x = 42;`, javascript, {
  theme: githubDark,
  lineNumbers: true,
  highlightLines: [1],
  classPrefix: "neo-hl",
  wrapCode: true,
});

document.getElementById("code").innerHTML = html;
```

### `scan()` / `observe()` — DOM Auto-Highlighting

```typescript
import { scan, observe } from "@lpm.dev/neo.highlight/vanilla";
import { javascript, typescript } from "@lpm.dev/neo.highlight/grammars";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

// One-shot: highlight all matching elements now
const count = scan({
  languages: [javascript, typescript],
  theme: githubDark,
  selector: "pre code", // CSS selector (default)
  container: document.body, // Scope (default)
  lineNumbers: false,
  autoDetect: true,
});
console.log(`Highlighted ${count} blocks`);

// Continuous: scan + MutationObserver for SPAs
const cleanup = observe({
  languages: [javascript, typescript],
  theme: githubDark,
  observe: true,
});
// Later: cleanup() to disconnect observer
```

### `autoHighlight()` — Convenience Wrapper

```typescript
import { autoHighlight } from "@lpm.dev/neo.highlight/vanilla";

// Calls observe() if observe: true, else scan()
const cleanup = autoHighlight({
  languages: [javascript, typescript],
  theme: githubDark,
  observe: true,
});
```

## Core API (Framework-Agnostic)

For Vue, Svelte, Astro, plain Node.js, or custom pipelines:

```typescript
import {
  tokenize,
  renderToHTML,
  getThemeStylesheet,
} from "@lpm.dev/neo.highlight";
import { python } from "@lpm.dev/neo.highlight/grammars/python";
import { dracula } from "@lpm.dev/neo.highlight/themes/dracula";

// Step 1: Tokenize
const tokens = tokenize(code, python);

// Step 2: Render to HTML
const html = renderToHTML(tokens, {
  theme: dracula,
  lineNumbers: true,
  highlightLines: [1, 5],
  diffHighlight: { added: [2], removed: [4], modified: [6] },
  classPrefix: "neo-hl",
  wrapCode: true,
});

// Step 3: Get theme CSS (for <style> injection)
const css = getThemeStylesheet(dracula);
```

## neo.markdown Integration

neo.highlight integrates with `@lpm.dev/neo.markdown` via its highlight plugin. Pass `tokenize`, `renderToHTML`, and `getThemeStylesheet` directly:

```typescript
import { createParser } from "@lpm.dev/neo.markdown";
import { highlightPlugin } from "@lpm.dev/neo.markdown/plugins/highlight";
import {
  tokenize,
  renderToHTML,
  getThemeStylesheet,
} from "@lpm.dev/neo.highlight";
import {
  javascript,
  typescript,
  python,
} from "@lpm.dev/neo.highlight/grammars";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

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
});

const html = parser.parse(markdownString);
// Code blocks with known languages get syntax-highlighted automatically
// getThemeStylesheet generates the CSS that maps .neo-hl-keyword → var(--neo-hl-keyword)
```

The `getThemeStylesheet` option injects a `<style>` tag into the HTML output with the token color CSS. For React apps, generate the CSS separately and include it in a `<style>` element:

```tsx
const themeCSS = getThemeStylesheet(githubDark);
// Include as <style>{themeCSS}</style> in your component
```

## SSR & Edge Runtimes

Core tokenization and rendering are synchronous. They require no async initialization, WASM, or DOM.
The worker client provides a separate Promise API.

### Next.js Server Components (zero client JS)

```tsx
import { tokenize, renderToHTML } from "@lpm.dev/neo.highlight";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

export default function CodeBlock({ code }: { code: string }) {
  const tokens = tokenize(code, javascript);
  const html = renderToHTML(tokens, { theme: githubDark });
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

### Theme CSS for SSR

```typescript
import { getThemeStylesheet } from "@lpm.dev/neo.highlight";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

// Generate CSS for <head> injection
const css = getThemeStylesheet(githubDark);
// Returns scoped CSS with --neo-hl-* custom properties
```

## Grammars (55 Languages)

All tree-shakeable — import only what you need:

```typescript
// Individual imports (recommended for production)
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { python } from "@lpm.dev/neo.highlight/grammars/python";

// Bulk import (convenient for dev)
import {
  // Web core
  javascript, typescript, jsx, tsx, html, css, scss, less,
  json, yaml, markdown, graphql,
  // Frameworks
  svelte, vue, astro, handlebars,
  // Backend
  python, ruby, php, go, rust, java, kotlin, swift, scala,
  elixir, erlang, haskell, clojure, ocaml, perl, dart, lua, r,
  // Systems
  c, cpp, csharp, objectivec, zig, wasm,
  // DevOps & Config
  bash, shell, docker, sql, toml, ini, terraform, prisma, nix, powershell,
  // Markup & Data
  latex, csv, diff, regex,
  // Web3
  solidity,
} from "@lpm.dev/neo.highlight/grammars";
```

Each grammar has `name`, optional `aliases` (e.g., `["js", "mjs"]` for JavaScript), and `tokens`.

JavaScript and TypeScript templates contain nested expression tokens. JSX and TSX separate body text from code expressions.
The TSX grammar retains TypeScript rules inside attributes and child expressions. Use `tsx` for generic JSX components.
The outer template token remains `string` with the `template-string` alias. Token consumers must traverse nested `content` arrays.
Function and class expressions preserve division context in the covered grammar fixtures.
Escaped identifier spellings retain complete spans. TSX generic arrows support comments and constraints.
The existing resource limits apply to these expression grammars.

Python f-strings support nested expressions, format fields, conversions, and Python 3.12 quote reuse.
CSS supports multiline selectors, declaration boundaries, escaped identifiers, and protected strings and URLs.

HTML includes JavaScript, JSON, and CSS rules for embedded bodies.
Vue and Svelte also include TypeScript and SCSS rules, selected by script and style attributes.
Unsupported embedded languages retain plain text.
These grammars increase bundle size and contain additional nested tokens.
HTML script bodies track escaped states. Incomplete Vue interpolations retain their active expression context.
See `docs/grammar-accuracy.md` for token shapes, language selection, and known limits.

Astro and Handlebars extend HTML. Less extends CSS, and Objective-C extends C.

Custom grammars use a `Grammar` object with `name` and `tokens`.

CAUTION: Use only trusted custom grammars. An unsafe regular expression can block the JavaScript thread.

Do not accept custom grammars from users. Run them in a worker with an application timeout.

The default resource limits are `250000`, `100000`, `100000`, `10000000`, `10000`, and `100`.

### `resolveGrammar()` — Resolve Language Strings to Grammars

```typescript
import { resolveGrammar } from "@lpm.dev/neo.highlight";
import {
  javascript,
  python,
  typescript,
} from "@lpm.dev/neo.highlight/grammars";

const grammars = [javascript, python, typescript];

resolveGrammar("js", grammars); // → javascript grammar
resolveGrammar("py", grammars); // → python grammar
resolveGrammar("ts", grammars); // → typescript grammar
resolveGrammar("unknown", grammars); // → null
```

Checks grammar `name` and `aliases`. The lookup ignores case and surrounding whitespace. It returns the `Grammar` object or `null`.

See [themes and rendering](./themes-and-rendering.md) for the remaining APIs.

## Background highlighting

Import `installHighlightWorker` from `@lpm.dev/neo.highlight/worker/core` in an application worker module.
Pass `self` and `{ grammars: [javascript] }`. Import each selected grammar in that module.
Import `createHighlightWorkerClient` from `@lpm.dev/neo.highlight/worker/client` in the application.
Supply a `createWorker` factory that returns a fresh dedicated module worker.

`client.tokenize(code, language, options)` returns a token Promise.
Request options include `signal`, `key`, `timeoutMs`, and tokenizer limits.
Handle rejected Promises, including cancellation. When its owning view closes, dispose the client.

The client defaults to 32 pending requests, 1,000,000 pending source units, and a 5,000 ms queue-inclusive deadline.
Active aborts and deadlines terminate the worker. Unrelated queued requests retain their deadlines and continue in a replacement worker.
The automatic `/worker` entry and its message protocol remain available.
See `docs/workers.md` for worker ceilings, lifecycle errors, Node transport adapters, and synchronous Markdown integration limits.

## Experimental incremental processing

Import the optional APIs from `@lpm.dev/neo.highlight/experimental`.
`createJavaScriptStream` supports JavaScript and TypeScript chunks. `createJavaScriptDocument` supports revision-checked edits.
Apply their patches with `applyJavaScriptTokenUpdate`. Dispose each session after use.
The default stream preview highlights the mutable suffix. Every accepted prefix matches complete-input tokenization.
Session limits include cumulative match, node, update, and work budgets.
`createJavaScriptSessionHandler` uses a separate worker protocol. The whole-input worker client does not route these session requests.
Read `docs/incremental.md` for options, cleanup, checkpoints, and protocol ownership.
