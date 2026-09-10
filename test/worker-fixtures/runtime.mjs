import { parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const load = path => workerData?.format === 'cjs' ? require(path.replace(/\.js$/, '.cjs')) : import(path);
const { installHighlightWorker } = await load('../../dist/worker/core.js');
const grammars = await Promise.all(['javascript', 'typescript', 'tsx', 'html', 'vue', 'svelte'].map(async name => (await load('../../dist/grammars/' + name + '.js'))[name]));
grammars.push({ name: 'stall', tokens: { x: { pattern: /x/, matcher: function* () {
  parentPort.postMessage({ started: true });
  while (true) { /* A grammar that never yields must be terminated externally. */ }
} } } });
const listeners = new Map();
installHighlightWorker({
  addEventListener(_type, listener) {
    const wrapped = data => { if (data.code === 'CRASH_WORKER') throw new Error('Worker crash fixture'); listener({ data }); };
    listeners.set(listener, wrapped); parentPort.on('message', wrapped);
  },
  removeEventListener(_type, listener) { parentPort.off('message', listeners.get(listener)); listeners.delete(listener); },
  postMessage: message => parentPort.postMessage(message),
}, { grammars, ...(workerData?.limits ? { limits: workerData.limits } : {}) });
