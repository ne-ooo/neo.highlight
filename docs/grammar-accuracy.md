# Grammar accuracy and embedded languages

The grammars classify lexical regions and preserve the original source text.
They do not validate syntax or provide semantic analysis.

## JavaScript and TypeScript

JavaScript, TypeScript, JSX, and TSX share a lexical scanner.
The scanner tracks strings, comments, regex literals, templates, and JSX contexts.
It uses an explicit stack to find nested boundaries.

### Covered constructs

- Templates support nested objects, functions, regex literals, and other templates inside interpolations.
- TypeScript expressions retain TypeScript keywords and builtins inside templates and TSX.
- JSX supports fragments, nested elements, member names, namespaces, spread attributes, and expressions.
- JSX body text retains its text classification, including quotes and comment markers.
- Generic components support nested type arguments and function types.
- Generic calls support nested type arguments without a fixed regex depth.
- Unicode identifiers do not produce partial keyword matches. Unicode function names receive function tokens.
- Escaped identifier spellings retain complete spans, including function names and class names.
- Function and class expressions retain division context after their bodies. Declarations permit following regex statements.
- Typed function return objects and generic types preserve the boundary before the function body.
- TSX generic arrows support comments, constraints, defaults, and `const` type parameters.
- Decimal points, numeric separators, exponents, and BigInt suffixes remain part of number tokens.

### Incomplete source

Unfinished templates and interpolations retain their active token context through the end of input.
Unfinished JSX attributes retain nested expression tokens.
Quoted JavaScript strings stop at an unescaped line terminator.
Escaped line continuations retain the complete string, including CRLF.

These grammars classify source text. They do not validate JavaScript or TypeScript syntax.
Regex-versus-division decisions use lexical context, without a complete statement parser.
The fixture corpus covers selected declaration and expression contexts, rather than every valid statement combination.
Escaped identifiers preserve their spelling. The scanner does not validate the decoded identifier characters.
Token classifications do not provide type checking or semantic symbol resolution.

## Python f-strings

Python replacement fields support nested dictionaries, calls, subscripts, strings, and other f-strings.
The scanner also handles Python 3.12 quote reuse, comments, and newlines inside fields.
Raw prefixes, triple quotes, escaped braces, and named Unicode escapes retain their literal context.

Conversions (`!s`, `!r`, and `!a`), debug expressions, and nested format fields receive separate tokens.
Colons inside brackets do not start format specifications.
Ordinary strings stop at an unescaped newline. Unfinished fields retain expression tokens through the end of input.

The outer f-string token is `string`, with the `f-string` alias.
It contains `interpolation` tokens, which contain Python `expression` tokens and optional conversion or format tokens.
Ordinary triple strings retain the `triple-string` token and `string` alias.
Python 3.14 template strings and semantic distinctions for soft keywords are outside this coverage.

## CSS

CSS selectors can span lines and contain nested pseudo-class functions, attribute selectors, quotes, and comments.
The scanner separates selectors from declarations and custom-property blocks.
Property names support CSS escapes and non-ASCII characters.
Strings and URL values protect literal braces and comment markers.

Numbers retain signs, decimals, exponents, and units. Hex colors receive a separate token with the `number` alias.
SCSS and Less share these boundaries, with their own line-comment rules.
This scanner does not validate properties or implement a complete preprocessor parser.

## HTML, Vue, and Svelte

Quoted attributes can contain tag delimiters.
Comments, doctypes, CDATA sections, and processing instructions retain their boundaries.
Script and style bodies use the grammar selected by the host tag.

| Host declaration | HTML | Vue and Svelte |
| --- | --- | --- |
| Default script, `lang="js"`, or `lang="javascript"` | JavaScript | JavaScript |
| Script with `lang="ts"` or `lang="typescript"` | Plain text | TypeScript |
| JSON MIME type, `type="importmap"`, or `type="speculationrules"` | JSON | JSON |
| Default style or `lang="css"` | CSS | CSS |
| Style with `lang="scss"` | Plain text | SCSS |
| Other script types or unsupported languages | Plain text | Plain text |

HTML closing tags normally end raw script and style bodies, including tags inside embedded strings or comments.
Script scanning tracks HTML escaped and double-escaped states. A double-escaped closing tag does not end the body.
HTML ignores self-closing slashes on raw-text elements. A slash in an unquoted attribute value remains part of that value.
Closing tag names are case-insensitive. A name such as `</scriptish>` does not close a script.
HTML `textarea` and `title` bodies recognize entities and retain apparent tags as text.
Vue and Svelte also recognize template expressions in these bodies.

Vue interpolations and directive values contain JavaScript or TypeScript tokens.
A root `}}` ends a Vue interpolation. A single stray brace does not end it.
Incomplete interpolations retain apparent host tags inside the expression through the end of input.
A TypeScript script selects TypeScript rules for template expressions, including templates before that script.
The `v-pre` directive suppresses interpolation and directive parsing in its subtree.
Unsupported Vue template preprocessors retain a plain-text body.

Svelte supports nested expressions, attribute expressions, shorthand attributes, spread attributes, block tags, and special tags.
These include `if`, `each`, `await`, `key`, `snippet`, `html`, `const`, `debug`, and `render` tags.
Svelte TypeScript scripts also select TypeScript rules for template expressions.
Static style attributes use CSS rules. Mixed Svelte style attributes retain template expressions and leave surrounding CSS text literal.

These grammars do not implement a browser tree builder or framework compiler.
Malformed nesting and optional HTML end tags have limited coverage.
The `xml`, `svg`, and `mathml` aliases share HTML rules. They do not provide XML conformance.
Entity-encoded expression operators retain their source spelling, without decoding for JavaScript classification.
Unsupported preprocessors do not run or load automatically.

## Token trees and bundle cost

F-strings, CSS selectors, attributes, and embedded bodies now contain additional nested tokens.
Consumers that inspect token trees must account for these children.
Adjacent tokens with identical type and alias can still merge.

HTML imports include JavaScript, JSON, and CSS grammars.
Vue and Svelte also include TypeScript and SCSS grammars.
These imports increase bundle size and tokenization work compared with opaque code-body tokens.
The core entry alone does not import these grammars.

## Resource limits

The existing input, match, token, and grammar-depth limits still apply.
Nested expression grammars share the budgets of their parent tokenizer call.
The scanner also checks the remaining depth budget before it allocates excessive nested state.
Each grammar pass shares one lexical scan through a cache with weak context keys.
There is no cache keyed by document text across calls.

Custom `TokenPattern.matcher` functions can accept an optional second argument:

```typescript
import type { TokenPattern } from "@lpm.dev/neo.highlight";

const identifier: TokenPattern = {
  pattern: /\w+/,
  matcher: function* (source, context) {
    // context contains the current depth and configured maxTokenDepth.
    if (context && context.depth > context.maxTokenDepth) {
      throw new RangeError("Grammar nesting exceeds maxTokenDepth");
    }
    for (const match of source.matchAll(/\w+/g)) {
      yield { index: match.index, text: match[0] };
    }
  },
};
```

Existing matchers that accept only `source` remain valid.
Custom matchers and regexes remain trusted code. The tokenizer cannot interrupt a custom matcher that never returns.

## Accuracy checks

The fixtures specify expected token types and exact source spans.
They also check token lengths, UTF-16 offsets, source reconstruction, grammar reuse, and resource limits.
The expectations do not depend on colors from another highlighter.

Run the focused suite:

```bash
lpm run test:grammar-accuracy
```

Run the package checks after a build:

```bash
lpm run test:regex-safety
lpm run test:resource-safety
lpm run test:package
```

The subprocess checks enforce timeouts, input scaling, and a 64 MB heap limit.
