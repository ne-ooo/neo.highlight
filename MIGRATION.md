# Migration Guide

This guide covers migrating to `@lpm.dev/neo.highlight` from four popular syntax highlighting libraries: Prism.js, highlight.js, react-syntax-highlighter, and Shiki.

Each section provides step-by-step instructions, before/after code comparisons, key differences, and common gotchas.

---

## Table of Contents

- [Migrating from Prism.js](#migrating-from-prismjs)
- [Migrating from highlight.js](#migrating-from-highlightjs)
- [Migrating from react-syntax-highlighter](#migrating-from-react-syntax-highlighter)
- [Migrating from Shiki](#migrating-from-shiki)
- [Quick Reference Table](#quick-reference-table)

---

## Migrating from Prism.js

### Step 1: Remove Prism.js and install neo.highlight

```bash
# Remove Prism.js
npm uninstall prismjs

# Install neo.highlight
npm install @lpm.dev/neo.highlight
```

### Step 2: Replace script tags and CSS with ESM imports

Prism.js uses global `<script>` tags and CSS files. neo.highlight uses explicit ESM imports with zero global state.

**Before (Prism.js):**

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="prism-themes/prism-dracula.css" />
</head>
<body>
  <pre><code class="language-javascript">const x = 42;</code></pre>

  <script src="prism.js"></script>
  <script src="prism-languages/prism-javascript.js"></script>
  <script>
    Prism.highlightAll();
  </script>
</body>
</html>
```

**After (neo.highlight):**

```html
<!DOCTYPE html>
<html>
<body>
  <pre><code class="language-javascript">const x = 42;</code></pre>

  <script type="module">
    import { autoHighlight } from '@lpm.dev/neo.highlight/vanilla'
    import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
    import { dracula } from '@lpm.dev/neo.highlight/themes/dracula'

    autoHighlight({
      languages: [javascript],
      theme: dracula,
      observe: true,
    })
  </script>
</body>
</html>
```

### Step 3: Replace `Prism.highlightAll()` with `autoHighlight()`

**Before (Prism.js):**

```js
// Highlights all <pre><code> elements on the page
Prism.highlightAll();

// Or highlight a specific element
Prism.highlightElement(codeElement);
```

**After (neo.highlight):**

```ts
import { autoHighlight } from '@lpm.dev/neo.highlight/vanilla'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { python } from '@lpm.dev/neo.highlight/grammars/python'
import { dracula } from '@lpm.dev/neo.highlight/themes/dracula'

// Highlights all <pre><code> elements and watches for new ones
const cleanup = autoHighlight({
  languages: [javascript, python],
  theme: dracula,
  observe: true,    // watches for dynamically added code blocks
})

// Stop observing when done
cleanup()
```

### Step 4: Replace `Prism.highlight()` with `highlight()`

**Before (Prism.js):**

```js
const html = Prism.highlight(
  'const x = 42;',
  Prism.languages.javascript,
  'javascript'
);
```

**After (neo.highlight):**

```ts
import { highlight } from '@lpm.dev/neo.highlight/vanilla'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { dracula } from '@lpm.dev/neo.highlight/themes/dracula'

const html = highlight('const x = 42;', javascript, {
  theme: dracula,
  lineNumbers: true,
})
```

### Step 5: Replace language imports

Prism.js attaches languages to the global `Prism.languages` object. neo.highlight uses explicit per-language imports that are tree-shakeable.

**Before (Prism.js):**

```js
// Languages are added globally via script tags or require()
require('prismjs/components/prism-javascript');
require('prismjs/components/prism-python');
require('prismjs/components/prism-typescript');

// Access via global
const grammar = Prism.languages.javascript;
```

**After (neo.highlight):**

```ts
// Each language is an explicit import -- only what you use is bundled
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { python } from '@lpm.dev/neo.highlight/grammars/python'
import { typescript } from '@lpm.dev/neo.highlight/grammars/typescript'

// Or import all at once (not recommended for bundle size)
import { javascript, python, typescript } from '@lpm.dev/neo.highlight/grammars'
```

### Step 6: Replace theme CSS files with theme objects

Prism.js themes are standalone CSS files. neo.highlight themes are JavaScript objects that produce CSS custom properties, making them composable and programmable.

**Before (Prism.js):**

```html
<!-- Pick one CSS file -->
<link rel="stylesheet" href="prism-themes/prism-one-dark.css" />
```

**After (neo.highlight):**

```ts
import { oneDark } from '@lpm.dev/neo.highlight/themes/one-dark'
import { githubLight } from '@lpm.dev/neo.highlight/themes/github-light'

// Pass the theme object directly
highlight(code, javascript, { theme: oneDark })

// Switch themes at runtime -- no CSS file swapping needed
const currentTheme = isDarkMode ? oneDark : githubLight
highlight(code, javascript, { theme: currentTheme })
```

### Key Differences

| Concept | Prism.js | neo.highlight |
|---------|----------|---------------|
| Loading | Global `<script>` tags | ESM `import` statements |
| Languages | `Prism.languages.*` global object | Individual grammar imports |
| Themes | CSS files linked in `<head>` | Theme objects passed as arguments |
| Highlight all | `Prism.highlightAll()` | `autoHighlight({ languages, theme })` |
| Highlight one | `Prism.highlight(code, grammar, lang)` | `highlight(code, grammar, options)` |
| Plugins | Prism plugins (line-numbers, etc.) | Built-in options (`lineNumbers`, `highlightLines`) |
| Dynamic content | Manual re-call of `highlightAll()` | Built-in `observe: true` with MutationObserver |
| Bundle strategy | All-or-nothing, hard to tree-shake | Tree-shakeable per-grammar, per-theme imports |

### Common Gotchas

1. **No global object.** There is no `Prism` global. Every function and grammar must be explicitly imported. This is intentional -- it enables tree-shaking and prevents global namespace pollution.

2. **Languages are not auto-registered.** In Prism.js, importing a language script registers it globally. In neo.highlight, you must pass grammars explicitly to `autoHighlight()` or `highlight()`.

3. **Theme CSS classes differ.** If you wrote custom CSS targeting Prism's `.token.keyword` classes, you will need to update selectors to use neo.highlight's class prefix (default: `neo-hl`). For example, `.neo-hl-keyword` instead of `.token.keyword`.

4. **Prism plugins do not carry over.** Features like line-numbers, line-highlight, and autolinker are either built into neo.highlight (as `lineNumbers` and `highlightLines` options) or not needed. There is no plugin system to replicate.

5. **The `autoHighlight()` function returns a cleanup function.** Remember to call it when tearing down (e.g., in SPA route changes) to disconnect the MutationObserver.

---

## Migrating from highlight.js

### Step 1: Remove highlight.js and install neo.highlight

```bash
# Remove highlight.js
npm uninstall highlight.js

# Install neo.highlight
npm install @lpm.dev/neo.highlight
```

### Step 2: Replace `hljs.highlight()` with `highlight()`

**Before (highlight.js):**

```js
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

const result = hljs.highlight('const x = 42;', { language: 'javascript' });
console.log(result.value); // HTML string
```

**After (neo.highlight):**

```ts
import { highlight } from '@lpm.dev/neo.highlight/vanilla'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'

const html = highlight('const x = 42;', javascript, {
  theme: githubDark,
})
console.log(html) // HTML string
```

### Step 3: Replace `hljs.highlightAll()` with `autoHighlight()`

**Before (highlight.js):**

```js
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import 'highlight.js/styles/github-dark.css';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.highlightAll();
```

**After (neo.highlight):**

```ts
import { autoHighlight } from '@lpm.dev/neo.highlight/vanilla'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { python } from '@lpm.dev/neo.highlight/grammars/python'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'

const cleanup = autoHighlight({
  languages: [javascript, python],
  theme: githubDark,
  observe: true,
})
```

### Step 4: Replace language registration

highlight.js requires you to register languages before use. neo.highlight skips this -- grammars are passed directly where needed.

**Before (highlight.js):**

```js
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';

// Must register before use
hljs.registerLanguage('javascript', javascript);

// Then use by string name
hljs.highlight(code, { language: 'javascript' });
```

**After (neo.highlight):**

```ts
import { highlight } from '@lpm.dev/neo.highlight/vanilla'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'

// No registration needed -- pass the grammar directly
highlight(code, javascript)
```

### Step 5: Replace auto-detection

highlight.js offers automatic language detection via `hljs.highlightAuto()`. neo.highlight uses the `class="language-*"` attribute on code elements to determine the language, matching it against the grammars you provide.

**Before (highlight.js):**

```js
// Guesses the language
const result = hljs.highlightAuto(code);
console.log(result.language); // "javascript" (guessed)
```

**After (neo.highlight):**

```html
<!-- Specify language via class attribute -->
<pre><code class="language-javascript">const x = 42;</code></pre>
```

```ts
import { autoHighlight } from '@lpm.dev/neo.highlight/vanilla'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { python } from '@lpm.dev/neo.highlight/grammars/python'

// autoHighlight matches `class="language-*"` against provided grammars
autoHighlight({
  languages: [javascript, python],
  observe: true,
})
```

### Step 6: Replace theme CSS imports

**Before (highlight.js):**

```js
// CSS import -- hard to switch at runtime
import 'highlight.js/styles/github-dark.css';
```

**After (neo.highlight):**

```ts
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'
import { githubLight } from '@lpm.dev/neo.highlight/themes/github-light'

// Themes are objects -- switch at runtime trivially
const theme = prefersDark ? githubDark : githubLight
highlight(code, javascript, { theme })
```

### Key Differences

| Concept | highlight.js | neo.highlight |
|---------|-------------|---------------|
| API style | Global `hljs` object | Explicit function imports |
| Language loading | `hljs.registerLanguage()` | Direct grammar imports |
| Highlight code | `hljs.highlight(code, { language })` | `highlight(code, grammar, options)` |
| Highlight all | `hljs.highlightAll()` | `autoHighlight({ languages, theme })` |
| Auto-detection | `hljs.highlightAuto()` | Uses `class="language-*"` on elements |
| Themes | CSS file imports | Theme object imports |
| Line numbers | Not built-in (plugin needed) | Built-in `lineNumbers` option |
| Line highlighting | Not supported | Built-in `highlightLines` option |
| Dynamic content | Call `highlightAll()` again | `observe: true` handles it automatically |
| Bundle size | ~300KB+ with all languages | Tree-shakeable, import only what you need |

### Common Gotchas

1. **No `hljs` global.** Do not look for a global object. All functions are named exports from specific entry points (`/vanilla`, `/react`, `/grammars/*`, `/themes/*`).

2. **No language registration step.** You do not call `registerLanguage()`. Pass grammar objects directly to `highlight()` or `autoHighlight()`.

3. **No auto-detection.** neo.highlight does not guess languages. Use `class="language-javascript"` on your `<code>` elements, or pass the grammar explicitly in programmatic use.

4. **CSS class names differ.** If you have custom styles targeting highlight.js classes like `.hljs-keyword`, you need to update them to use the neo.highlight prefix (e.g., `.neo-hl-keyword`).

5. **Return value is a plain string, not an object.** `highlight()` returns an HTML string directly, not a result object with `.value`. There is no `.language` or `.relevance` property.

6. **`autoHighlight()` returns a cleanup function.** Unlike `hljs.highlightAll()`, which returns nothing, `autoHighlight()` returns a function you should call to disconnect the MutationObserver when cleaning up.

---

## Migrating from react-syntax-highlighter

### Step 1: Remove react-syntax-highlighter and install neo.highlight

```bash
# Remove react-syntax-highlighter
npm uninstall react-syntax-highlighter @types/react-syntax-highlighter

# Install neo.highlight
npm install @lpm.dev/neo.highlight
```

### Step 2: Replace the component

The main change: instead of a `language` string prop, you pass a grammar object. Instead of a `style` prop that maps to a massive CSS-in-JS bundle, you pass a theme object.

**Before (react-syntax-highlighter with Prism):**

```tsx
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

function CodeBlock({ code }: { code: string }) {
  return (
    <SyntaxHighlighter language="javascript" style={oneDark}>
      {code}
    </SyntaxHighlighter>
  );
}
```

**After (neo.highlight):**

```tsx
import { Highlight } from '@lpm.dev/neo.highlight/react'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { oneDark } from '@lpm.dev/neo.highlight/themes/one-dark'

function CodeBlock({ code }: { code: string }) {
  return (
    <Highlight language={javascript} theme={oneDark}>
      {code}
    </Highlight>
  );
}
```

### Step 3: Replace style/theme imports

react-syntax-highlighter bundles entire Prism.js or highlight.js style definitions as large JavaScript objects. neo.highlight themes are lightweight objects with CSS custom properties.

**Before (react-syntax-highlighter):**

```tsx
// Prism styles (~50KB+ per theme due to inline CSS-in-JS)
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Or highlight.js styles
import { githubDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
```

**After (neo.highlight):**

```tsx
// Lightweight theme objects (<1KB each)
import { oneDark } from '@lpm.dev/neo.highlight/themes/one-dark'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'
import { githubLight } from '@lpm.dev/neo.highlight/themes/github-light'
```

### Step 4: Replace line number configuration

**Before (react-syntax-highlighter):**

```tsx
<SyntaxHighlighter
  language="javascript"
  style={oneDark}
  showLineNumbers={true}
  startingLineNumber={1}
  wrapLines={true}
  lineProps={(lineNumber) => ({
    style: { backgroundColor: lineNumber === 3 ? '#ffe08a33' : undefined },
  })}
>
  {code}
</SyntaxHighlighter>
```

**After (neo.highlight):**

```tsx
<Highlight
  language={javascript}
  theme={oneDark}
  showLineNumbers={true}
  highlightLines={[3]}
>
  {code}
</Highlight>
```

### Step 5: Use the Provider for app-wide defaults

If you set up themes and options in many places, use `HighlightProvider` to configure defaults once.

**Before (react-syntax-highlighter):**

```tsx
// No provider pattern -- must pass style and language to every instance
function App() {
  return (
    <>
      <SyntaxHighlighter language="js" style={oneDark}>{code1}</SyntaxHighlighter>
      <SyntaxHighlighter language="py" style={oneDark}>{code2}</SyntaxHighlighter>
      <SyntaxHighlighter language="ts" style={oneDark}>{code3}</SyntaxHighlighter>
    </>
  );
}
```

**After (neo.highlight):**

```tsx
import { HighlightProvider, Highlight } from '@lpm.dev/neo.highlight/react'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { python } from '@lpm.dev/neo.highlight/grammars/python'
import { typescript } from '@lpm.dev/neo.highlight/grammars/typescript'
import { oneDark } from '@lpm.dev/neo.highlight/themes/one-dark'

function App() {
  return (
    <HighlightProvider
      theme={oneDark}
      languages={[javascript, python, typescript]}
      lineNumbers={true}
    >
      <Highlight language={javascript}>{code1}</Highlight>
      <Highlight language={python}>{code2}</Highlight>
      <Highlight language={typescript}>{code3}</Highlight>
    </HighlightProvider>
  );
}
```

### Step 6: Use the hook for custom rendering

If you need full control over the rendered output (custom token rendering, virtualized lists, etc.), use the `useHighlight` hook instead of the component.

**Before (react-syntax-highlighter):**

```tsx
// No hook API -- limited to component + renderer prop
<SyntaxHighlighter
  language="javascript"
  style={oneDark}
  renderer={({ rows, stylesheet, useInlineStyles }) => (
    // Custom render logic
  )}
>
  {code}
</SyntaxHighlighter>
```

**After (neo.highlight):**

```tsx
import { useHighlight } from '@lpm.dev/neo.highlight/react'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { oneDark } from '@lpm.dev/neo.highlight/themes/one-dark'

function CustomCodeBlock({ code }: { code: string }) {
  const { tokens, html } = useHighlight(code, javascript, {
    theme: oneDark,
    lineNumbers: true,
  })

  // Use `html` for direct rendering
  return <div dangerouslySetInnerHTML={{ __html: html }} />

  // Or iterate `tokens` for fully custom rendering
}
```

### Step 7: Replace auto-highlight for markdown/CMS content

If you use react-syntax-highlighter to highlight pre-rendered HTML (e.g., from a markdown parser), use the `AutoHighlight` component.

**Before (react-syntax-highlighter):**

```tsx
// Typically requires parsing markdown, extracting code blocks, and wrapping
// each one in a SyntaxHighlighter component manually
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          return !inline && match ? (
            <SyntaxHighlighter style={oneDark} language={match[1]}>
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          ) : (
            <code className={className} {...props}>{children}</code>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

**After (neo.highlight):**

```tsx
import { AutoHighlight } from '@lpm.dev/neo.highlight/react'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { python } from '@lpm.dev/neo.highlight/grammars/python'
import { oneDark } from '@lpm.dev/neo.highlight/themes/one-dark'

function MarkdownRenderer({ htmlContent }: { htmlContent: string }) {
  return (
    <AutoHighlight
      languages={[javascript, python]}
      theme={oneDark}
    >
      <article dangerouslySetInnerHTML={{ __html: htmlContent }} />
    </AutoHighlight>
  );
}
```

### Bundle Size Comparison

react-syntax-highlighter ships with the entire Prism.js or highlight.js engine, all languages, and all themes in its bundle, even when using the ESM "light" build.

| | react-syntax-highlighter | neo.highlight |
|---|---|---|
| Core library | ~180KB (Prism) or ~300KB (hljs) | <5KB |
| Per language | Bundled (all included) | ~1-3KB each (tree-shakeable) |
| Per theme | ~2-5KB (CSS-in-JS object) | <1KB (plain object) |
| Typical app (3 languages, 1 theme) | ~200-500KB | <10KB |
| All languages + all themes | ~500KB+ | ~100KB |

### Key Differences

| Concept | react-syntax-highlighter | neo.highlight |
|---------|--------------------------|---------------|
| Component | `<SyntaxHighlighter>` | `<Highlight>` |
| Language prop | `language="javascript"` (string) | `language={javascript}` (grammar object) |
| Theme prop | `style={oneDark}` (CSS-in-JS blob) | `theme={oneDark}` (lightweight object) |
| Line numbers | `showLineNumbers` prop | `showLineNumbers` prop |
| Line highlight | Custom `lineProps` function | `highlightLines={[3, 5]}` |
| Hook API | Not available | `useHighlight()` |
| Provider | Not available | `HighlightProvider` |
| Auto-highlight | Not available | `AutoHighlight` component |
| TypeScript | `@types/react-syntax-highlighter` | Built-in, first-class types |
| Engine | Prism.js or highlight.js under the hood | Custom engine, zero dependencies |

### Common Gotchas

1. **Language is an object, not a string.** The `language` prop accepts a `Grammar` object, not a language name string. Import the grammar and pass it directly.

2. **No `style` prop -- use `theme`.** The prop is called `theme`, not `style`. The `style` prop on the neo.highlight `<Highlight>` component maps to React's inline `style` (CSSProperties), not a syntax theme.

3. **Children must be a string.** The `<Highlight>` component expects a string child (the source code). Do not pass JSX elements as children.

4. **No Prism/hljs choice.** react-syntax-highlighter offers both `Prism` and `Light` variants with different engines. neo.highlight has a single engine. There is no decision to make.

5. **No `wrapLines` or `wrapLongLines`.** neo.highlight renders tokens in a `<pre><code>` wrapper by default. Long-line wrapping is handled via CSS (`white-space: pre-wrap` on the container), not via a prop.

6. **`@types/react-syntax-highlighter` is not needed.** neo.highlight is written in TypeScript and ships its own type definitions. Remove the DefinitelyTyped package after migration.

---

## Migrating from Shiki

### Step 1: Remove Shiki and install neo.highlight

```bash
# Remove Shiki
npm uninstall shiki

# Install neo.highlight
npm install @lpm.dev/neo.highlight
```

### Step 2: Replace async initialization with synchronous calls

Shiki requires an async initialization step to load its WASM-based TextMate engine. neo.highlight is fully synchronous -- no initialization, no WASM, no async.

**Before (Shiki):**

```ts
import { createHighlighter } from 'shiki';

// Must await initialization -- loads WASM and theme/grammar data
const highlighter = await createHighlighter({
  themes: ['github-dark'],
  langs: ['javascript', 'typescript', 'python'],
});

const html = highlighter.codeToHtml('const x = 42;', {
  lang: 'javascript',
  theme: 'github-dark',
});
```

**After (neo.highlight):**

```ts
import { highlight } from '@lpm.dev/neo.highlight/vanilla'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'

// Synchronous -- no initialization step
const html = highlight('const x = 42;', javascript, {
  theme: githubDark,
})
```

### Step 3: Replace the React integration

**Before (Shiki with React):**

```tsx
import { useEffect, useState } from 'react';
import { createHighlighter, type Highlighter } from 'shiki';

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [html, setHtml] = useState('');

  useEffect(() => {
    let cancelled = false;

    createHighlighter({
      themes: ['github-dark'],
      langs: [lang],
    }).then((highlighter) => {
      if (!cancelled) {
        setHtml(
          highlighter.codeToHtml(code, {
            lang,
            theme: 'github-dark',
          })
        );
      }
    });

    return () => { cancelled = true; };
  }, [code, lang]);

  if (!html) return <pre><code>{code}</code></pre>; // Loading fallback

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

**After (neo.highlight):**

```tsx
import { Highlight } from '@lpm.dev/neo.highlight/react'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'

// No loading state, no useEffect, no async
function CodeBlock({ code }: { code: string }) {
  return (
    <Highlight language={javascript} theme={githubDark}>
      {code}
    </Highlight>
  );
}
```

### Step 4: Replace TextMate themes with CSS custom property themes

Shiki uses TextMate/VS Code theme files (JSON with complex scope selectors). neo.highlight uses simple JavaScript objects with named token colors.

**Before (Shiki):**

```ts
// Use a built-in VS Code theme by name
const highlighter = await createHighlighter({
  themes: ['github-dark', 'monokai'],
  langs: ['javascript'],
});

// Or load a custom TextMate theme
import myTheme from './my-theme.json';

const highlighter = await createHighlighter({
  themes: [myTheme],
  langs: ['javascript'],
});
```

**After (neo.highlight):**

```ts
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'
import { monokai } from '@lpm.dev/neo.highlight/themes/monokai'

highlight(code, javascript, { theme: githubDark })
highlight(code, javascript, { theme: monokai })

// Or define a custom theme inline
import type { Theme } from '@lpm.dev/neo.highlight'

const myTheme: Theme = {
  name: 'my-theme',
  background: '#1a1a2e',
  foreground: '#e0e0e0',
  tokenColors: {
    keyword: '#c792ea',
    string: '#c3e88d',
    comment: '#546e7a',
    function: '#82aaff',
    number: '#f78c6c',
    operator: '#89ddff',
    punctuation: '#89ddff',
  },
}

highlight(code, javascript, { theme: myTheme })
```

### Step 5: Replace multi-theme support

Shiki supports rendering with multiple themes simultaneously (for light/dark mode via CSS). neo.highlight handles theme switching by re-rendering with a different theme object, or by using CSS custom properties.

**Before (Shiki):**

```ts
const html = highlighter.codeToHtml(code, {
  lang: 'javascript',
  themes: {
    light: 'github-light',
    dark: 'github-dark',
  },
});
// Outputs HTML with CSS variables for both themes
```

**After (neo.highlight):**

```tsx
import { Highlight } from '@lpm.dev/neo.highlight/react'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'
import { githubLight } from '@lpm.dev/neo.highlight/themes/github-light'

function CodeBlock({ code, isDark }: { code: string; isDark: boolean }) {
  return (
    <Highlight
      language={javascript}
      theme={isDark ? githubDark : githubLight}
    >
      {code}
    </Highlight>
  );
}
```

### Step 6: Replace `autoHighlight` for server-rendered or static content

**Before (Shiki):**

```ts
// Shiki is often used at build time (SSG/SSR)
// Requires async setup in getStaticProps, middleware, etc.
export async function getStaticProps() {
  const highlighter = await createHighlighter({
    themes: ['github-dark'],
    langs: ['javascript'],
  });

  const html = highlighter.codeToHtml(code, {
    lang: 'javascript',
    theme: 'github-dark',
  });

  return { props: { html } };
}
```

**After (neo.highlight):**

```ts
import { highlight } from '@lpm.dev/neo.highlight/vanilla'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'

// Synchronous -- works in getStaticProps, middleware, edge functions, etc.
export function getStaticProps() {
  const html = highlight(code, javascript, { theme: githubDark })
  return { props: { html } }
}
```

### Key Differences

| Concept | Shiki | neo.highlight |
|---------|-------|---------------|
| Initialization | `await createHighlighter(...)` (async) | None (synchronous) |
| WASM dependency | Yes (~1.5MB) | None |
| Highlight code | `highlighter.codeToHtml(code, opts)` | `highlight(code, grammar, opts)` |
| Themes | TextMate JSON themes (VS Code format) | Simple JS/TS theme objects |
| Grammars | TextMate grammar files | Regex-based grammar objects |
| Multi-theme | Built-in CSS variable output | Pass different theme objects |
| SSR | Works but requires async setup | Synchronous, no setup needed |
| React | No built-in component | `<Highlight>` and `<AutoHighlight>` |
| Bundle size | ~1.5MB+ (WASM + themes + grammars) | <10KB typical |
| Edge runtime | Requires WASM support | Works everywhere (pure JS) |

### Common Gotchas

1. **No async initialization.** Do not look for `createHighlighter()` or any async factory. Everything is synchronous. Import, call, done.

2. **No WASM.** neo.highlight is pure JavaScript. It runs in any environment: Node.js, Bun, Deno, browsers, edge functions, Cloudflare Workers. No WASM setup or configuration needed.

3. **TextMate grammars are not compatible.** You cannot reuse `.tmLanguage` files from Shiki or VS Code. neo.highlight uses its own regex-based grammar format (similar in concept to Prism.js grammars).

4. **TextMate themes are not compatible.** You cannot reuse `.tmTheme` or VS Code JSON theme files. Create a neo.highlight `Theme` object instead. The mapping is straightforward -- see the custom theme example above.

5. **No `loadLanguage()` or `loadTheme()` at runtime.** All grammars and themes are static imports. If you need to load them conditionally, use dynamic `import()` yourself.

6. **Highlighting accuracy may differ.** Shiki uses the exact same TextMate engine as VS Code, giving pixel-perfect VS Code highlighting. neo.highlight uses a faster regex-based approach. The output is visually similar but not identical for edge cases in complex grammars.

7. **No decorations API.** Shiki supports inline decorations (custom classes/styles on specific ranges). neo.highlight provides `highlightLines` for line-level highlighting. For token-level customization, use the `useHighlight` hook and process the `tokens` array directly.

---

## Quick Reference Table

A side-by-side lookup for common operations across all four libraries and neo.highlight.

| Task | Prism.js | highlight.js | react-syntax-highlighter | Shiki | neo.highlight |
|------|----------|-------------|--------------------------|-------|---------------|
| Install | `prismjs` | `highlight.js` | `react-syntax-highlighter` | `shiki` | `@lpm.dev/neo.highlight` |
| Highlight string | `Prism.highlight(code, grammar, lang)` | `hljs.highlight(code, {language})` | N/A (component only) | `await highlighter.codeToHtml(code, opts)` | `highlight(code, grammar, opts)` |
| Highlight all DOM | `Prism.highlightAll()` | `hljs.highlightAll()` | N/A | N/A | `autoHighlight({ languages, theme })` |
| React component | N/A | N/A | `<SyntaxHighlighter>` | N/A | `<Highlight>` |
| React auto-scan | N/A | N/A | N/A | N/A | `<AutoHighlight>` |
| React hook | N/A | N/A | N/A | N/A | `useHighlight()` |
| Load language | `<script>` or `require()` | `hljs.registerLanguage()` | Automatic | `createHighlighter({ langs })` | `import { js } from '.../grammars/javascript'` |
| Load theme | `<link>` CSS file | `import` CSS file | `import` style object | `createHighlighter({ themes })` | `import { githubDark } from '.../themes/github-dark'` |
| Line numbers | Plugin | Third-party | `showLineNumbers` prop | Not built-in | `lineNumbers: true` or `showLineNumbers` prop |
| Line highlighting | Plugin | Not supported | `lineProps` function | Decorations API | `highlightLines: [1, 3, 5]` |
| Dynamic content | Re-call `highlightAll()` | Re-call `highlightAll()` | React re-render | Re-call `codeToHtml()` | `observe: true` (MutationObserver) |
| Async required | No | No | No | Yes | No |
| WASM required | No | No | No | Yes | No |
| TypeScript | `@types/prismjs` | Built-in (partial) | `@types/react-syntax-highlighter` | Built-in | Built-in |
| Tree-shakeable | No | Partial | No | N/A | Yes |
| Zero dependencies | No | Yes | No (depends on Prism/hljs) | No (oniguruma WASM) | Yes |

---

## Available Grammars

neo.highlight ships with grammars for the following languages, each importable individually:

`javascript`, `typescript`, `python`, `jsx`, `tsx`, `html`, `css`, `scss`, `json`, `yaml`, `markdown`, `graphql`, `ruby`, `go`, `rust`, `java`, `kotlin`, `swift`, `php`, `c`, `cpp`, `csharp`, `bash`, `shell`, `docker`, `sql`, `toml`, `ini`, `diff`, `regex`

```ts
// Import individually (recommended -- tree-shakeable)
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { python } from '@lpm.dev/neo.highlight/grammars/python'

// Or import from the barrel export
import { javascript, python } from '@lpm.dev/neo.highlight/grammars'
```

## Available Themes

`githubDark`, `githubLight`, `oneDark`, `dracula`, `nord`, `monokai`, `solarizedLight`, `solarizedDark`, `nightOwl`, `tokyoNight`

```ts
// Import individually (recommended)
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'

// Or import from the barrel export
import { githubDark, oneDark } from '@lpm.dev/neo.highlight/themes'
```

## Creating Custom Themes

If your existing theme is not available as a built-in, you can define your own:

```ts
import type { Theme } from '@lpm.dev/neo.highlight'

const myTheme: Theme = {
  name: 'my-custom-theme',
  background: '#282c34',
  foreground: '#abb2bf',
  selection: '#3e4451',
  lineNumber: '#636d83',
  lineNumberActive: '#abb2bf',
  lineHighlight: '#2c313c',
  tokenColors: {
    keyword: '#c678dd',
    string: '#98c379',
    comment: '#5c6370',
    number: '#d19a66',
    boolean: '#d19a66',
    function: '#61afef',
    operator: '#56b6c2',
    punctuation: '#abb2bf',
    variable: '#e06c75',
    'class-name': '#e5c07b',
    constant: '#d19a66',
    property: '#e06c75',
    tag: '#e06c75',
    'attr-name': '#d19a66',
    'attr-value': '#98c379',
    regex: '#98c379',
    builtin: '#e5c07b',
  },
}
```

Map your existing Prism.js, highlight.js, or TextMate theme colors into the `tokenColors` keys listed above. The key names match standard token types used across all grammars.
