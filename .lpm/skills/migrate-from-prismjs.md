---
name: migrate-from-prismjs
description: Migration guide from Prism.js to neo.highlight — global Prism object to tree-shakeable imports, grammar compatibility, theme mapping, autoloader to explicit imports, plugin replacements (line-numbers, line-highlight, copy-to-clipboard built-in), WCAG AA theme compliance, dual theme support, resolveGrammar for alias lookup, plus comparison with highlight.js, react-syntax-highlighter, and Shiki
version: "1.1.1"
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# Migrating from Prism.js to @lpm.dev/neo.highlight

## Why Migrate

|                      | Prism.js                        | neo.highlight                  |
| -------------------- | ------------------------------- | ------------------------------ |
| **ESM**              | No (global `Prism` object)      | Yes, tree-shakeable            |
| **TypeScript**       | No (community `@types`)         | Full types, zero `any`         |
| **Bundle**           | 6 KB core + plugins + languages | 3.8 KB core, all included      |
| **React**            | Community plugins               | First-class adapter            |
| **SSR**              | Global mutation required        | Pure functions, no DOM         |
| **Tree-shaking**     | Not possible                    | Per-grammar, per-theme imports |
| **Line numbers**     | Plugin required                 | Built-in option                |
| **Copy button**      | Plugin required                 | Built-in component             |
| **MutationObserver** | Not built-in                    | Built-in `observe()`           |
| **WCAG AA themes**   | No contrast guarantees          | All 10 themes pass 4.5:1       |
| **Dark/light CSS**   | Manual theme swapping           | `getDualThemeStylesheet()`     |
| **Language aliases** | Manual alias registration       | `resolveGrammar()` built-in    |

## Import Mapping

### Before (Prism.js)

```typescript
// Global script tag or require
import Prism from "prismjs";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/themes/prism-tomorrow.css";

const html = Prism.highlight(code, Prism.languages.typescript, "typescript");
```

### After (neo.highlight)

```typescript
// Tree-shakeable, no globals
import { highlight } from "@lpm.dev/neo.highlight/vanilla";
import { typescript } from "@lpm.dev/neo.highlight/grammars/typescript";
import { oneDark } from "@lpm.dev/neo.highlight/themes/one-dark";

const html = highlight(code, typescript, { theme: oneDark });
```

## API Mapping

### Core Highlighting

```typescript
// Prism.js
Prism.highlight(code, Prism.languages.javascript, "javascript");

// neo.highlight — vanilla
import { highlight } from "@lpm.dev/neo.highlight/vanilla";
highlight(code, javascript, { theme: githubDark });

// neo.highlight — core (two-step for custom pipelines)
import { tokenize, renderToHTML } from "@lpm.dev/neo.highlight";
const tokens = tokenize(code, javascript);
const html = renderToHTML(tokens, { theme: githubDark });
```

### Auto-Highlighting DOM Elements

```typescript
// Prism.js — highlights all <code> elements with class="language-*"
Prism.highlightAll();
Prism.highlightAllUnder(container);
Prism.highlightElement(element);

// neo.highlight — scan() for one-shot, observe() for SPAs
import { scan, observe } from "@lpm.dev/neo.highlight/vanilla";

// One-shot (replaces Prism.highlightAll)
scan({
  languages: [javascript, typescript, python],
  theme: githubDark,
  selector: "pre code",
});

// With MutationObserver for dynamic content (no Prism.js equivalent)
const cleanup = observe({
  languages: [javascript, typescript, python],
  theme: githubDark,
});
```

### Language Detection

```typescript
// Prism.js — reads class="language-*" only, no content-based detection

// neo.highlight — class-based + content-based auto-detection
import { detectLanguage } from "@lpm.dev/neo.highlight";
const result = detectLanguage(code, [javascript, python, rust]);
// result.grammar.name → 'python'
// result.score → 0.72
```

## Plugin Replacements

Prism.js features that require plugins are built-in:

### Line Numbers (replaces `prism-line-numbers`)

```typescript
// Prism.js
// <pre class="line-numbers"><code>...</code></pre>
// + import 'prismjs/plugins/line-numbers/prism-line-numbers.css'

// neo.highlight — built-in option
highlight(code, javascript, {
  theme: githubDark,
  lineNumbers: true,
})

// React
<Highlight language={javascript} theme={githubDark} showLineNumbers>
  {code}
</Highlight>
```

### Line Highlight (replaces `prism-line-highlight`)

```typescript
// Prism.js
// <pre data-line="2,4-5"><code>...</code></pre>
// + import 'prismjs/plugins/line-highlight/prism-line-highlight.css'

// neo.highlight — built-in option (1-indexed)
highlight(code, javascript, {
  theme: githubDark,
  highlightLines: [2, 4, 5],
});
```

### Copy to Clipboard (replaces `prism-copy-to-clipboard`)

```typescript
// Prism.js
// import 'prismjs/plugins/copy-to-clipboard/prism-copy-to-clipboard'

// neo.highlight — React component
import { CopyButton } from '@lpm.dev/neo.highlight/react'
<CopyButton code={sourceCode} />

// Or built into <Highlight>
<Highlight language={javascript} theme={githubDark} copyButton>
  {code}
</Highlight>

// Vanilla JS
import { initCopyButtons } from '@lpm.dev/neo.highlight'
const cleanup = initCopyButtons(container)
```

### Diff Highlight (replaces `prism-diff-highlight`)

```typescript
// Prism.js
// <pre class="language-diff-javascript diff-highlight"><code>...</code></pre>

// neo.highlight — built-in option
highlight(code, javascript, {
  theme: githubDark,
  diffHighlight: {
    added: [1, 2], // Green + "+" gutter
    removed: [5], // Red + "-" gutter
    modified: [8], // Yellow + "~" gutter
  },
});
```

## Theme Mapping

| Prism.js Theme         | neo.highlight Theme |
| ---------------------- | ------------------- |
| `prism.css` (default)  | `githubLight`       |
| `prism-tomorrow`       | `oneDark`           |
| `prism-dark`           | `githubDark`        |
| `prism-okaidia`        | `monokai`           |
| `prism-solarizedlight` | `solarizedLight`    |
| `prism-twilight`       | `dracula`           |

```typescript
// Prism.js — CSS import, one at a time
import "prismjs/themes/prism-tomorrow.css";

// neo.highlight — JS object, switchable at runtime
import { oneDark, githubDark } from "@lpm.dev/neo.highlight/themes";
highlight(code, javascript, { theme: isDark ? oneDark : githubLight });
```

Themes are < 1KB each (JS objects with color values) vs Prism's CSS files.

### WCAG AA Theme Compliance

Prism.js themes have no contrast guarantees — several popular themes (e.g., `prism-tomorrow`, `prism-twilight`) have token colors that fail WCAG AA against their backgrounds. neo.highlight's 10 built-in themes all pass WCAG AA (4.5:1 contrast ratio for every token color). For custom themes, validate with `validateThemeContrast()`:

```typescript
import { validateThemeContrast } from "@lpm.dev/neo.highlight";
import { dracula } from "@lpm.dev/neo.highlight/themes/dracula";

const report = validateThemeContrast(dracula);
// report.passed → true (all tokens meet 4.5:1)
```

### Dual Theme Support

Prism.js requires loading separate CSS files and manually swapping them for light/dark mode. neo.highlight generates a single stylesheet with both themes:

```typescript
import { getDualThemeStylesheet } from "@lpm.dev/neo.highlight";
import { githubLight } from "@lpm.dev/neo.highlight/themes/github-light";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

// Automatic via prefers-color-scheme
const css = getDualThemeStylesheet(githubLight, githubDark);

// Or class-based toggle
const css2 = getDualThemeStylesheet(githubLight, githubDark, {
  darkSelector: ".dark",
});
```

### Language Alias Resolution

Prism.js requires manually registering language aliases or loading the correct component file. neo.highlight resolves aliases automatically:

```typescript
// Prism.js — must know the exact component name
import "prismjs/components/prism-javascript"; // Not "js"

// neo.highlight — resolveGrammar handles aliases
import { resolveGrammar } from "@lpm.dev/neo.highlight";
import { javascript, python } from "@lpm.dev/neo.highlight/grammars";

resolveGrammar("js", [javascript, python]); // → javascript grammar
resolveGrammar("py", [javascript, python]); // → python grammar
```

## Grammar Compatibility

neo.highlight grammars use a Prism-compatible pattern syntax:

```typescript
// Prism.js grammar
Prism.languages.myLang = {
  comment: /\/\/.*/,
  string: { pattern: /"[^"]*"/, greedy: true },
  keyword: /\b(?:if|else)\b/,
};

// neo.highlight grammar — same pattern syntax
const myLang: Grammar = {
  name: "my-lang",
  aliases: ["ml"],
  tokens: {
    comment: /\/\/.*/,
    string: { pattern: /"[^"]*"/, greedy: true },
    keyword: /\b(?:if|else)\b/,
  },
};
```

Key differences:

- neo.highlight grammars are `Grammar` objects with `name` and `tokens` (not assigned to a global)
- `inside` for nested tokens works the same way
- `lookbehind` and `greedy` work the same way
- `alias` works the same way
- No `rest` property — use `inside` instead

## React Migration

### From Prism.js + useEffect

```tsx
// Before — manual Prism in React
import Prism from "prismjs";

function CodeBlock({ code }: { code: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current) Prism.highlightElement(ref.current);
  }, [code]);
  return (
    <pre>
      <code ref={ref} className="language-javascript">
        {code}
      </code>
    </pre>
  );
}

// After — declarative component
import { Highlight } from "@lpm.dev/neo.highlight/react";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

function CodeBlock({ code }: { code: string }) {
  return (
    <Highlight
      language={javascript}
      theme={githubDark}
      showLineNumbers
      copyButton
    >
      {code}
    </Highlight>
  );
}
```

## SSR Advantage

```typescript
// Prism.js SSR — requires global mutation
global.Prism = require("prismjs");
require("prismjs/components/prism-typescript");
const html = Prism.highlight(code, Prism.languages.typescript, "typescript");
// Pollutes global scope, not safe for concurrent requests

// neo.highlight SSR — pure functions
import { tokenize, renderToHTML } from "@lpm.dev/neo.highlight";
import { typescript } from "@lpm.dev/neo.highlight/grammars/typescript";
const tokens = tokenize(code, typescript);
const html = renderToHTML(tokens, { theme: githubDark });
// No globals, no side effects, safe for edge/worker runtimes
```

## Also Migrating From...

### highlight.js

```typescript
// highlight.js
import hljs from "highlight.js";
hljs.highlightAll();
hljs.highlight(code, { language: "javascript" });

// neo.highlight — same pattern
import { scan } from "@lpm.dev/neo.highlight/vanilla";
scan({ languages: [javascript], theme: githubDark });

import { highlight } from "@lpm.dev/neo.highlight/vanilla";
highlight(code, javascript, { theme: githubDark });
```

Advantage: highlight.js loads all languages by default (~180 KB). neo.highlight tree-shakes — core + 1 grammar ≈ 4.2 KB.

### react-syntax-highlighter

```tsx
// react-syntax-highlighter
import SyntaxHighlighter from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";

<SyntaxHighlighter language="javascript" style={atomOneDark}>
  {code}
</SyntaxHighlighter>;

// neo.highlight — lighter, no wrapper overhead
import { Highlight } from "@lpm.dev/neo.highlight/react";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { oneDark } from "@lpm.dev/neo.highlight/themes/one-dark";

<Highlight language={javascript} theme={oneDark}>
  {code}
</Highlight>;
```

Advantage: react-syntax-highlighter wraps Prism/hljs internally with 50KB+ theme CSS. neo.highlight themes are < 1KB JS objects.

### Shiki

```typescript
// Shiki — async, WASM-based
const highlighter = await createHighlighter({
  themes: ["nord"],
  langs: ["js"],
});
const html = highlighter.codeToHtml(code, { lang: "js", theme: "nord" });

// neo.highlight — synchronous, no WASM
import { highlight } from "@lpm.dev/neo.highlight/vanilla";
const html = highlight(code, javascript, { theme: nord });
```

Advantage: Shiki requires async WASM initialization — doesn't work in Cloudflare Workers or other edge runtimes without workarounds. neo.highlight is fully synchronous, works everywhere.

## Checklist

- [ ] Replace `prismjs` imports with `@lpm.dev/neo.highlight` subpath imports
- [ ] Replace `Prism.highlight()` with `highlight()` from `/vanilla`
- [ ] Replace `Prism.highlightAll()` with `scan()` or `observe()`
- [ ] Replace Prism CSS theme imports with theme objects
- [ ] Remove Prism plugins — line numbers, copy button, line highlight are built-in
- [ ] Remove `@types/prismjs` if using TypeScript
- [ ] For React: replace `useEffect` + `Prism.highlightElement` with `<Highlight>`
- [ ] For SSR: replace global `Prism` with `tokenize()` + `renderToHTML()`
- [ ] Replace manual theme swapping with `getDualThemeStylesheet()` for light/dark mode
- [ ] Replace manual language alias maps with `resolveGrammar()`
- [ ] Validate custom themes with `validateThemeContrast()` for WCAG AA compliance
- [ ] Remove `prismjs` from dependencies
