# Background highlighting

The worker client returns tokens through a Promise. The tokenizer and renderer retain their synchronous APIs.
Each worker request tokenizes the complete input. Streaming and incremental tokenization are separate features.

## Select grammars

Create an application worker module, such as `highlight-worker.ts`:

```typescript
import { installHighlightWorker } from "@lpm.dev/neo.highlight/worker/core";
import { javascript } from "@lpm.dev/neo.highlight/grammars/javascript";
import { typescript } from "@lpm.dev/neo.highlight/grammars/typescript";

installHighlightWorker(self, {
  grammars: [javascript, typescript],
  limits: { maxInputLength: 200_000, maxTokenCount: 50_000 },
});
```

`installHighlightWorker(scope, options)` installs one message listener and returns a cleanup function.
The `grammars` option accepts an array of grammar objects. Names and aliases use the normal grammar registry.
Import the grammars that the application needs. Embedded languages also include their required child grammars.

The optional `limits` object sets worker-side ceilings for input length, match count, token count, and token depth.
Requests can lower these ceilings. Larger request values, including `Infinity`, cannot raise them.
Without a ceiling, each field retains its normal tokenizer default and request override behavior.
The factory copies the grammar list and limits. Grammar objects remain trusted application code.

`createHighlightWorkerHandler(options)` returns a synchronous request handler. It installs no listener.
The core worker entry imports no built-in grammars and has no automatic global effects.

## Create a client

Create a client in browser application code:

```typescript
import { createHighlightWorkerClient } from "@lpm.dev/neo.highlight/worker/client";
import { renderToHTML } from "@lpm.dev/neo.highlight";

const client = createHighlightWorkerClient({
  createWorker: () => new Worker(new URL("./highlight-worker.ts", import.meta.url), {
    type: "module",
  }),
  timeoutMs: 3000,
  maxPendingRequests: 8,
  maxPendingCodeUnits: 500_000,
});

try {
  const tokens = await client.tokenize("const answer = 42;", "js");
  const html = renderToHTML(tokens);
  console.log(html);
} finally {
  client.dispose();
}
```

Reuse a client across requests. When the owning view or application closes, dispose the client.
The client owns its worker. The factory must return a fresh worker for each call.
A worker starts on the first accepted request and remains available between requests.
After termination, the next queued or newly accepted request creates a replacement.
The client never retries failed tokenization automatically.

The factory uses application URLs. It does not create Blob workers or require a fixed bundler.
The client entry imports no tokenizer, grammar, renderer, or React code.
A server can import this entry. The import starts no worker and accesses no browser globals.

## Queue and deadline limits

| Client option | Default | Meaning |
| --- | ---: | --- |
| `timeoutMs` | 5,000 | Deadline in milliseconds, including queue time and worker startup. |
| `maxPendingRequests` | 32 | Total active and queued requests. |
| `maxPendingCodeUnits` | 1,000,000 | Total active and queued source length, in UTF-16 units. |

A client runs one request at a time and processes the queue in arrival order.
It rejects requests that exceed its queue limits.
`pendingCount` reports the total number of accepted, unsettled requests.
The source budget excludes token results, message serialization overhead, grammar memory, and rendered HTML.
Tokenizer and renderer limits remain necessary for those resources.

`timeoutMs` accepts integers from 1 through 2,147,483,647. It cannot be disabled with zero or `Infinity`.
The request count requires a positive safe integer. The source budget accepts a non-negative safe integer.
Timer delivery depends on the host event loop and browser throttling.
The client also rejects expired results before it resolves their Promises.

## Cancellation and replacement

Pass an `AbortSignal` to cancel a request:

```typescript
const controller = new AbortController();
const result = client.tokenize(code, "typescript", {
  signal: controller.signal,
  timeoutMs: 2000,
  key: "editor-preview",
});

result.catch(error => console.log(error.name));
controller.abort();
```

A queued abort removes that request. An active abort terminates the worker because synchronous tokenization cannot process cancellation messages.
Deadlines use the same termination behavior for active requests.
Unrelated queued requests keep their original deadlines and continue in a replacement worker.

An accepted request with a `key` supersedes unsettled requests with the same key.
Superseded Promises reject with `SUPERSEDED`. An invalid or over-budget replacement leaves the original request intact.
Omit `key` to retain every accepted request.
Replies from retired workers, unrelated request IDs, and completed requests cannot resolve a newer request.

Cancellation does not revoke an already resolved Promise. Application code must also ignore obsolete results after its own asynchronous steps.
Signals, keys, and client deadlines stay on the caller. Only source, language, request ID, and tokenizer limits cross the worker boundary.

## Errors and cleanup

Client lifecycle errors use `HighlightWorkerError` with a stable `code`:

| Code | Meaning |
| --- | --- |
| `ABORTED` | The request signal was aborted. |
| `SUPERSEDED` | A newer accepted request uses the same key. |
| `TIMEOUT` | The queue-inclusive deadline expired. |
| `QUEUE_FULL` | The request exceeds a pending count or source budget. |
| `DISPOSED` | The client closed before the request completed. |
| `WORKER_ERROR` | Worker creation, message delivery, deserialization, or execution failed. |
| `PROTOCOL_ERROR` | A matching response has an invalid success or error envelope. |

Abort and supersession errors use the name `AbortError`. Deadline errors use `TimeoutError`.
Invalid configuration and request options reject with `TypeError` or `RangeError`.
Configuration errors throw during client creation. Request errors reject the returned Promise.

Remote tokenizer errors retain their `name` and `message` in an ordinary `Error` object.
For a remote error, inspect `name`. Remote errors do not preserve `instanceof RangeError` identity.
The client checks response envelopes. It trusts token contents from the application worker.

`dispose()` removes listeners, clears timers, terminates the worker, and rejects every pending request.
Repeated disposal is safe. A disposed client rejects new requests.
Applications must handle rejected Promises, including cancellations and disposal.
If custom transport methods throw or reject, cleanup continues for the remaining resources.

## Existing worker entry

This application worker module still loads all built-in grammars and installs its listener automatically:

```typescript
import "@lpm.dev/neo.highlight/worker";
```

Its request and response fields remain compatible. The new client also works with this worker.
Do not combine the automatic entry and `installHighlightWorker` in one worker.

The worker entry continues to export `handleHighlightWorkerRequest` for direct protocol use.
The two new entry points are `@lpm.dev/neo.highlight/worker/core` and `@lpm.dev/neo.highlight/worker/client`.

## Runtime and integration limits

Native browser module workers implement the client transport interface.
A Node.js `worker_threads` application requires an adapter for its message, error, exit, listener-removal, and termination APIs.
The repository tests that adapter path on Node 18 and later. It does not ship a Node-specific adapter.

Workers move tokenization off the main thread. They do not reduce tokenizer CPU work or provide incremental parsing.
Worker startup, structured cloning, main-thread rendering, and DOM updates add their own costs.
Rendering callbacks and Markdown parser methods remain synchronous.
An application can await tokens before rendering. Passing a Promise into a synchronous Markdown highlighting callback is unsupported.

## Repository checks

Build the package before the worker checks:

```sh
lpm run build
lpm run test:workers
lpm run check:worker-bundles
lpm run test:package
```

The runtime suite checks real threads, source parity, ceilings, deadlines, aborts, crashes, replacement, and cleanup in both module formats.
The bundle suite checks selected grammars, client isolation, and the synchronous entry boundary.
