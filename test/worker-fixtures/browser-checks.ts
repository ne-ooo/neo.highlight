import { createHighlightWorkerClient } from '../../dist/worker/client.js';
import { tokenize, getPlainText, renderToHTML } from '../../dist/index.js';
import { javascript } from '../../dist/grammars/javascript.js';
import { applyJavaScriptTokenUpdate } from '../../dist/experimental/index.js';

const report = { checks: 0, timings: [], failures: [] };
const assert = (condition, label) => { report.checks++; if (!condition) throw new Error(label); };
const clients = [];
function setup(options = {}, url = '/selected-worker.js') {
  const state = { created: 0, stopped: 0, started: undefined };
  const client = createHighlightWorkerClient({ ...options, createWorker: () => {
    state.created++;
    const worker = new Worker(url, { type: 'module' });
    const stop = worker.terminate.bind(worker);
    worker.terminate = () => { state.stopped++; stop(); };
    worker.addEventListener('message', event => { if (event.data.started) state.started?.(); });
    return worker;
  } });
  clients.push(client); return { client, state };
}
window.workerCheckPromise = (async () => {
  try {
    const { client, state } = setup();
    assert(state.created === 0, 'Worker creation must be lazy');
    const source = 'const f = function() {} / 2; /ok/.test("😀");\n';
    const start = performance.now(); const tokens = await client.tokenize(source, ' JS ');
    report.timings.push({ operation: 'selected cold', ms: performance.now() - start });
    assert(JSON.stringify(tokens) === JSON.stringify(tokenize(source, javascript)), 'Native worker token parity');
    assert(getPlainText(tokens) === source, 'Native worker Unicode reconstruction');
    document.querySelector('#output').innerHTML = renderToHTML(tokens);
    assert(document.querySelector('code').textContent === source, 'Rendered source parity');
    assert(!document.querySelector('code script'), 'Rendered code remains inert');
    assert(state.created === 1, 'First request creates one worker');
    const warm = performance.now(); await client.tokenize('const x = 1;', 'js');
    report.timings.push({ operation: 'selected warm', ms: performance.now() - warm });
    assert(state.created === 1, 'Worker reuse');
    const limited = await client.tokenize('x'.repeat(100_001), 'js', { maxInputLength: Infinity }).catch(e => e);
    assert(limited.name === 'RangeError' && limited.message.includes('maxInputLength'), 'Worker ceiling');
    const started = new Promise(resolve => { state.started = resolve; });
    let ticks = 0; const timer = setInterval(() => ticks++, 10);
    const blocked = client.tokenize('x', 'stall', { timeoutMs: 500 }).catch(e => e);
    const next = client.tokenize('safe', 'js');
    await started; assert((await blocked).code === 'TIMEOUT', 'Deadline rejects stalled work');
    clearInterval(timer); assert(ticks >= 3, 'Main-thread timers run during stalled worker computation');
    assert(getPlainText(await next) === 'safe', 'Queued request survives deadline');
    assert(state.stopped === 1 && state.created === 2, 'Deadline terminates and replaces the worker');
    const controller = new AbortController(); const abortStarted = new Promise(resolve => { state.started = resolve; });
    const aborted = client.tokenize('x', 'stall', { signal: controller.signal }).catch(e => e); await abortStarted; controller.abort();
    assert((await aborted).code === 'ABORTED', 'Active native abort');
    assert(getPlainText(await client.tokenize('after abort', 'js')) === 'after abort', 'Abort recovery');
    const replaceStarted = new Promise(resolve => { state.started = resolve; });
    const old = client.tokenize('x', 'stall', { key: 'preview' }).catch(e => e); await replaceStarted;
    const latest = client.tokenize('latest 😀', 'js', { key: 'preview' });
    assert((await old).code === 'SUPERSEDED', 'Active native supersession');
    assert(getPlainText(await latest) === 'latest 😀', 'Latest source retained');
    const crashed = client.tokenize('CRASH_WORKER', 'js').catch(e => e);
    const recovered = client.tokenize('recovered', 'js');
    assert((await crashed).code === 'WORKER_ERROR', 'Native error events reject active work');
    assert(getPlainText(await recovered) === 'recovered', 'Native error recovery');
    client.dispose(); assert(client.pendingCount === 0, 'Disposal clears pending state');
    assert((await client.tokenize('x', 'js').catch(e => e)).code === 'DISPOSED', 'Disposal rejects future work');
    const queue = setup({ maxPendingRequests: 2, maxPendingCodeUnits: 4 });
    const first = queue.client.tokenize('x', 'stall').catch(e => e);
    const second = queue.client.tokenize('abc', 'js').catch(e => e);
    assert((await queue.client.tokenize('', 'js').catch(e => e)).code === 'QUEUE_FULL', 'Bounded queue');
    queue.client.dispose(); assert((await first).code === 'DISPOSED' && (await second).code === 'DISPOSED', 'Disposal settles queued Promises');
    const legacy = setup({}, '/legacy-worker.js'); const legacyStart = performance.now();
    const legacyTokens = await legacy.client.tokenize('print("hello")', 'py');
    report.timings.push({ operation: 'all-grammar cold', ms: performance.now() - legacyStart });
    assert(getPlainText(legacyTokens) === 'print("hello")', 'Client supports the legacy all-grammar protocol');
    const incremental = new Worker('/incremental-worker.js', { type: 'module' });
    try {
      let id = 0;
      const send = (request: Record<string, unknown>) => new Promise<any>((resolve, reject) => {
        const requestId = ++id;
        const timeout = setTimeout(() => settle(new Error('Session response timed out')), 5000);
        const listener = (event: MessageEvent) => { if (event.data.id === requestId) settle(undefined, event.data); };
        const failure = () => settle(new Error('Session worker failed'));
        const settle = (error?: Error, data?: unknown) => {
          clearTimeout(timeout); incremental.removeEventListener('message', listener); incremental.removeEventListener('error', failure);
          if (error) reject(error); else resolve(data);
        };
        incremental.addEventListener('message', listener); incremental.addEventListener('error', failure);
        incremental.postMessage({ ...request, id: requestId });
      });
      const code = 'const value = "<img src=x onerror=alert(1)> 😀";\nconst other = 2;\n';
      const opened = await send({ operation: 'open', session: 'stream', mode: 'stream', language: 'javascript', source: '' });
      assert(opened.ok, 'Native stream session opens');
      let tokens = [], revision = 0;
      for (let offset = 0; offset < code.length; offset += 3) {
        const reply = await send({ operation: 'append', session: 'stream', generation: opened.generation, revision, chunk: code.slice(offset, offset + 3) });
        assert(reply.ok, 'Native stream chunk accepted'); revision = reply.revision;
        tokens = applyJavaScriptTokenUpdate(tokens, reply.data);
        assert(JSON.stringify(tokens) === JSON.stringify(tokenize(code.slice(0, offset + 3), javascript)), 'Native incremental prefix token parity');
      }
      const end = await send({ operation: 'finish', session: 'stream', generation: opened.generation, revision });
      tokens = applyJavaScriptTokenUpdate(tokens, end.data);
      assert(JSON.stringify(tokens) === JSON.stringify(tokenize(code, javascript)), 'Native stream final token parity');
      document.querySelector('#output').innerHTML = renderToHTML(tokens);
      assert(!document.querySelector('#output img') && document.querySelector('#output code').textContent === code, 'Incremental output preserves escaped source');
      const doc = await send({ operation: 'open', session: 'document', mode: 'document', language: 'javascript', source: code });
      const change = { operation: 'edit', session: 'document', generation: doc.generation, revision: 0, start: code.indexOf('other'), end: code.indexOf('other') + 5, text: 'changed' };
      const edited = await send(change);
      tokens = applyJavaScriptTokenUpdate(tokens, edited.data);
      assert(JSON.stringify(tokens) === JSON.stringify(tokenize(code.replace('other', 'changed'), javascript)), 'Native document edit parity');
      assert((await send(change)).error.code === 'STALE_REVISION', 'Native document rejects stale revisions');
    } finally { incremental.terminate(); }
  } catch (error) { report.failures.push(error.stack ?? String(error)); }
  finally { for (const client of clients) client.dispose(); }
  return report;
})();
