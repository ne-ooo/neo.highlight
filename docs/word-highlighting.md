# Word highlighting

`highlightRanges` adds a background to selected source text. It preserves syntax colors, nested tokens, and source text.
Selections can cover part of an identifier, several tokens, or several lines.

## Basic use

```typescript
import { tokenize, renderToHTML } from '@lpm.dev/neo.highlight'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'

const source = 'const endpoint = "/api/items";'
const html = renderToHTML(tokenize(source, javascript), {
  highlightRanges: [{ start: 6, end: 14 }], // endpoint
})
```

Each `HighlightRange` has a `start` offset and an `end` offset.
Offsets use zero-based UTF-16 code units, like JavaScript `slice()` and the rendering hooks.
The start is inclusive. The end is exclusive.

For `😀x`, the emoji occupies offsets 0 through 2. The range `{ start: 2, end: 3 }` selects `x`.
An endpoint cannot divide a surrogate pair or CRLF terminator.
Combining marks count separately. Ranges do not use grapheme clusters or visual columns.

## Range rules

- Each range must contain nonempty, in-bounds source offsets that are safe integers.
- At most 256 ranges are accepted before merging. `MAX_HIGHLIGHT_RANGES` exports this limit.
- Duplicate, overlapping, and adjacent ranges merge.
- `normalizeHighlightRanges(source, ranges)` returns sorted, merged, immutable ranges without changing the input.
- Invalid ranges throw an error. The renderer does not silently shorten them.
- An absent range array or an empty array preserves the existing output.

Offsets refer to the text inside the token tree. A supplied token's `length` field does not change these offsets.
Line numbers, `startLine`, and diff gutters do not affect the offsets.
Multiline selections omit line terminators from highlighted spans. Empty lines do not receive empty highlight spans.

## Syntax, hooks, and styles

The renderer adds `neo-hl-word-highlight` spans inside existing syntax spans.
A selection across syntax boundaries can produce several highlight spans.
These spans do not add tokens or invoke token hooks. Existing hook offsets remain unchanged.
Selections combine with line highlights, diff lines, line numbers, and rendering hooks.

Inline output includes the background style. Class output requires the matching theme stylesheet.
`getThemeStylesheet()` and `getDualThemeStylesheet()` include the word highlight rule.
The CSS variable `--neo-hl-word-highlight-bg` controls the background, with a neutral default.
Both the class and the variable use the configured `classPrefix`.

```css
.neo-hl {
  --neo-hl-word-highlight-bg: rgba(120, 150, 220, 0.3);
}
```

## Adapters and limits

Vanilla `highlight()`, React `Highlight`, and React `useHighlight()` accept `highlightRanges`.
React range changes update rendered HTML without repeated tokenization.
A stable range array lets React reuse rendered output.
When selections change, replace the array.
Worker consumers can pass ranges to `renderToHTML()` after they receive tokens.

Nonempty ranges require a source snapshot and additional HTML spans.
The renderer retains its token, nesting, line, and output limits. Added spans count toward `maxRenderedLength`.
Disabled ranges avoid the source snapshot unless rendering hooks require it.

Markdown presentation uses one-based line and code-point column positions instead of these UTF-16 offsets.
See the Markdown package's `docs/word-highlighting.md` for fence syntax and diff-adjusted positions.
