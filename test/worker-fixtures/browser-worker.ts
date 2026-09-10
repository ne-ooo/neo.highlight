import { installHighlightWorker } from '../../dist/worker/core.js';
import { javascript } from '../../dist/grammars/javascript.js';

const stall = { name: 'stall', tokens: { blocked: { pattern: /x/, matcher: function* () {
  self.postMessage({ started: true });
  while (true) { /* The parent must terminate this non-returning grammar. */ }
} } } };
const listeners = new Map();
installHighlightWorker({
  addEventListener(type, listener) {
    const wrapper = event => { if (event.data.code === 'CRASH_WORKER') throw new Error('Browser worker crash fixture'); listener(event); };
    listeners.set(listener, wrapper); self.addEventListener(type, wrapper);
  },
  removeEventListener(type, listener) { self.removeEventListener(type, listeners.get(listener)); },
  postMessage: message => self.postMessage(message),
}, { grammars: [javascript, stall], limits: { maxInputLength: 100_000 } });
