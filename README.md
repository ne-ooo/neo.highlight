# @lpm.dev/neo.highlight

**Modern, zero-dependency syntax highlighter for the web.**

---

## Why This?

Every existing syntax highlighter requires tradeoffs -- bloated bundles, missing TypeScript support, runtime dependencies, or no tree-shaking. `@lpm.dev/neo.highlight` eliminates all of them.

| Feature               | neo.highlight | Prism.js | highlight.js | Shiki          | react-syntax-highlighter | sugar-high |
| --------------------- | ------------- | -------- | ------------ | -------------- | ------------------------ | ---------- |
| ESM native            | Yes           | No       | Partial      | Yes            | No                       | Yes        |
| TypeScript source     | Yes           | No       | No           | Yes            | No                       | Yes        |
| Zero dependencies     | Yes           | Yes      | Yes          | No (oniguruma) | No (7+ deps)             | Yes        |
| Bundle size (core)    | ~3.8 KB       | ~6 KB    | ~30 KB       | ~1 MB+         | ~40 KB+                  | ~3 KB      |
| Tree-shakeable        | Yes           | No       | No           | No             | No                       | Partial    |
| React adapter         | Built-in      | Plugin   | Plugin       | Plugin         | Core                     | No         |
| Auto-scan (DOM)       | Built-in      | Built-in | Built-in     | No             | No                       | No         |
| MutationObserver      | Built-in      | No       | No           | No             | No                       | No         |
| SSR support           | Yes           | Manual   | Manual       | Yes            | Yes                      | Yes        |
| Languages             | 55            | 290+     | 190+         | 190+           | 190+                     | ~10        |
| Themes                | 10            | 8        | 90+          | 30+            | 80+                      | 1          |
| CSS custom properties | Yes           | No       | No           | No             | No                       | Yes        |

---

## Key Features

- **Zero dependencies** -- nothing to install, nothing to break
- **~3.8 KB core** gzipped -- load only what you use
- **55 languages** with accurate grammar definitions
- **10 themes** including GitHub Dark, Dracula, Nord, Tokyo Night
- **React + Vanilla JS** -- first-class adapters for both
- **Component mode** -- `<Highlight>` for explicit code blocks
- **Auto-scan mode** -- `<AutoHighlight>` / `autoHighlight()` finds and highlights `<code>` elements
- **MutationObserver** -- watches for dynamically added code blocks in SPAs
- **CSS custom properties** -- theme values exposed as `--neo-hl-*` variables
- **Tree-shakeable** -- import only the languages and themes you need
- **SSR support** -- `getThemeStylesheet()` generates CSS at build time
- **Full TypeScript** -- strict mode, every type exported, zero `any`

---

## Quick Start

### Installation

```bash
lpm install @lpm.dev/neo.highlight
```

### React

```tsx
import { Highlight } from "@lpm.dev/neo.highlight/react";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

function App() {
  return (
    <Highlight language={javascript} theme={githubDark}>
      {`const greeting = "Hello, world!";
console.log(greeting);`}
    </Highlight>
  );
}
```

### Vanilla JS

```ts
import { highlight } from "@lpm.dev/neo.highlight/vanilla";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

const html = highlight(`const greeting = "Hello, world!";`, javascript, {
  theme: githubDark,
  lineNumbers: true,
});

document.getElementById("code").innerHTML = html;
```

---

## React API

Import from `@lpm.dev/neo.highlight/react`.

### `<Highlight>`

Renders a single code block with syntax highlighting.

```tsx
import { Highlight } from "@lpm.dev/neo.highlight/react";
import { typescript } from "@lpm.dev/neo.highlight/grammars/typescript";
import { dracula } from "@lpm.dev/neo.highlight/themes/dracula";

<Highlight
  language={typescript}
  theme={dracula}
  showLineNumbers
  highlightLines={[2, 3]}
  className="my-code-block"
>
  {`interface User {
  name: string;
  email: string;
}`}
</Highlight>;
```

**Props:**

| Prop              | Type              | Default      | Description                           |
| ----------------- | ----------------- | ------------ | ------------------------------------- |
| `children`        | `string`          | required     | Source code to highlight              |
| `language`        | `Grammar`         | required     | Grammar definition for the language   |
| `theme`           | `Theme \| string` | from context | Theme object or registered theme name |
| `showLineNumbers` | `boolean`         | from context | Show line numbers                     |
| `highlightLines`  | `number[]`        | --           | Lines to highlight (1-indexed)        |
| `classPrefix`     | `string`          | `"neo-hl"`   | CSS class prefix                      |
| `className`       | `string`          | --           | Additional CSS class for the wrapper  |
| `style`           | `CSSProperties`   | --           | Inline styles for the wrapper         |

### `<AutoHighlight>`

Scans its children for `<code>` elements and highlights them automatically. Uses `MutationObserver` to watch for dynamically added content.

```tsx
import { AutoHighlight } from "@lpm.dev/neo.highlight/react";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { python } from "@lpm.dev/neo.highlight/grammars/python";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

<AutoHighlight languages={[javascript, python]} theme={githubDark}>
  <article dangerouslySetInnerHTML={{ __html: markdownHtml }} />
</AutoHighlight>;
```

Language is detected from class names (`language-js`, `lang-python`) or the `data-language` attribute on the `<code>` or `<pre>` element.

**Props:**

| Prop          | Type              | Default      | Description                           |
| ------------- | ----------------- | ------------ | ------------------------------------- |
| `children`    | `ReactNode`       | required     | Content containing `<code>` elements  |
| `languages`   | `Grammar[]`       | from context | Grammars available for detection      |
| `theme`       | `Theme \| string` | from context | Theme object or registered theme name |
| `selector`    | `string`          | `"pre code"` | CSS selector for code elements        |
| `lineNumbers` | `boolean`         | from context | Show line numbers                     |
| `classPrefix` | `string`          | `"neo-hl"`   | CSS class prefix                      |
| `className`   | `string`          | --           | Additional CSS class for the wrapper  |
| `style`       | `CSSProperties`   | --           | Inline styles for the wrapper         |

### `<HighlightProvider>`

Provides default theme, languages, and options to all nested highlight components via React context. Avoids repeating props on every component.

```tsx
import {
  HighlightProvider,
  Highlight,
  AutoHighlight,
} from "@lpm.dev/neo.highlight/react";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { python } from "@lpm.dev/neo.highlight/grammars/python";
import { tokyoNight } from "@lpm.dev/neo.highlight/themes/tokyo-night";

function App() {
  return (
    <HighlightProvider
      theme={tokyoNight}
      languages={[javascript, python]}
      lineNumbers
    >
      {/* All children inherit theme, languages, and lineNumbers */}
      <Highlight language={javascript}>{`const x = 42;`}</Highlight>

      <AutoHighlight>
        <div dangerouslySetInnerHTML={{ __html: blogContent }} />
      </AutoHighlight>
    </HighlightProvider>
  );
}
```

**Props:**

| Prop          | Type              | Default    | Description                         |
| ------------- | ----------------- | ---------- | ----------------------------------- |
| `children`    | `ReactNode`       | required   | Child components                    |
| `theme`       | `Theme \| string` | --         | Default theme for all children      |
| `languages`   | `Grammar[]`       | `[]`       | Default grammars for auto-highlight |
| `classPrefix` | `string`          | `"neo-hl"` | Default CSS class prefix            |
| `lineNumbers` | `boolean`         | `false`    | Default line numbers setting        |

### `useHighlight`

Hook for full control over tokenization and rendering. Returns both the raw token array and the rendered HTML string, both memoized.

```tsx
import { useHighlight } from "@lpm.dev/neo.highlight/react";
import { rust } from "@lpm.dev/neo.highlight/grammars/rust";
import { nord } from "@lpm.dev/neo.highlight/themes/nord";

function CodeBlock({ code }: { code: string }) {
  const { tokens, html } = useHighlight(code, rust, {
    theme: nord,
    lineNumbers: true,
    highlightLines: [1],
    wrapCode: true,
  });

  // Use `html` directly
  return <div dangerouslySetInnerHTML={{ __html: html }} />;

  // Or iterate over `tokens` for custom rendering
}
```

**Parameters:**

| Parameter  | Type                  | Description                                                  |
| ---------- | --------------------- | ------------------------------------------------------------ |
| `code`     | `string`              | Source code to highlight                                     |
| `language` | `Grammar`             | Grammar definition                                           |
| `options`  | `UseHighlightOptions` | Theme, line numbers, highlight lines, class prefix, wrapCode |

**Returns:** `{ tokens: Token[], html: string }`

### `useHighlightContext`

Access the current `HighlightProvider` context values directly.

```tsx
import { useHighlightContext } from "@lpm.dev/neo.highlight/react";

function DebugInfo() {
  const { theme, languages, classPrefix, lineNumbers } = useHighlightContext();
  // ...
}
```

---

## Vanilla API

Import from `@lpm.dev/neo.highlight/vanilla`.

### `highlight(code, language, options?)`

Highlight source code and return an HTML string.

```ts
import { highlight } from "@lpm.dev/neo.highlight/vanilla";
import { python } from "@lpm.dev/neo.highlight/grammars/python";
import { oneDark } from "@lpm.dev/neo.highlight/themes/one-dark";

const html = highlight(
  `def greet(name):
    return f"Hello, {name}!"`,
  python,
  {
    theme: oneDark,
    lineNumbers: true,
    highlightLines: [2],
    wrapCode: true,
  },
);
```

**Options:**

| Option           | Type              | Default    | Description                     |
| ---------------- | ----------------- | ---------- | ------------------------------- |
| `theme`          | `Theme \| string` | --         | Theme object or registered name |
| `lineNumbers`    | `boolean`         | `false`    | Show line numbers               |
| `highlightLines` | `number[]`        | --         | Lines to highlight (1-indexed)  |
| `classPrefix`    | `string`          | `"neo-hl"` | CSS class prefix                |
| `wrapCode`       | `boolean`         | `true`     | Wrap output in `<pre><code>`    |

### `autoHighlight(options)`

Scan the page for code blocks and optionally observe for dynamically added ones. Returns a cleanup function.

```ts
import { autoHighlight } from "@lpm.dev/neo.highlight/vanilla";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { typescript } from "@lpm.dev/neo.highlight/grammars/typescript";
import { css } from "@lpm.dev/neo.highlight/grammars/css";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

// Highlight all existing code blocks and watch for new ones
const cleanup = autoHighlight({
  languages: [javascript, typescript, css],
  theme: githubDark,
  observe: true, // Use MutationObserver for SPAs
  selector: "pre code", // CSS selector to match
  lineNumbers: false,
});

// Later, to stop observing:
cleanup();
```

Language detection reads from the `<code>` or `<pre>` element:

- `class="language-javascript"` or `class="lang-js"`
- `data-language="javascript"`

### `scan(options)`

One-shot scan. Finds all matching elements and highlights them. Returns the number of elements highlighted.

```ts
import { scan } from "@lpm.dev/neo.highlight/vanilla";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";

const count = scan({
  languages: [javascript],
  selector: "pre code",
  container: document.getElementById("article"),
});

console.log(`Highlighted ${count} code blocks`);
```

### `observe(options)`

Continuous scan. Highlights existing elements, then uses `MutationObserver` to watch for new ones. Returns a cleanup function.

```ts
import { observe } from "@lpm.dev/neo.highlight/vanilla";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

const disconnect = observe({
  languages: [javascript],
  theme: githubDark,
  container: document.body,
});

// Stop observing when done:
disconnect();
```

---

## Core Utilities

Import from `@lpm.dev/neo.highlight`.

### `resolveGrammar(language, grammars)`

Resolve a language string to a `Grammar` object by checking grammar names and aliases. Useful when you have a language identifier from user input (e.g. `"js"`, `"py"`, `"tsx"`) and need to find the matching grammar.

```ts
import { resolveGrammar } from "@lpm.dev/neo.highlight";
import { javascript, python, typescript } from "@lpm.dev/neo.highlight/grammars";

const grammars = [javascript, python, typescript];

resolveGrammar("js", grammars);         // → javascript grammar
resolveGrammar("python", grammars);     // → python grammar
resolveGrammar("typescript", grammars); // → typescript grammar
resolveGrammar("unknown", grammars);    // → undefined
```

**Parameters:**

| Parameter  | Type        | Description                    |
| ---------- | ----------- | ------------------------------ |
| `language` | `string`    | Language name or alias         |
| `grammars` | `Grammar[]` | Array of grammars to search in |

**Returns:** `Grammar | undefined`

### `validateThemeContrast(theme)`

Validate a theme's token colors against WCAG AA contrast requirements (4.5:1 minimum ratio). Returns a detailed per-token report.

```ts
import { validateThemeContrast } from "@lpm.dev/neo.highlight";
import { nord } from "@lpm.dev/neo.highlight/themes/nord";

const report = validateThemeContrast(nord);
// report.passes — boolean, true if all tokens pass
// report.tokens — array of { name, foreground, background, ratio, passes }
```

**Returns:** `{ passes: boolean, theme: string, tokens: TokenContrastReport[] }`

### `contrastRatio(color1, color2)`

Calculate the WCAG 2.0 contrast ratio between two hex colors. Returns a value between 1 and 21.

```ts
import { contrastRatio } from "@lpm.dev/neo.highlight";

contrastRatio("#ffffff", "#000000"); // → 21
contrastRatio("#767676", "#ffffff"); // → ~4.54
```

### `meetsWCAG_AA(foreground, background, isLargeText?)`

Check whether a foreground/background color pair meets WCAG AA. Normal text requires 4.5:1; large text (18px+ bold or 24px+) requires 3:1.

```ts
import { meetsWCAG_AA } from "@lpm.dev/neo.highlight";

meetsWCAG_AA("#767676", "#ffffff");        // → true  (4.54:1 >= 4.5)
meetsWCAG_AA("#808080", "#ffffff");        // → false (3.95:1 < 4.5)
meetsWCAG_AA("#808080", "#ffffff", true);  // → true  (3.95:1 >= 3.0 for large text)
```

### `hexToRGB(hex)`

Parse a hex color string (`"#rgb"` or `"#rrggbb"`) to an `[r, g, b]` tuple.

```ts
import { hexToRGB } from "@lpm.dev/neo.highlight";

hexToRGB("#ff9e64"); // → [255, 158, 100]
hexToRGB("#fff");    // → [255, 255, 255]
```

### `relativeLuminance(r, g, b)`

Calculate the WCAG 2.0 relative luminance of an RGB color. Returns a value between 0 (black) and 1 (white).

```ts
import { relativeLuminance } from "@lpm.dev/neo.highlight";

relativeLuminance(255, 255, 255); // → 1
relativeLuminance(0, 0, 0);       // → 0
```

### `getDualThemeStylesheet(lightTheme, darkTheme, options?)`

Generate a CSS stylesheet containing both light and dark theme variables. By default uses `@media (prefers-color-scheme: dark)` to switch; pass `darkSelector` for class-based toggling.

```ts
import { getDualThemeStylesheet } from "@lpm.dev/neo.highlight";
import { solarizedLight } from "@lpm.dev/neo.highlight/themes/solarized-light";
import { solarizedDark } from "@lpm.dev/neo.highlight/themes/solarized-dark";

// Media query (default)
const css = getDualThemeStylesheet(solarizedLight, solarizedDark);

// Class-based
const css2 = getDualThemeStylesheet(solarizedLight, solarizedDark, {
  darkSelector: "[data-theme='dark']",
});
```

**Options:**

| Option         | Type     | Default                                    | Description                              |
| -------------- | -------- | ------------------------------------------ | ---------------------------------------- |
| `darkSelector` | `string` | `@media (prefers-color-scheme: dark)` rule | CSS selector to scope the dark overrides |

---

## Languages

55 languages with tree-shakeable imports. Import only what you need.

```ts
// Import a single language
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";

// Or import several
import {
  javascript,
  typescript,
  python,
} from "@lpm.dev/neo.highlight/grammars";
```

| Language   | Import       | Aliases                                                       |
| ---------- | ------------ | ------------------------------------------------------------- |
| JavaScript | `javascript` | `js`, `mjs`, `cjs`                                            |
| TypeScript | `typescript` | `ts`, `mts`, `cts`                                            |
| Python     | `python`     | `py`                                                          |
| JSX        | `jsx`        | `react`                                                       |
| TSX        | `tsx`        | --                                                            |
| HTML       | `html`       | `htm`, `xml`, `svg`, `mathml`                                 |
| CSS        | `css`        | --                                                            |
| SCSS       | `scss`       | `sass`                                                        |
| JSON       | `json`       | `jsonc`, `json5`                                              |
| YAML       | `yaml`       | `yml`                                                         |
| Markdown   | `markdown`   | `md`, `mdx`                                                   |
| GraphQL    | `graphql`    | `gql`                                                         |
| Ruby       | `ruby`       | `rb`                                                          |
| Go         | `go`         | `golang`                                                      |
| Rust       | `rust`       | `rs`                                                          |
| Java       | `java`       | --                                                            |
| Kotlin     | `kotlin`     | `kt`, `kts`                                                   |
| Swift      | `swift`      | --                                                            |
| PHP        | `php`        | --                                                            |
| C          | `c`          | `h`                                                           |
| C++        | `cpp`        | `c++`, `cxx`, `cc`, `hpp`, `hxx`, `hh`                        |
| C#         | `csharp`     | `cs`, `c#`, `dotnet`                                          |
| Bash       | `bash`       | `zsh`                                                         |
| Shell      | `shell`      | `sh`, `posix-shell`                                           |
| Dockerfile | `docker`     | `dockerfile`                                                  |
| SQL        | `sql`        | `mysql`, `pgsql`, `postgres`, `postgresql`, `sqlite`, `plsql` |
| TOML       | `toml`       | --                                                            |
| INI        | `ini`        | `conf`, `cfg`, `env`, `properties`                            |
| Diff       | `diff`       | `patch`                                                       |
| Regex      | `regex`      | `regexp`                                                      |
| Lua        | `lua`        | --                                                            |
| Dart       | `dart`       | --                                                            |
| Elixir     | `elixir`     | `ex`, `exs`                                                   |
| Scala      | `scala`      | `sc`                                                          |
| R          | `r`          | `rlang`                                                       |
| Svelte     | `svelte`     | --                                                            |
| Vue        | `vue`        | `vue-html`                                                    |
| Astro      | `astro`      | --                                                            |
| Zig        | `zig`        | --                                                            |
| WASM       | `wasm`       | `wat`, `wast`                                                 |
| Haskell    | `haskell`    | `hs`                                                          |
| Erlang     | `erlang`     | `erl`                                                         |
| Clojure    | `clojure`    | `clj`, `cljs`, `cljc`, `edn`                                 |
| OCaml      | `ocaml`      | `ml`                                                          |
| Perl       | `perl`       | `pl`                                                          |
| Objective-C| `objectivec` | `objc`, `obj-c`                                               |
| PowerShell | `powershell` | `ps1`, `posh`                                                 |
| Terraform  | `terraform`  | `hcl`, `tf`                                                   |
| Prisma     | `prisma`     | --                                                            |
| Nix        | `nix`        | `nixos`                                                       |
| LaTeX      | `latex`      | `tex`                                                         |
| Less       | `less`       | --                                                            |
| Handlebars | `handlebars` | `hbs`, `mustache`                                             |
| Solidity   | `solidity`   | `sol`                                                         |
| CSV        | `csv`        | `tsv`                                                         |

---

## Themes

10 built-in themes with tree-shakeable imports.

```ts
// Import a single theme
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

// Or import several
import { githubDark, dracula, nord } from "@lpm.dev/neo.highlight/themes";
```

| Theme           | Import           | Description                            |
| --------------- | ---------------- | -------------------------------------- |
| GitHub Dark     | `githubDark`     | GitHub's dark mode color scheme        |
| GitHub Light    | `githubLight`    | GitHub's light mode color scheme       |
| One Dark        | `oneDark`        | Atom One Dark theme                    |
| Dracula         | `dracula`        | Dracula color scheme                   |
| Nord            | `nord`           | Arctic, north-bluish color palette     |
| Monokai         | `monokai`        | Classic Monokai color scheme           |
| Solarized Light | `solarizedLight` | Ethan Schoonover's Solarized (light)   |
| Solarized Dark  | `solarizedDark`  | Ethan Schoonover's Solarized (dark)    |
| Night Owl       | `nightOwl`       | Sarah Drasner's Night Owl theme        |
| Tokyo Night     | `tokyoNight`     | Inspired by Tokyo city lights at night |

All built-in themes pass WCAG AA contrast requirements (4.5:1 minimum ratio against their background).

---

## Theme Accessibility

Validate any theme (built-in or custom) against WCAG AA contrast requirements using `validateThemeContrast()`:

```ts
import { validateThemeContrast } from "@lpm.dev/neo.highlight";
import { dracula } from "@lpm.dev/neo.highlight/themes/dracula";

const report = validateThemeContrast(dracula);

console.log(report.passes); // true — all tokens meet 4.5:1 ratio
console.log(report.theme);  // "dracula"

for (const token of report.tokens) {
  console.log(
    `${token.name}: ${token.ratio.toFixed(1)}:1 — ${token.passes ? "PASS" : "FAIL"}`,
  );
}
```

The report includes each token's foreground color, background color, computed contrast ratio, and whether it passes the 4.5:1 threshold.

---

## Dual Theme (Light/Dark)

Generate a stylesheet that switches between a light and a dark theme automatically using `getDualThemeStylesheet()`:

### Using `prefers-color-scheme` (default)

```ts
import { getDualThemeStylesheet } from "@lpm.dev/neo.highlight";
import { githubLight } from "@lpm.dev/neo.highlight/themes/github-light";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

const css = getDualThemeStylesheet(githubLight, githubDark);
// Produces CSS with:
//   Root styles use githubLight values
//   @media (prefers-color-scheme: dark) { ... } overrides with githubDark values
```

### Using a class selector

```ts
const css = getDualThemeStylesheet(githubLight, githubDark, {
  darkSelector: ".dark",
});
// Produces CSS with:
//   Root styles use githubLight values
//   .dark { ... } overrides with githubDark values
```

Inject the returned CSS into a `<style>` tag. Theme switching works without any JavaScript -- it follows the user's OS preference or your class toggle.

---

## Custom Themes

Create a custom theme by defining a `Theme` object:

```ts
import type { Theme } from "@lpm.dev/neo.highlight";

const myTheme: Theme = {
  name: "my-theme",
  background: "#1a1b26",
  foreground: "#c0caf5",
  selection: "#33467c",
  lineNumber: "#3b4261",
  lineNumberActive: "#c0caf5",
  lineHighlight: "#292e42",
  tokenColors: {
    comment: "#565f89",
    keyword: "#9d7cd8",
    string: "#9ece6a",
    number: "#ff9e64",
    boolean: "#ff9e64",
    function: "#7aa2f7",
    operator: "#89ddff",
    punctuation: "#c0caf5",
    variable: "#c0caf5",
    "class-name": "#f7768e",
    constant: "#ff9e64",
    property: "#73daca",
    tag: "#f7768e",
    "attr-name": "#7aa2f7",
    "attr-value": "#9ece6a",
    selector: "#9ece6a",
    regex: "#b4f9f8",
    builtin: "#7aa2f7",
    important: "#f7768e",
    inserted: "#9ece6a",
    deleted: "#f7768e",
    changed: "#ff9e64",
    namespace: "#9d7cd8",
    parameter: "#e0af68",
    interpolation: "#73daca",
    "template-string": "#9ece6a",
    decorator: "#9d7cd8",
  },
};
```

Theme colors are applied as inline CSS custom properties (`--neo-hl-*`) and can be overridden in your own stylesheets:

```css
.neo-hl {
  --neo-hl-bg: #1e1e2e;
  --neo-hl-fg: #cdd6f4;
  --neo-hl-keyword: #cba6f7;
  --neo-hl-string: #a6e3a1;
}
```

---

## Use with neo.markdown

neo.highlight integrates with `@lpm.dev/neo.markdown` via its highlight plugin. Pass `tokenize`, `renderToHTML`, and `getThemeStylesheet` directly:

```ts
import { createParser } from "@lpm.dev/neo.markdown";
import { highlightPlugin } from "@lpm.dev/neo.markdown/plugins/highlight";
import { tokenize, renderToHTML, getThemeStylesheet } from "@lpm.dev/neo.highlight";
import { javascript, typescript, python } from "@lpm.dev/neo.highlight/grammars";
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
```

Code blocks in the markdown output are automatically syntax-highlighted with proper theme colors.

---

## SSR Support

Both the React and vanilla APIs work in server-side rendering environments out of the box. The `highlight()` function and `<Highlight>` component produce static HTML strings with inline styles -- no client-side JavaScript is required to display the highlighted code.

For server rendering, use `getThemeStylesheet()` to generate a CSS stylesheet string that can be injected into a `<style>` tag:

```ts
import { getThemeStylesheet } from "@lpm.dev/neo.highlight";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

const css = getThemeStylesheet(githubDark);
// Inject into <style> tag in your HTML template
```

In a Next.js or similar framework:

```tsx
import { getThemeStylesheet } from "@lpm.dev/neo.highlight";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <style
          dangerouslySetInnerHTML={{ __html: getThemeStylesheet(githubDark) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

## Bundle Size

Every grammar and theme is a separate module. Import only what you need.

| Import                      | Gzipped |
| --------------------------- | ------- |
| Core (tokenizer + renderer) | ~3.8 KB |
| Core + 1 language           | ~4.2 KB |
| React adapter               | ~1.2 KB |
| Vanilla adapter             | ~0.8 KB |
| Single theme                | ~0.3 KB |
| Single grammar (avg)        | ~0.4 KB |
| All 55 grammars             | ~22 KB  |
| All 10 themes               | ~3 KB   |

The `sideEffects: false` flag in `package.json` ensures bundlers tree-shake unused exports.

---

## TypeScript

Written in strict TypeScript. All types are exported from the main entry point:

```ts
import type {
  Token,
  TokenNode,
  TokenPattern,
  TokenDefinition,
  Grammar,
  GrammarTokens,
  Theme,
  ThemeTokenColors,
  RenderOptions,
  ScanOptions,
  GrammarRegistry,
} from "@lpm.dev/neo.highlight";
```

React-specific types:

```ts
import type {
  HighlightProps,
  AutoHighlightProps,
  HighlightProviderProps,
  UseHighlightOptions,
  UseHighlightResult,
} from "@lpm.dev/neo.highlight/react";
```

Vanilla-specific types:

```ts
import type {
  HighlightOptions,
  ScanOptions,
} from "@lpm.dev/neo.highlight/vanilla";
```
