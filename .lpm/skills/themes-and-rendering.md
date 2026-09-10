---
name: themes-and-rendering
description: Theme stylesheets, line and diff display, render hooks, word selections, and output options
version: "1.4.0"
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
---

# Themes and rendering

## Themes (10 Built-in, WCAG AA Compliant)

```typescript
import {
  githubDark,
  githubLight,
  oneDark,
  dracula,
  nord,
  monokai,
  solarizedLight,
  solarizedDark,
  nightOwl,
  tokyoNight,
} from "@lpm.dev/neo.highlight/themes";

// Or individual imports
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";
```

### Custom Themes

```typescript
import type { Theme } from "@lpm.dev/neo.highlight";

const myTheme: Theme = {
  name: "my-theme",
  background: "#1a1b26",
  foreground: "#c0caf5",
  tokenColors: {
    comment: "#565f89",
    keyword: "#bb9af7",
    string: "#9ece6a",
    number: "#ff9e64",
    function: "#7aa2f7",
    operator: "#89ddff",
    // ... additional token types as needed
  },
};
```

Themes use CSS custom properties (`--neo-hl-*`). All 10 built-in themes pass WCAG AA (4.5:1 contrast ratio for all token colors against their background).

### Theme Accessibility — `validateThemeContrast()`

Validate that all token colors in a theme meet WCAG AA contrast requirements:

```typescript
import { validateThemeContrast } from "@lpm.dev/neo.highlight";
import { dracula } from "@lpm.dev/neo.highlight/themes/dracula";

const report = validateThemeContrast(dracula);
// {
//   passed: true,
//   theme: "dracula",
//   results: [{ token: "keyword", ratio: 5.2, required: 4.5, pass: true }, ...]
// }

if (!report.passed) {
  const failures = report.results.filter((r) => !r.pass);
  console.warn("Failing tokens:", failures);
}
```

### Contrast Utilities

```typescript
import {
  contrastRatio,
  meetsWCAG_AA,
  hexToRGB,
  relativeLuminance,
} from "@lpm.dev/neo.highlight";

// Calculate a contrast ratio (1 to 21)
contrastRatio("#ff79c6", "#282a36"); // → 5.2

// Check WCAG AA compliance
meetsWCAG_AA("#ff79c6", "#282a36"); // → true
meetsWCAG_AA("#ff79c6", "#282a36", true); // → true (large text, 3:1 threshold)

// Lower-level utilities
hexToRGB("#ff79c6"); // → [255, 121, 198]
relativeLuminance(255, 121, 198); // → 0.318 (WCAG 2.0 relative luminance)
```

### Dual Theme (Light/Dark) — `getDualThemeStylesheet()`

Generate CSS with both light and dark theme variables:

```typescript
import { getDualThemeStylesheet } from "@lpm.dev/neo.highlight";
import { githubLight } from "@lpm.dev/neo.highlight/themes/github-light";
import { githubDark } from "@lpm.dev/neo.highlight/themes/github-dark";

// Media query approach (default) — uses prefers-color-scheme
const css = getDualThemeStylesheet(githubLight, githubDark);
// Light theme is default, dark theme activates via @media (prefers-color-scheme: dark)

// Class-based approach — for manual theme toggle
const css2 = getDualThemeStylesheet(githubLight, githubDark, {
  darkSelector: ".dark",
});
// Light theme is default, dark theme activates when .dark class is present
```

Inject the returned CSS into a `<style>` tag. Works with SSR — no client-side JS needed for the media query approach.

## Line & Diff Highlighting

```typescript
// Highlight specific lines
renderToHTML(tokens, {
  theme: githubDark,
  highlightLines: [2, 3, 4], // 1-indexed
});

// Diff markers with colored gutters
renderToHTML(tokens, {
  theme: githubDark,
  diffHighlight: {
    added: [1, 2], // Green background + "+" gutter
    removed: [5], // Red background + "-" gutter
    modified: [8], // Yellow background + "~" gutter
  },
});
```

## Language Auto-Detection

```typescript
import { detectLanguage } from "@lpm.dev/neo.highlight";
import { javascript, python, rust } from "@lpm.dev/neo.highlight/grammars";

const result = detectLanguage(code, [javascript, python, rust]);
if (result) {
  console.log(result.grammar.name); // 'python'
  console.log(result.score); // 0.72
  console.log(result.candidates); // all scored grammars
}
```

The base score uses keyword density, coverage, diversity, and high-value tokens. Language profiles add positive and negative syntax evidence.

The 100-entry cache key includes the sample and the complete grammar structure. Samples longer than 10000 units bypass the cache.

Prefer explicit `class="language-*"` attributes. Use auto-detection only as a fallback.

## Tree-Shaking

Import only what you need. Only the worker entry is side-effectful, so bundlers can eliminate unused grammars and themes. Bundle size depends on the selected grammars, theme, and adapters. Measure application output with the bundler used in production.

## TypeScript Types

All types exported from main entry: `Token`, `TokenNode`, `Grammar`, `Theme`, `RenderOptions`, `DetectResult`, `DiffHighlight`, `ContrastResult`, `ThemeContrastReport`. React types from `/react`, vanilla types from `/vanilla`.

## Output efficiency

Use `styleMode: "class"` to omit generated style attributes from highlighted code.
Supply the matching theme stylesheet once per page. The default remains `"inline"`.
See [efficiency guidance](../../docs/efficiency.md) for stylesheet costs and runtime measurements.


## Rendering hooks

Pass `hooks` to `renderToHTML()`, vanilla `highlight()`, React `Highlight`, or `useHighlight()`.
Token, line, code, and pre hooks return additional classes and validated attributes.
Use `startLine` to change displayed line numbers. Highlight and diff arrays remain source-relative.
Hooks preserve source text and share the renderer's resource limits.
See `docs/render-hooks.md` for exact offsets, callback order, and supported attributes.

## Word highlighting

Pass `highlightRanges: [{ start: 6, end: 14 }]` to select source text.
Offsets use zero-based UTF-16 units with an exclusive end. They cannot divide surrogate pairs or CRLF terminators.
At most 256 ranges are accepted before merging. Invalid bounds throw an error.
Ranges preserve source text, syntax tokens, and hook offsets. React range updates do not repeat tokenization.
Class output requires the theme stylesheet, which includes the word highlight rule.
See `docs/word-highlighting.md` for multiline selections, CSS variables, and resource limits.
