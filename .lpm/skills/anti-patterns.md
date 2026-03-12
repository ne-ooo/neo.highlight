---
name: anti-patterns
description: Common mistakes when using neo.highlight — auto-detect unreliable for short/ambiguous code, grammar token order matters, greedy flag omission breaks multi-line tokens, applyTheme no-op in SSR, MutationObserver cleanup leak, detect cache keyed on first 500 chars, React context silent defaults, scan selector mismatch
version: "1.0.0"
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# Anti-Patterns for @lpm.dev/neo.highlight

### [CRITICAL] Auto-detect is unreliable for short or ambiguous snippets

Wrong:

```typescript
// AI relies on auto-detect for everything
import { detectLanguage } from '@lpm.dev/neo.highlight'
import { javascript, python, json } from '@lpm.dev/neo.highlight/grammars'

const result = detectLanguage('x = 1', [javascript, python])
// Could return either — too little text for keyword density scoring

const result2 = detectLanguage('{"key": "value"}', [javascript, json])
// Ambiguous — JSON is valid JavaScript, scores overlap
```

Correct:

```typescript
// Use explicit language hints whenever available
import { highlight } from '@lpm.dev/neo.highlight/vanilla'
import { python } from '@lpm.dev/neo.highlight/grammars/python'

// Preferred: specify the language directly
const html = highlight(code, python, { theme: githubDark })

// For DOM scanning: use class or data attributes
// <code class="language-python">x = 1</code>
// <code data-language="python">x = 1</code>

// Auto-detect is a fallback for markdown renderers / CMS content
// where language hints may be missing
```

Auto-detect scores by keyword density (35%), coverage (30%), token diversity (20%), and high-value tokens (15%). Known failure cases:
- **Short snippets (< 20 chars)** — not enough text for reliable scoring
- **Ambiguous languages** — JSON/JS, C/C++, CSS/SCSS score similarly
- **Plain text** — may trigger false positives if words like `function`, `class`, `import` appear
- **Mixed-language content** — HTML with embedded JS/CSS confuses single-grammar scoring
- **Truncation** — only first 2000 chars analyzed; distinctive syntax later in file is missed

Source: `src/core/detect.ts` — scoring weights and 2000-char truncation

### [CRITICAL] Grammar token order matters — earlier keys have priority

Wrong:

```typescript
// AI defines a custom grammar with operator before keyword
const myGrammar: Grammar = {
  name: 'my-lang',
  tokens: {
    operator: /[=<>!]+/,           // Matched first!
    keyword: /\b(?:if|else|for)\b/, // Never reached for overlapping text
    string: /"[^"]*"/,
  },
}
// The keyword 'if' might not match if operator patterns consume '=' nearby first
```

Correct:

```typescript
// Put more specific patterns first, broader patterns last
const myGrammar: Grammar = {
  name: 'my-lang',
  tokens: {
    comment: /\/\/.*/,               // Most specific — match first
    string: { pattern: /"[^"]*"/, greedy: true },
    keyword: /\b(?:if|else|for)\b/,  // Before operator
    number: /\b\d+(?:\.\d+)?\b/,
    operator: /[=<>!]+/,             // Broad — match last
    punctuation: /[{}();,]/,
  },
}
```

The tokenizer iterates token types in object key insertion order. Earlier patterns are tested first and "consume" their matched text. Later patterns only see remaining unmatched text. Place specific patterns (comments, strings, keywords) before broad ones (operators, punctuation).

Source: `src/core/tokenizer.ts` — iterates `Object.keys(grammar.tokens)` in order

### [HIGH] Missing `greedy: true` breaks multi-line strings and comments

Wrong:

```typescript
const grammar: Grammar = {
  name: 'example',
  tokens: {
    comment: /\/\*[\s\S]*?\*\//,    // No greedy flag
    string: /"(?:\\[\s\S]|[^"])*"/,  // No greedy flag
  },
}
// Multi-line comments/strings may be split by other token patterns
// that match text inside them before the full match is found
```

Correct:

```typescript
const grammar: Grammar = {
  name: 'example',
  tokens: {
    comment: { pattern: /\/\*[\s\S]*?\*\//, greedy: true },
    string: { pattern: /"(?:\\[\s\S]|[^"])*"/, greedy: true },
  },
}
// greedy: true re-matches against the full string, preventing
// partial matches from fragmenting the token
```

Without `greedy: true`, other token patterns can match text inside a multi-line comment or string before the full pattern is evaluated. The `greedy` flag forces the tokenizer to re-match against the complete text, preventing token fragmentation. All built-in grammars use `greedy: true` for strings and comments.

Source: `src/core/tokenizer.ts` — greedy re-matching logic

### [HIGH] `applyTheme()` is a no-op in SSR — use `getThemeStylesheet()`

Wrong:

```typescript
// AI uses applyTheme() in a Next.js Server Component
import { applyTheme } from '@lpm.dev/neo.highlight'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'

// Server-side
applyTheme(githubDark) // Does nothing — checks typeof document
const html = renderToHTML(tokens, { theme: githubDark })
// HTML renders without any theme styles!
```

Correct:

```typescript
// SSR: generate CSS string for <head> injection
import { getThemeStylesheet, renderToHTML, tokenize } from '@lpm.dev/neo.highlight'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'

const css = getThemeStylesheet(githubDark)
const html = renderToHTML(tokens, { theme: githubDark })

// Inject both into the page
// <style>{css}</style>
// <div dangerouslySetInnerHTML={{ __html: html }} />

// Client-side only: applyTheme() injects a <style> tag
if (typeof document !== 'undefined') {
  const cleanup = applyTheme(githubDark)
  // cleanup() removes the <style> tag
}
```

`applyTheme()` checks `typeof document` and returns a no-op cleanup if not in a browser. In SSR contexts (Node.js, Deno, edge runtimes), use `getThemeStylesheet()` to get the CSS string and inject it into the HTML response. The `renderToHTML()` function includes inline styles via CSS custom properties, but the theme stylesheet must be present for those variables to resolve.

Source: `src/core/themes.ts` — `typeof document` guard in `applyTheme()`

### [HIGH] MutationObserver cleanup leak in SPAs

Wrong:

```tsx
// AI sets up observe() without cleanup
import { observe } from '@lpm.dev/neo.highlight/vanilla'

function initHighlighting() {
  observe({
    languages: [javascript, typescript],
    theme: githubDark,
  })
  // MutationObserver is never disconnected
  // Runs indefinitely, processing every DOM mutation
}
```

Correct:

```tsx
// Always store and call the cleanup function
import { observe } from '@lpm.dev/neo.highlight/vanilla'

const cleanup = observe({
  languages: [javascript, typescript],
  theme: githubDark,
})

// On page navigation, component unmount, or route change:
cleanup() // Disconnects MutationObserver

// React: use useEffect cleanup
useEffect(() => {
  const cleanup = observe({ languages, theme: githubDark })
  return cleanup
}, [])
```

`observe()` and `autoHighlight({ observe: true })` create a MutationObserver that watches for added nodes matching the selector. Without calling the returned cleanup function, the observer runs indefinitely, processing every DOM mutation even after the relevant content is removed. The `<AutoHighlight>` React component handles cleanup automatically on unmount.

Source: `src/core/scanner.ts` — MutationObserver setup and disconnect

### [HIGH] Detect cache is keyed on first 500 characters only

Wrong:

```typescript
// AI expects different results for files with same beginning
import { detectLanguage } from '@lpm.dev/neo.highlight'

const header = '// Common license header\n// MIT License...\n'.repeat(20)

const jsCode = header + 'function main() { console.log("js") }'
const tsCode = header + 'function main(): void { console.log("ts") }'

detectLanguage(jsCode, [javascript, typescript])  // Cached result
detectLanguage(tsCode, [javascript, typescript])  // Returns SAME result!
// First 500 chars are identical → cache hit → wrong language for second call
```

Correct:

```typescript
// Option 1: Disable cache for dynamic content
detectLanguage(code, grammars, { noCache: true })

// Option 2: Clear cache between batches
import { clearDetectCache } from '@lpm.dev/neo.highlight'
clearDetectCache()

// Option 3: Don't rely on auto-detect for similar files
// Specify language explicitly when possible
```

The detection cache uses an LRU with 100 entries, keyed on the first 500 characters of code + grammar names. Files with identical headers/imports but different language features later in the file will return cached (potentially wrong) results. Use `noCache: true` or `clearDetectCache()` when processing files with shared prefixes.

Source: `src/core/detect.ts` — LRU cache keyed on `code.slice(0, 500)`

### [MEDIUM] React context returns defaults without `<HighlightProvider>`

Wrong:

```tsx
// AI assumes useHighlightContext() will error without provider
import { useHighlightContext } from '@lpm.dev/neo.highlight/react'

function MyComponent() {
  const { theme, languages } = useHighlightContext()
  // theme is undefined, languages is empty array
  // No error thrown — silently uses defaults

  return <Highlight language={javascript} theme={theme}>
    {code}
  </Highlight>
  // theme is undefined → no styling applied!
}
```

Correct:

```tsx
// Option 1: Always wrap in HighlightProvider
<HighlightProvider theme={githubDark} languages={[javascript]}>
  <MyComponent />
</HighlightProvider>

// Option 2: Provide fallbacks when using the context
function MyComponent() {
  const { theme } = useHighlightContext()
  return (
    <Highlight
      language={javascript}
      theme={theme ?? githubDark}  // Explicit fallback
    >
      {code}
    </Highlight>
  )
}
```

`useHighlightContext()` does not throw when used outside a `<HighlightProvider>`. It returns default values (undefined theme, empty languages array, default class prefix). Components that rely on context-provided theme/languages will render without styles or fail silently.

Source: `src/react/context.tsx` — default context value with no theme

### [MEDIUM] `scan()` selector mismatch — elements not highlighted

Wrong:

```typescript
// AI uses wrong selector for the HTML structure
scan({
  languages: [javascript],
  theme: githubDark,
  selector: 'pre code',  // Default selector
})

// But the HTML uses a different structure:
// <div class="code-block"><code>const x = 1</code></div>
// No <pre> wrapper → selector doesn't match → nothing highlighted
```

Correct:

```typescript
// Match selector to your actual HTML structure
scan({
  languages: [javascript],
  theme: githubDark,
  selector: '.code-block code',  // Match your markup
})

// Language hint via class or data attribute
// <code class="language-javascript">const x = 1</code>
// <code data-language="javascript">const x = 1</code>
```

The default selector is `"pre code"`, which matches `<pre><code>...</code></pre>`. If your HTML uses a different structure (e.g., `<div class="highlight"><code>`), you must pass a matching `selector`. The `scan()` function will silently find 0 elements and return 0 if the selector doesn't match.

Source: `src/core/scanner.ts` — `document.querySelectorAll(selector)`
