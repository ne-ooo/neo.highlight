# @lpm.dev/neo.highlight

`@lpm.dev/neo.highlight` tokenizes and renders source code for React, browser
DOM, server rendering, and Web Worker applications.

## Features

- **Languages:** Includes 55 built-in grammars with language-specific imports.
- **Themes:** Includes 10 themes and accepts application themes.
- **Adapters:** Supports React components, React hooks, browser scanning, and
  direct tokenization.
- **Rendering:** Supports line numbers, selected-line styles, diff styles, and
  copy controls.
- **Resource controls:** Limits input, matches, tokens, output, lines, and
  nesting.
- **Dependency surface:** The core package has no runtime dependencies.

## Install

Install the package with LPM:

```bash
lpm install @lpm.dev/neo.highlight
```

React 17 or later is an optional peer dependency for the React entry point.

## Quick start

### React

```tsx
import { Highlight } from "@lpm.dev/neo.highlight/react";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

export function Example() {
  return (
    <Highlight language={javascript} theme={githubDark}>
      {`const greeting = "Hello, world!";
console.log(greeting);`}
    </Highlight>
  );
}
```

### Browser DOM

```typescript
import { highlight } from "@lpm.dev/neo.highlight/vanilla";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

const html = highlight("const answer = 42;", javascript, {
  theme: githubDark,
  lineNumbers: true,
});

const element = document.getElementById("code");
if (element) {
  element.innerHTML = html;
}
```

## API

### Core tokenization and rendering

The main entry exports the low-level pipeline.

```typescript
import {
  getThemeStylesheet,
  renderToHTML,
  tokenize,
} from "@lpm.dev/neo.highlight";
import { typescript } from "@lpm.dev/neo.highlight/grammars/typescript";
import { nord } from "@lpm.dev/neo.highlight/themes/nord";

const tokens = tokenize("const value: number = 42;", typescript);
const html = renderToHTML(tokens, {
  theme: nord,
  language: "typescript",
  lineNumbers: true,
});
const css = getThemeStylesheet(nord);
```

| Export                                    | Purpose                                           |
| ----------------------------------------- | ------------------------------------------------- |
| `tokenize(code, grammar, options?)`       | Convert source text to tokens.                    |
| `getPlainText(tokens, options?)`          | Recreate plain text from tokens.                  |
| `createRegistry(grammars)`                | Map grammar names and aliases to grammar objects. |
| `renderToHTML(tokens, options?)`          | Convert tokens to escaped HTML.                   |
| `getThemeStylesheet(theme, classPrefix?)` | Create theme CSS.                                 |

Tokenizer options are `maxInputLength`, `maxMatchCount`, `maxTokenCount`, and
`maxTokenDepth`.

Renderer options include these values:

| Option              | Type              | Default    | Description                                      |
| ------------------- | ----------------- | ---------- | ------------------------------------------------ |
| `theme`             | `Theme \| string` | None       | Apply a theme object or a registered theme name. |
| `lineNumbers`       | `boolean`         | `false`    | Add line numbers.                                |
| `highlightLines`    | `number[]`        | None       | Highlight 1-indexed lines.                       |
| `diffHighlight`     | `DiffHighlight`   | None       | Mark added, removed, and modified lines.         |
| `language`          | `string`          | None       | Add the language data value.                     |
| `classPrefix`       | `string`          | `"neo-hl"` | Set the CSS class prefix.                        |
| `wrapCode`          | `boolean`         | `true`     | Wrap output in `<pre><code>`.                    |
| `wrapLines`         | `boolean`         | `false`    | Wrap each source line.                           |
| `maxTokenCount`     | `number`          | `100000`   | Limit rendered token nodes.                      |
| `maxRenderedLength` | `number`          | `10000000` | Limit generated HTML length.                     |
| `maxLines`          | `number`          | `10000`    | Limit rendered source lines.                     |
| `maxTokenDepth`     | `number`          | `100`      | Limit token-tree depth.                          |

## React API

Import React exports from `@lpm.dev/neo.highlight/react`.

### `<Highlight>`

`<Highlight>` renders one code block.

```tsx
import { Highlight } from "@lpm.dev/neo.highlight/react";
import { typescript } from "@lpm.dev/neo.highlight/grammars/typescript";
import { dracula } from "@lpm.dev/neo.highlight/themes/dracula";

<Highlight
  language={typescript}
  theme={dracula}
  showLineNumbers
  highlightLines={[2, 3]}
  copyButton
  className="code-block"
>
  {`interface User {
  name: string;
  email: string;
}`}
</Highlight>;
```

| Prop                    | Type              | Default          | Description                              |
| ----------------------- | ----------------- | ---------------- | ---------------------------------------- |
| `children`              | `string`          | Required         | Source code.                             |
| `language`              | `Grammar`         | Required         | Language grammar.                        |
| `theme`                 | `Theme \| string` | Context          | Theme object or registered name.         |
| `showLineNumbers`       | `boolean`         | Context          | Add line numbers.                        |
| `highlightLines`        | `number[]`        | None             | Highlight 1-indexed lines.               |
| `diffHighlight`         | `DiffHighlight`   | None             | Mark added, removed, and modified lines. |
| `copyButton`            | `boolean`         | `false`          | Add a copy button.                       |
| `copyButtonLabel`       | `string`          | `"Copy"`         | Set the button label.                    |
| `copyButtonCopiedLabel` | `string`          | `"Copied!"`      | Set the successful-copy label.           |
| `onCopy`                | `(code) => void`  | None             | Receive a successful copy event.         |
| `classPrefix`           | `string`          | `"neo-hl"`       | Set the CSS class prefix.                |
| `className`             | `string`          | None             | Set the wrapper class.                   |
| `style`                 | `CSSProperties`   | None             | Set wrapper styles.                      |
| Resource-limit props    | `number`          | Package defaults | Override the six limits for this block.  |

### `<AutoHighlight>`

`<AutoHighlight>` scans its children for matching code elements. It observes
dynamically added elements with `MutationObserver`.

```tsx
import { AutoHighlight } from "@lpm.dev/neo.highlight/react";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { python } from "@lpm.dev/neo.highlight/grammars/python";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

<AutoHighlight
  languages={[javascript, python]}
  theme={githubDark}
  onError={(error, element) => console.error(element, error)}
>
  <article dangerouslySetInnerHTML={{ __html: sanitizedMarkdownHtml }} />
</AutoHighlight>;
```

| Prop                 | Type                       | Default          | Description                             |
| -------------------- | -------------------------- | ---------------- | --------------------------------------- |
| `children`           | `ReactNode`                | Required         | Content that contains code elements.    |
| `languages`          | `Grammar[]`                | Context          | Grammars for hints and detection.       |
| `theme`              | `Theme \| string`          | Context          | Theme object or registered name.        |
| `selector`           | `string`                   | `"pre code"`     | Select code elements.                   |
| `lineNumbers`        | `boolean`                  | Context          | Add line numbers.                       |
| `classPrefix`        | `string`                   | `"neo-hl"`       | Set the CSS class prefix.               |
| `className`          | `string`                   | None             | Set the wrapper class.                  |
| `style`              | `CSSProperties`            | None             | Set wrapper styles.                     |
| `autoDetect`         | `boolean`                  | `false`          | Detect code without a language hint.    |
| `onError`            | `(error, element) => void` | None             | Receive an error for one block.         |
| Resource-limit props | `number`                   | Package defaults | Override the six limits for each block. |

Language hints can appear on the `<code>` or `<pre>` element:

- `class="language-javascript"`
- `class="lang-js"`
- `data-language="javascript"`

When `autoDetect` is active, the detector scores token coverage and
language-specific syntax.

Derived grammars require a unique marker before they can outrank a base grammar.
This keeps plain HTML assigned to the HTML grammar.

### `<HighlightProvider>`

`<HighlightProvider>` supplies shared React defaults.

```tsx
import {
  AutoHighlight,
  Highlight,
  HighlightProvider,
} from "@lpm.dev/neo.highlight/react";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { python } from "@lpm.dev/neo.highlight/grammars/python";
import { tokyoNight } from "@lpm.dev/neo.highlight/themes/tokyo-night";

<HighlightProvider
  theme={tokyoNight}
  languages={[javascript, python]}
  lineNumbers
>
  <Highlight language={javascript}>{"const value = 42;"}</Highlight>
  <AutoHighlight>
    <article dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
  </AutoHighlight>
</HighlightProvider>;
```

Provider props are `children`, `theme`, `languages`, `classPrefix`, and
`lineNumbers`.

### `useHighlight(code, language, options?): UseHighlightResult`

`useHighlight()` returns memoized `tokens` and `html` values.

```tsx
import { useHighlight } from "@lpm.dev/neo.highlight/react";
import { rust } from "@lpm.dev/neo.highlight/grammars/rust";
import { nord } from "@lpm.dev/neo.highlight/themes/nord";

function CodeBlock({ code }: { code: string }) {
  const { html } = useHighlight(code, rust, {
    theme: nord,
    lineNumbers: true,
    highlightLines: [1],
    wrapCode: true,
  });

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

The hook options include all render choices and resource limits.
`useHighlightContext()` returns the current provider values.

### `<CopyButton>`

`<CopyButton>` provides the copy control used by `<Highlight copyButton>`. It
accepts `code`, labels, a class prefix, and `onCopy`.

## Browser DOM API

Import browser helpers from `@lpm.dev/neo.highlight/vanilla`.

### `highlight(code, language, options?): string`

`highlight()` tokenizes source code and returns HTML.

```typescript
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

It accepts the render options and tokenizer resource limits.

### `scan(options): number`

`scan()` highlights matching elements once. It returns the number of elements
that it changed.

```typescript
import { scan } from "@lpm.dev/neo.highlight/vanilla";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";

const count = scan({
  languages: [javascript],
  selector: "pre code",
  container: document.getElementById("article") ?? document.body,
  force: true,
  onError: (error, element) => console.error(element, error),
});

console.log(`Highlighted ${count} code blocks`);
```

An error in one block does not stop the scan. A scan applies the theme
foreground and background to each code element.

### `observe(options): () => void`

`observe()` highlights existing elements and observes new elements. It returns a
cleanup function.

```typescript
import { observe } from "@lpm.dev/neo.highlight/vanilla";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

const disconnect = observe({
  languages: [javascript],
  theme: githubDark,
  container: document.body,
});

disconnect();
```

### `autoHighlight(options): () => void`

`autoHighlight()` runs a scan. If `options.observe` is true, it observes new
elements.

```typescript
import { autoHighlight } from "@lpm.dev/neo.highlight/vanilla";
import { css, javascript, typescript } from "@lpm.dev/neo.highlight/grammars";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

const cleanup = autoHighlight({
  languages: [javascript, typescript, css],
  theme: githubDark,
  observe: true,
  selector: "pre code",
});

cleanup();
```

`ScanOptions` includes `selector`, `languages`, `theme`, `lineNumbers`,
`observe`, `container`, `classPrefix`, `autoDetect`, `force`, `onError`, and all
resource limits.

## Web Worker

The worker entry tokenizes source outside the main thread. It includes all
built-in grammars.

Create a worker module:

```typescript
import "@lpm.dev/neo.highlight/worker";
```

Create and use that worker from the application:

```typescript
const worker = new Worker(new URL("./highlight-worker.ts", import.meta.url), {
  type: "module",
});

worker.postMessage({
  id: 1,
  code: "const value = 42;",
  language: "javascript",
  maxInputLength: 100000,
});

worker.addEventListener("message", (event) => {
  if (event.data.ok) {
    console.log(event.data.tokens);
  } else {
    console.error(event.data.error);
  }
});
```

The worker accepts built-in language names and aliases. Every response includes
the request `id`.

## Resource limits

All highlighting entry points enforce these defaults:

| Option              |    Default | Scope                                 |
| ------------------- | ---------: | ------------------------------------- |
| `maxInputLength`    |    250,000 | Tokenizer input in UTF-16 code units. |
| `maxMatchCount`     |    100,000 | Regular expression matches.           |
| `maxTokenCount`     |    100,000 | Created or rendered token nodes.      |
| `maxRenderedLength` | 10,000,000 | Generated HTML in UTF-16 code units.  |
| `maxLines`          |     10,000 | Rendered source lines.                |
| `maxTokenDepth`     |        100 | Grammar and token-tree nesting.       |

Each limit can be `Infinity` for trusted source code. Finite limits are
appropriate for user-controlled source code.

CAUTION: Do not accept custom grammar objects from untrusted users. A grammar
contains regular expressions that can block the JavaScript thread.

For application grammars, use a worker and terminate it after an application
deadline.

The repository tests every built-in grammar with adversarial input. Each regular
expression test runs in an isolated process with a hard timeout.

## Language detection

### `resolveGrammar(language, grammars): Grammar | null`

`resolveGrammar()` matches a grammar name or alias without regard to letter case
or surrounding whitespace.

```typescript
import { resolveGrammar } from "@lpm.dev/neo.highlight";
import {
  javascript,
  python,
  typescript,
} from "@lpm.dev/neo.highlight/grammars";

const grammars = [javascript, python, typescript];

resolveGrammar("js", grammars); // javascript grammar
resolveGrammar("unknown", grammars); // null
```

### `detectLanguage(code, grammars, options?): DetectResult | undefined`

`detectLanguage()` scores the provided grammars. It returns the selected
grammar, its score, and all sorted candidates.

Options are `maxLength`, `minScore`, and `noCache`. The defaults are 2,000
characters, a 0.15 score, and cache use.

The main entry also exports `scoreTokenization()` and `clearDetectCache()`.

## Languages

Import one grammar from its language path or multiple grammars from the
collection entry.

```typescript
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { python, typescript } from "@lpm.dev/neo.highlight/grammars";
```

| Language    | Export       | Aliases                                                       |
| ----------- | ------------ | ------------------------------------------------------------- |
| JavaScript  | `javascript` | `js`, `mjs`, `cjs`                                            |
| TypeScript  | `typescript` | `ts`, `mts`, `cts`                                            |
| Python      | `python`     | `py`                                                          |
| JSX         | `jsx`        | `react`                                                       |
| TSX         | `tsx`        | None                                                          |
| HTML        | `html`       | `htm`, `xml`, `svg`, `mathml`                                 |
| CSS         | `css`        | None                                                          |
| SCSS        | `scss`       | `sass`                                                        |
| JSON        | `json`       | `jsonc`, `json5`                                              |
| YAML        | `yaml`       | `yml`                                                         |
| Markdown    | `markdown`   | `md`, `mdx`                                                   |
| GraphQL     | `graphql`    | `gql`                                                         |
| Ruby        | `ruby`       | `rb`                                                          |
| Go          | `go`         | `golang`                                                      |
| Rust        | `rust`       | `rs`                                                          |
| Java        | `java`       | None                                                          |
| Kotlin      | `kotlin`     | `kt`, `kts`                                                   |
| Swift       | `swift`      | None                                                          |
| PHP         | `php`        | None                                                          |
| C           | `c`          | `h`                                                           |
| C++         | `cpp`        | `c++`, `cxx`, `cc`, `hpp`, `hxx`, `hh`                        |
| C#          | `csharp`     | `cs`, `c#`, `dotnet`                                          |
| Bash        | `bash`       | `zsh`                                                         |
| Shell       | `shell`      | `sh`, `posix-shell`                                           |
| Dockerfile  | `docker`     | `dockerfile`                                                  |
| SQL         | `sql`        | `mysql`, `pgsql`, `postgres`, `postgresql`, `sqlite`, `plsql` |
| TOML        | `toml`       | None                                                          |
| INI         | `ini`        | `conf`, `cfg`, `env`, `properties`                            |
| Diff        | `diff`       | `patch`                                                       |
| Regex       | `regex`      | `regexp`                                                      |
| Lua         | `lua`        | None                                                          |
| Dart        | `dart`       | None                                                          |
| Elixir      | `elixir`     | `ex`, `exs`                                                   |
| Scala       | `scala`      | `sc`                                                          |
| R           | `r`          | `rlang`                                                       |
| Svelte      | `svelte`     | None                                                          |
| Vue         | `vue`        | `vue-html`                                                    |
| Astro       | `astro`      | None                                                          |
| Zig         | `zig`        | None                                                          |
| WASM        | `wasm`       | `wat`, `wast`                                                 |
| Haskell     | `haskell`    | `hs`                                                          |
| Erlang      | `erlang`     | `erl`                                                         |
| Clojure     | `clojure`    | `clj`, `cljs`, `cljc`, `edn`                                  |
| OCaml       | `ocaml`      | `ml`                                                          |
| Perl        | `perl`       | `pl`                                                          |
| Objective-C | `objectivec` | `objc`, `obj-c`                                               |
| PowerShell  | `powershell` | `ps1`, `posh`                                                 |
| Terraform   | `terraform`  | `hcl`, `tf`                                                   |
| Prisma      | `prisma`     | None                                                          |
| Nix         | `nix`        | `nixos`                                                       |
| LaTeX       | `latex`      | `tex`                                                         |
| Less        | `less`       | None                                                          |
| Handlebars  | `handlebars` | `hbs`, `mustache`                                             |
| Solidity    | `solidity`   | `sol`                                                         |
| CSV         | `csv`        | `tsv`                                                         |

## Themes

Import one theme from its theme path or multiple themes from the collection
entry.

```typescript
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";
import { dracula, nord } from "@lpm.dev/neo.highlight/themes";
```

| Theme           | Export           |
| --------------- | ---------------- |
| GitHub Dark     | `githubDark`     |
| GitHub Light    | `githubLight`    |
| One Dark        | `oneDark`        |
| Dracula         | `dracula`        |
| Nord            | `nord`           |
| Monokai         | `monokai`        |
| Solarized Light | `solarizedLight` |
| Solarized Dark  | `solarizedDark`  |
| Night Owl       | `nightOwl`       |
| Tokyo Night     | `tokyoNight`     |

Built-in themes pass the package WCAG AA contrast test against each theme
background.

### Theme contrast utilities

`validateThemeContrast()` returns a result for each token color.

```typescript
import {
  contrastRatio,
  meetsWCAG_AA,
  validateThemeContrast,
} from "@lpm.dev/neo.highlight";
import { nord } from "@lpm.dev/neo.highlight/themes/nord";

const report = validateThemeContrast(nord);

contrastRatio("#ffffff", "#000000"); // 21
meetsWCAG_AA("#767676", "#ffffff"); // true
console.log(report.passed);
```

The main entry also exports `hexToRGB()` and `relativeLuminance()`.

### Dual themes

`getDualThemeStylesheet()` creates light and dark CSS variables. It uses
`prefers-color-scheme` by default.

```typescript
import { getDualThemeStylesheet } from "@lpm.dev/neo.highlight";
import { solarizedDark } from "@lpm.dev/neo.highlight/themes/solarized-dark";
import { solarizedLight } from "@lpm.dev/neo.highlight/themes/solarized-light";

const mediaCss = getDualThemeStylesheet(solarizedLight, solarizedDark);
const classCss = getDualThemeStylesheet(solarizedLight, solarizedDark, {
  darkSelector: '[data-theme="dark"]',
});
```

### Custom themes

Pass a theme object directly, or register it before you use its name.

```typescript
import { registerTheme, registerThemes } from "@lpm.dev/neo.highlight";
import type { Theme } from "@lpm.dev/neo.highlight";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";
import { nord } from "@lpm.dev/neo.highlight/themes/nord";

const applicationTheme: Theme = {
  name: "application",
  background: "#1a1b26",
  foreground: "#c0caf5",
  tokenColors: {
    comment: "#565f89",
    keyword: "#9d7cd8",
    string: "#9ece6a",
    number: "#ff9e64",
    function: "#7aa2f7",
  },
};

registerTheme(applicationTheme);
registerThemes([githubDark, nord]);
```

Built-in theme imports do not register their names automatically. Pass an
imported object or register it.

The main entry also exports `getTheme()`, `resolveTheme()`,
`resolveThemeOrThrow()`, `getThemeCSS()`, and `applyTheme()`.

## Copy-button utilities

`renderCopyButton()` returns inert button HTML. `initCopyButtons()` adds
delegated copy behavior and returns a cleanup function.

```typescript
import { initCopyButtons, renderCopyButton } from "@lpm.dev/neo.highlight";

const buttonHtml = renderCopyButton("const value = 42;", {
  label: "Copy",
  copiedLabel: "Copied!",
});

const cleanup = initCopyButtons(document.body);
cleanup();
```

## Use with `@lpm.dev/neo.markdown`

Use the Markdown highlight plugin with the core tokenizer and renderer.

```typescript
import { createParser } from "@lpm.dev/neo.markdown";
import { highlightPlugin } from "@lpm.dev/neo.markdown/plugins/highlight";
import {
  getThemeStylesheet,
  renderToHTML,
  tokenize,
} from "@lpm.dev/neo.highlight";
import {
  javascript,
  python,
  typescript,
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

const html = parser.parse(markdown);
```

## Server rendering

The tokenizer, renderer, browser `highlight()` function, and React `<Highlight>`
component can create static HTML during server rendering.

Use `getThemeStylesheet()` to create CSS for the document head.

```tsx
import { getThemeStylesheet } from "@lpm.dev/neo.highlight";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: getThemeStylesheet(githubDark),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

## Security

The core renderer escapes source text before it inserts the text into HTML.

`<AutoHighlight>` and the DOM scanner do not sanitize existing HTML. Sanitize
untrusted HTML before it reaches `dangerouslySetInnerHTML` or the DOM.

Custom grammars contain executable regular expressions. Treat grammar objects as
trusted application configuration.

Resource counters cannot interrupt one regular expression while it runs. Use a
worker and an application deadline for application-defined grammars.

Custom themes produce CSS. Use the theme APIs for validation, and do not create
theme objects from untrusted input.

## Performance

The repository measures tokenization, rendering, detection, and comparison
packages with checked-in fixtures.

See [BENCHMARKS.md](./BENCHMARKS.md) for the environment, method, results, and
limits.

Run the benchmark suite:

```bash
lpm run bench
```

Benchmark results depend on the runtime, computer, grammar, options, and source
code.

## Runtime support

- **Node.js:** 18 or later
- **Browsers:** Modern browsers
- **Web Workers:** Module workers
- **React:** 17 or later for the React entry point
- **Module formats:** ESM and CommonJS
- **TypeScript:** Strict declaration files for all entry points

## Package entry points

| Import                                       | Purpose                                                               |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `@lpm.dev/neo.highlight`                     | Tokenizer, renderer, themes, detection, scanner utilities, and types. |
| `@lpm.dev/neo.highlight/react`               | React components, hooks, and types.                                   |
| `@lpm.dev/neo.highlight/vanilla`             | Browser highlighting and DOM scanning.                                |
| `@lpm.dev/neo.highlight/worker`              | Worker message handler with all built-in grammars.                    |
| `@lpm.dev/neo.highlight/grammars`            | All grammar exports.                                                  |
| `@lpm.dev/neo.highlight/grammars/<language>` | One grammar.                                                          |
| `@lpm.dev/neo.highlight/themes`              | All theme exports.                                                    |
| `@lpm.dev/neo.highlight/themes/<theme>`      | One theme.                                                            |

The worker entry is side-effectful. Other entry points support unused-export
removal by bundlers.

## License

MIT. See [LICENSE](./LICENSE).
