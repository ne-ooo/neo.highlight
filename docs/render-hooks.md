# Structured rendering hooks

`renderToHTML()` supports optional token, line, code, and pre hooks.
Each hook returns additional classes and attributes. Hooks do not replace source text or return HTML.
Existing calls without hooks retain their output.

```typescript
import { renderToHTML, tokenize, type RenderHooks } from '@lpm.dev/neo.highlight'
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript'

const hooks: RenderHooks = {
  token(context) {
    if (context.type === 'keyword') {
      return { class: 'annotated', attributes: { 'data-start': context.start } }
    }
  },
  line(context) {
    return { attributes: { id: `example-line-${context.displayLine}` } }
  },
  code: () => ({ class: ['example-code'] }),
  pre: () => ({ attributes: { 'aria-label': 'Example source', tabindex: 0 } }),
}

const html = renderToHTML(tokenize('const value = 1', javascript), {
  language: 'javascript', lineNumbers: true, startLine: 20, hooks,
})
```

## Context and order

All contexts contain immutable `source`, `language`, `classPrefix`, and `styleMode` fields.
The renderer creates a new context for each call. No source text enters a persistent cache.

| Hook | Additional fields | Invocation |
| --- | --- | --- |
| `token` | `type`, `aliases`, `depth`, `start`, `end` | Once per structured token, after its children |
| `line` | `line`, `displayLine`, `start`, `end`, `highlighted`, `added`, `removed`, `modified` | Once per rendered line |
| `code` | None | After tokens and lines, when `wrapCode` is true |
| `pre` | None | After the code hook, when `wrapCode` is true |

Token offsets use UTF-16 code units and actual source content, independent of a supplied token's `length` field.
Plain string tokens do not invoke the token hook.
Line offsets exclude terminators. CRLF occupies two source code units and produces one line boundary.
A final terminator produces an empty rendered line, consistent with existing line wrappers.

A line hook enables line wrappers, including with `wrapCode: false`.
Code and pre hooks do not run when wrappers are disabled.
Multiline tokens repeat their decorated span on each rendered line. Use line hooks for line IDs to avoid duplicate token IDs.

`startLine` must be a positive safe integer. Displayed numbers cannot overflow the safe integer range.
Highlight and diff selections still use source positions starting at one.
The callback sees both the source position (`line`) and displayed number (`displayLine`).

## Attributes and limits

The `class` field accepts a string or a string array. Classes append to the generated classes.
Class names use the package's existing conservative CSS identifier rules.
The `attributes` field accepts `id`, `title`, `role`, `tabindex`, `data-*`, and `aria-*` names.
Values can be strings, finite numbers, booleans, or `undefined`.
Booleans become the strings `true` and `false`. Undefined values are omitted.

Attribute values receive HTML escaping. Event handlers, URLs, style attributes, and arbitrary attribute names are rejected.
Hooks cannot overwrite an existing generated attribute, such as `data-language`.
Returning `undefined` leaves the element unchanged. Async results and invalid return values throw errors.

Existing token, depth, line, and generated-output limits apply with hooks enabled.
Added classes and attributes count toward the output limit.
Callbacks are trusted synchronous code. The renderer cannot interrupt a callback that does not return.

Hooks require extra source traversal and callback work. Calls without hooks avoid the source snapshot.
Callbacks do not mutate the token tree or cached opening tags.
Optional [word ranges](./word-highlighting.md) preserve these offsets and do not invoke additional token hooks.
Both inline and class output support hooks. Class output still requires the matching theme stylesheet.

## Adapters

The vanilla `highlight()` helper accepts these options through `RenderOptions`.
React `Highlight` and `useHighlight()` accept `hooks` and `startLine`.
Changes to these rendering options do not cause tokenization again.
Stable hook object identities permit React to reuse rendered output.

DOM scanning and worker tokenization do not accept callback hooks.
Applications can render worker tokens with hooks on the receiving side.
The Markdown highlighting plugin forwards hooks and supports per-block options from structured metadata.
