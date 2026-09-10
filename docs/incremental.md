# Experimental streaming and edits

The `@lpm.dev/neo.highlight/experimental` entry provides opt-in JavaScript and TypeScript sessions.
These APIs are experimental. The existing synchronous and worker APIs remain available.
Other languages and custom grammars are unsupported by these sessions.

## Stream source

```typescript
import { createJavaScriptStream, applyJavaScriptTokenUpdate } from "@lpm.dev/neo.highlight/experimental";
import { renderToHTML, type Token } from "@lpm.dev/neo.highlight";

const stream = createJavaScriptStream({ language: "typescript" });
let tokens: Token[] = [];
try {
  for (const chunk of ["const value: num", "ber = 42;\n", "console.log(value);"]) {
    tokens = applyJavaScriptTokenUpdate(tokens, stream.append(chunk));
    console.log(renderToHTML(tokens));
  }
  tokens = applyJavaScriptTokenUpdate(tokens, stream.finish());
} finally {
  stream.dispose();
}
```

`append()` accepts a string chunk. Boundaries can split escapes, comments, Unicode surrogate pairs, regex flags, and template expressions.
The lexer retains its cursor and lexical stack between chunks.
The default `preview: "highlight"` mode produces the same token tree as complete-input tokenization of each accepted prefix.
The `preview: "plain"` option leaves the unfinished suffix as plain text until a commit point or `finish()`.
Both modes produce the complete-input token tree at `finish()`.

Each update contains `replaceFrom`, `tokens`, `committedThrough`, `sourceLength`, and `done`.
Offsets use UTF-16 source units. The update replaces the previous suffix from `replaceFrom`.
Tokens before `committedThrough` are final. Later input can replace the remaining tokens.
`applyJavaScriptTokenUpdate()` applies an update to caller-owned tokens and preserves plain-text coalescing.
It rejects invalid lengths and ranges that split a structured token.

Commit points follow independent statements or completed declarations before a line ending.
Open nesting, ambiguous expression endings, and unresolved TypeScript angle brackets prevent a commit.
An unfinished region can require repeated preview tokenization. Streaming does not guarantee constant work for each chunk.

## Edit source

```typescript
import { createJavaScriptDocument, applyJavaScriptTokenUpdate } from "@lpm.dev/neo.highlight/experimental";

const document = createJavaScriptDocument("const value = 1;\n", { language: "javascript" });
try {
  let tokens = document.snapshot().tokens;
  const update = document.edit({ revision: 0, start: 14, end: 15, text: "2" });
  tokens = applyJavaScriptTokenUpdate(tokens, update);
  console.log(document.snapshot().source, tokens);
} finally {
  document.dispose();
}
```

`edit()` accepts the current `revision`, a half-open source range, and replacement `text`.
The initial revision is zero. Each accepted edit increments it.
Stale revisions and invalid ranges leave the document unchanged.

An edit restarts scanning from an earlier checkpoint.
The session reuses the suffix after its source position and grammar state converge with an existing checkpoint.
An edit to the newline after a checkpoint invalidates that checkpoint.
If state does not converge, the session processes the remaining source.
Each edit produces exact complete-input tokens, including incomplete or malformed source.

Document updates contain `revision`, `from`, `to`, `tokens`, and `sourceLength`.
The `from` and `to` offsets refer to the previous source.
`snapshot()` returns isolated source and token data. Returned patches cannot mutate the internal token cache.

## Resource limits

All configured limits require non-negative safe integers. `Infinity` is unsupported.

| Option | Default | Scope |
| --- | ---: | --- |
| `maxInputLength` | 250,000 | Total stream input, or current document source length. |
| `maxRetainedCodeUnits` | 64,000 | Uncommitted stream suffix, or one document region between checkpoints. |
| `maxWorkCodeUnits` | 16,000,000 | Cumulative source-unit accounting for parsing, copies, and updates. |
| `maxUpdates` | 10,000 | Stream calls including `finish()`, or accepted document edits. |
| `maxMatchCount` | 100,000 | Cumulative tokenizer matches across the session. |
| `maxTokenCount` | 100,000 | Cumulative tokenizer node creation across the session. |
| `maxTokenDepth` | 100 | Tokenizer nesting limit. |

Preview tokenization consumes the cumulative budgets. Document snapshots also consume the work budget.
The work counter is not a CPU instruction count or a wall-clock deadline.
The `metrics` getter returns copied counters for source, work, tokenization, and reuse.
Resource failures close the affected session and release retained state. Repeated disposal is safe.

The stream retains its unfinished suffix. The document retains its source and tokens for unchanged regions.
Caller-owned output, rendered HTML, and DOM nodes have separate costs.
Do not mutate built-in grammar objects during a session.

## Worker sessions

`createJavaScriptSessionHandler()` provides a synchronous handler for an application-owned worker:

```typescript
import { createJavaScriptSessionHandler } from "@lpm.dev/neo.highlight/experimental";

const sessions = createJavaScriptSessionHandler({
  maxSessions: 8,
  maxTotalCodeUnits: 500_000,
  maxRequests: 10_000,
});
self.addEventListener("message", event => self.postMessage(sessions.handle(event.data)));
```

Requests use `id`, `session`, and an `operation`: `open`, `append`, `edit`, `finish`, or `close`.
An `open` request supplies `mode`, `language`, and `source`.
Its response supplies a fresh `generation` and revision zero.
Subsequent requests must include that generation and the current revision.
Generations prevent delayed requests from changing a reopened session with the same name within one worker lifetime.

The handler bounds session count, retained source, and total requests.
Worker-level `limits` configure each session. Requests cannot override them.
Capacity rejections leave existing sessions intact. A session resource failure closes only the affected session.
Exhaustion of the worker request budget disposes all sessions.

Success responses contain `id`, `session`, `generation`, `revision`, and `data`.
Failures contain `id` and an error with `code`, `name`, and `message`.
Codes include `INVALID_REQUEST`, `SESSION_EXISTS`, `SESSION_NOT_FOUND`, `STALE_GENERATION`, `STALE_REVISION`, `CAPACITY`, `REQUEST_LIMIT`, `SESSION_FAILED`, and `DISPOSED`.

This protocol is separate from the whole-input `createHighlightWorkerClient()` protocol.
Applications own request routing, deadlines, and worker termination for session requests.
Worker replacement loses its sessions. Applications must reopen them and supply the current source.
Application routing must reject replies from retired worker instances.

## Runtime and checks

These APIs retain Node 18 support. Document sessions require `structuredClone` in browser environments.
Rendering remains a separate synchronous step. Worker transport and DOM updates have their own costs.

```sh
lpm run build
lpm run test:incremental
```

The tests cover source spans, prefix and final parity, random edits, cumulative limits, real worker sessions, and stale requests.
