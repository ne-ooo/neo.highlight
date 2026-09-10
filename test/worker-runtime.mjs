import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { tokenize, getPlainText } from '../dist/index.js';
import * as grammars from '../dist/grammars/index.js';
const require = createRequire(import.meta.url);
const entry = new URL('./worker-fixtures/runtime.mjs', import.meta.url);

function transport(format, state, limits) {
  const worker = new Worker(entry, { workerData: { format, limits } });
  state.workers.push(worker);
  const listeners = new Map();
  worker.on('message', data => { if (data.started) state.started?.(); });
  // Keep late native error events handled after the client removes its listeners.
  worker.on('error', () => {});
  const result = {
    postMessage: data => { state.sent.push(data); worker.postMessage(data); },
    terminate: () => { state.terminated++; return worker.terminate(); },
    addEventListener(type, listener) {
      const wrapped = type === 'message' ? data => listener({ data }) : error => listener({ type, error });
      listeners.set(listener, { ...(listeners.get(listener) ?? {}), [type]: wrapped }); worker.on(type, wrapped);
      if (type === 'error') {
        const exit = code => listener({ type: 'error', code });
        listeners.get(listener).exit = exit; worker.on('exit', exit);
      }
    },
    removeEventListener(type, listener) {
      const registered = listeners.get(listener); if (!registered) return;
      worker.off(type, registered[type]);
      if (type === 'error') worker.off('exit', registered.exit);
      delete registered[type];
    },
  };
  return result;
}
for (const format of ['esm', 'cjs']) {
  const { createHighlightWorkerClient } = format === 'esm' ? await import('../dist/worker/client.js') : require('../dist/worker/client.cjs');
  function setup(options = {}, limits) {
    const state = { workers: [], sent: [], terminated: 0 };
    const client = createHighlightWorkerClient({ createWorker: () => transport(format, state, limits), ...options });
    return { client, state, close: async () => { client.dispose(); await Promise.all(state.workers.map(worker => worker.terminate())); } };
  }
  test(`${format}: real workers preserve exact tokens, Unicode, source, and all limit fields`, { timeout: 10_000 }, async () => {
    const { client, close } = setup();
    try {
      for (const [language, code] of [
        ['javascript', String.raw`const f = function \u0066oo() {} / 2; /ok/.test('😀');`],
        ['typescript', 'const f = function(): {value: number} { return {value: 1} } / 2;'],
        ['tsx', 'const f = <T /* gap */,>(x: T) => x; const view = <Box />;'],
        ['html', '<script><!--<script></script>--></script><p>after</p>'],
        ['vue', '<p>{{ value } + <span>unfinished'],
        ['svelte', '<p value={function() {} / 2}>😀</p>'],
      ]) {
        const tokens = await client.tokenize(code, language);
        assert.deepEqual(tokens, tokenize(code, grammars[language])); assert.equal(getPlainText(tokens), code);
      }
      assert.deepEqual(await client.tokenize('const x = 1;', ' JS '), tokenize('const x = 1;', grammars.javascript));
      for (const name of ['maxInputLength', 'maxMatchCount', 'maxTokenCount', 'maxTokenDepth']) {
        await assert.rejects(client.tokenize('`x ${true}`', 'js', { [name]: 0 }), error => error.name === 'RangeError' && error.message.includes(name));
      }
      await assert.rejects(client.tokenize('x', 'missing'), { name: 'RangeError' });
    } finally { await close(); }
  });
  test(`${format}: worker-side ceilings cannot be raised by requests`, async () => {
    const { client, close } = setup({}, { maxInputLength: 2 });
    try { await assert.rejects(client.tokenize('long', 'js', { maxInputLength: Infinity }), /maxInputLength 2/); }
    finally { await close(); }
  });
  test(`${format}: deadline terminates active non-returning tokenization and releases the queue`, { timeout: 8_000 }, async () => {
    const { client, state, close } = setup();
    let ticks = 0; const timer = setInterval(() => ticks++, 10);
    const started = new Promise(resolve => { state.started = resolve; });
    try {
      const blocked = client.tokenize('x', 'stall', { timeoutMs: 500 }).catch(error => error);
      const next = client.tokenize('const x = 1;', 'js');
      await started;
      assert.equal((await blocked).code, 'TIMEOUT'); assert.ok(ticks >= 3, 'Main-thread timers remain responsive');
      assert.equal(getPlainText(await next), 'const x = 1;'); assert.equal(state.terminated, 1); assert.equal(state.workers.length, 2);
      assert.equal(client.pendingCount, 0);
    } finally { clearInterval(timer); await close(); }
  });
  test(`${format}: active abort kills computation while unrelated queued requests survive`, { timeout: 8_000 }, async () => {
    const { client, state, close } = setup(); const controller = new AbortController();
    const started = new Promise(resolve => { state.started = resolve; });
    try {
      const blocked = client.tokenize('x', 'stall', { signal: controller.signal }).catch(error => error);
      const queued = client.tokenize('safe', 'js'); await started; controller.abort('cancelled');
      assert.equal((await blocked).code, 'ABORTED'); assert.equal(getPlainText(await queued), 'safe'); assert.equal(state.terminated, 1);
    } finally { await close(); }
  });
  test(`${format}: crashed workers reject active work once and recover for the next request`, { timeout: 8_000 }, async () => {
    const { client, state, close } = setup();
    try {
      const crashed = client.tokenize('CRASH_WORKER', 'js').catch(error => error);
      const next = client.tokenize('ok', 'js'); assert.equal((await crashed).code, 'WORKER_ERROR');
      assert.equal(getPlainText(await next), 'ok'); assert.equal(state.sent.filter(r => r.code === 'CRASH_WORKER').length, 1);
    } finally { await close(); }
  });
  test(`${format}: latest keyed request supersedes active work and preserves source`, { timeout: 8_000 }, async () => {
    const { client, state, close } = setup(); const started = new Promise(resolve => { state.started = resolve; });
    try {
      const old = client.tokenize('x', 'stall', { key: 'preview' }).catch(error => error); await started;
      const next = client.tokenize('new 😀', 'js', { key: 'preview' });
      assert.equal((await old).code, 'SUPERSEDED'); assert.equal(getPlainText(await next), 'new 😀'); assert.equal(state.terminated, 1);
    } finally { await close(); }
  });
  test(`${format}: queue memory limits and disposal settle every accepted request`, { timeout: 8_000 }, async () => {
    const { client, state, close } = setup({ maxPendingRequests: 2, maxPendingCodeUnits: 5 });
    const started = new Promise(resolve => { state.started = resolve; });
    try {
      const first = client.tokenize('x', 'stall').catch(error => error); const second = client.tokenize('😀😀', 'js').catch(error => error);
      await assert.rejects(client.tokenize('', 'js'), error => error.code === 'QUEUE_FULL');
      await started; client.dispose(); assert.equal((await first).code, 'DISPOSED'); assert.equal((await second).code, 'DISPOSED');
      assert.equal(client.pendingCount, 0); await assert.rejects(client.tokenize('x', 'js'), error => error.code === 'DISPOSED');
    } finally { await close(); }
  });
}
