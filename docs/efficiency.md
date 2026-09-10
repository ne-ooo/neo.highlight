# Runtime and output efficiency

`renderToHTML` supports two output modes. The default, `styleMode: "inline"`, includes theme colors and line layout in the HTML.
`styleMode: "class"` omits generated style attributes. A matching theme stylesheet supplies colors, line layout, selection colors, and diff backgrounds.

```ts
import { tokenize, renderToHTML, getThemeStylesheet } from '@lpm.dev/neo.highlight'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'
import { githubDark } from '@lpm.dev/neo.highlight/themes/github-dark'

const css = getThemeStylesheet(githubDark)
const html = renderToHTML(tokenize('const value = 42', javascript), {
  theme: githubDark,
  language: 'javascript',
  styleMode: 'class',
})
```

Serve `css` once through an external stylesheet or a style element that your application manages.
Insert `html` into the document. An external stylesheet supports policies that block inline style attributes.

For a single small block, inline mode can require fewer total compressed bytes.
For repeated blocks, class mode avoids repeated token styles and wrapper variables.
Compare HTML plus stylesheet bytes before you select a mode.

## Themes and adapters

Use the same theme and class prefix for the renderer and stylesheet.
For multiple independent themes on one page, give each theme a different `classPrefix`.
For light and dark modes, use `getDualThemeStylesheet` with the same prefix as the renderer.
Class output leaves wrapper variables in CSS, so the stylesheet controls theme changes.

Token classes and aliases remain available. An additional color class preserves the selected theme's primary-token and first-alias priority.
For custom dual themes, keep token color keys consistent between themes. The renderer selects alias precedence from the supplied theme.

`wrapCode: false` returns a fragment. Put that fragment inside an element with the selected class prefix so CSS variables can inherit.
`Highlight`, `useHighlight`, `AutoHighlight`, `scan`, `observe`, and the vanilla `highlight` function accept `styleMode`.
`observe` and `AutoHighlight` manage a stylesheet when a theme is supplied. The other APIs require an application-managed stylesheet.

Class mode preserves token limits, line limits, output limits, source escaping, and theme validation.
The renderer reuses token markup within each call. This cache does not retain source text between calls.

## Measurements

These commands run from a package repository checkout.

Build the package before each measurement:

```sh
lpm run build
lpm run bench:efficiency
```

The script prints JSON for three JavaScript fixtures in both output modes.
Each mode runs in three fresh processes. Each fixture has seven warm batches.
Results include import time, initialization, first-call time, retained heap, process peak RSS, and raw and compressed output sizes.
The combined-output measurements include one stylesheet. The repeated-block measurement repeats the same fixture ten times, which favors compression.

Heap measurements use explicit garbage collection. Peak RSS includes the Node.js process and benchmark harness.
Timings depend on the runtime, machine, input, and options. The script reports measurements without fixed timing assertions.
These checks do not measure browser painting or React hydration.

## Source-preserving line layout

For a live code view, `wrapLines: "source"` creates a block span for each physical source line.
It retains line endings as text and omits the empty row after a final newline.
This lets browsers reuse layout for unchanged lines during append-only updates.
The existing `wrapLines: true` mode keeps its visual line behavior.

```typescript
const html = renderToHTML(tokens, {
  theme: githubDark,
  wrapLines: "source",
});
```

The new spans have both `neo-hl-line` and `neo-hl-line-source` classes, or the configured prefix.
Without line numbers or diff gutters, the code element's `textContent` retains the source, including blank lines and trailing newlines.
CR characters use numeric references so HTML parsing does not normalize them to LF.
The mode also works with `wrapCode: false` inside a container that preserves whitespace.

Line hooks, highlighted lines, word ranges, and diff markers remain available.
Hooks run for physical rows. A trailing newline does not create another empty hook row in this mode.
Copy utilities must concatenate source-line content without inserting extra separators.
Source-line, token, depth, and output limits still apply, including the existing logical-line limit for a final newline.

Line wrappers add HTML and DOM nodes. Use application measurements before enabling them for static documents or very short code blocks.

For exact source extraction, use `textContent` without gutters or read each `line-content` span and concatenate the results.
`innerText` can add separators around block spans. It is not an exact-source API.
