import { createHighlightWorkerHandler, installHighlightWorker } from '@lpm.dev/neo.highlight/worker/core';
import { createHighlightWorkerClient, HighlightWorkerError } from '@lpm.dev/neo.highlight/worker/client';
import type { HighlightWorkerRequest, HighlightWorkerResponse } from '@lpm.dev/neo.highlight/worker';
import { javascript } from '@lpm.dev/neo.highlight/grammars/javascript';
import type { Token } from '@lpm.dev/neo.highlight';
const handler = createHighlightWorkerHandler({ grammars: [javascript] as const, limits: { maxInputLength: 2000 } });
const request: HighlightWorkerRequest = { id: 'example', code: 'const x = 1;', language: 'js' };
const response: HighlightWorkerResponse = handler(request);
if (response.ok) { const tokens: Token[] = response.tokens; void tokens; }
const client = createHighlightWorkerClient({ createWorker: () => new Worker('/highlight.js', { type: 'module' }) });
const result: Promise<Token[]> = client.tokenize('const x = 1;', 'js', { key: 'preview', signal: new AbortController().signal, timeoutMs: 1000 });
result.catch((error: unknown) => { if (error instanceof HighlightWorkerError) console.log(error.code); });
const events = new EventTarget();
const scope = {
  addEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void) { events.addEventListener(type, listener as EventListener); },
  removeEventListener(type: "message", listener: (event: MessageEvent<unknown>) => void) { events.removeEventListener(type, listener as EventListener); },
  postMessage(_response: HighlightWorkerResponse) {},
};
installHighlightWorker(scope, { grammars: [javascript] })();
client.dispose();

import { createJavaScriptStream, createJavaScriptDocument, createJavaScriptSessionHandler, applyJavaScriptTokenUpdate } from '@lpm.dev/neo.highlight/experimental';
const stream = createJavaScriptStream({ language: 'typescript', preview: 'highlight' });
const streamed: Token[] = applyJavaScriptTokenUpdate([], stream.append('const value: number = 1;\n'));
applyJavaScriptTokenUpdate(streamed, stream.finish());
const document = createJavaScriptDocument('const value = 1;\n');
const changed = document.edit({ revision: 0, start: 14, end: 15, text: '2' });
void changed;
document.dispose();
createJavaScriptSessionHandler().dispose();
