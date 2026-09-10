import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { test } from 'node:test';
import { tokenize, getPlainText } from '../dist/index.js';
import { javascript } from '../dist/grammars/javascript.js';
import { typescript } from '../dist/grammars/typescript.js';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('tsup'))('esbuild');
const temp = await mkdtemp(join(tmpdir(), 'neo-incremental-workers-'));
let id = 0;
function send(worker, message) {
  const request = { ...message, id: ++id };
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('Worker request timed out')), 5000);
    const listener = result => { if (result.id === request.id) finish(null, result); };
    const finish = (error, result) => { clearTimeout(timer); worker.off('message', listener); worker.off('error', fail); error ? reject(error) : resolve(result); };
    const fail = error => finish(error);
    worker.on('message', listener); worker.once('error', fail); worker.postMessage(request);
  });
}
try {
  for (const format of ['esm','cjs']) {
    const file = join(temp, 'worker.' + (format === 'esm' ? 'mjs' : 'cjs'));
    await build({ entryPoints: ['test/stream-fixtures/worker.ts'], outfile: file, bundle: true, platform: 'node', target: 'es2022', format, logLevel: 'silent' });
    for (const language of ['javascript','typescript']) await test(`${format} ${language}: real worker stream and edit sessions`, async () => {
      const worker = new Worker(file);
      try {
        const source = 'const first = `😀 ${true}`;\nconst middle = /x/g;\nconst last = 3;\n';
        let response = await send(worker, { operation:'open', mode:'stream', session:'stream', language, source:'' }); assert.equal(response.ok,true);
        const generation = response.generation;
        let revision = 0, tokens = [];
        const patch = update => {
          let offset = 0; const kept = [];
          for (const token of tokens) { const length = typeof token === 'string' ? token.length : token.length;
            if (offset >= update.replaceFrom) break;
            assert.ok(offset + length <= update.replaceFrom); kept.push(token); offset += length;
          }
          tokens = [...kept,...update.tokens];
        };
        for(let offset=0;offset<source.length;offset+=7) {
          response = await send(worker,{operation:'append',session:'stream',generation,revision,chunk:source.slice(offset,offset+7)});
          assert.equal(response.ok,true);revision=response.revision;patch(response.data);
          assert.equal(getPlainText(tokens),source.slice(0,offset+7));
        }
        response = await send(worker,{operation:'finish',session:'stream',generation,revision}); assert.equal(response.ok,true);patch(response.data);
        assert.deepEqual(tokens,tokenize(source,language==='javascript'?javascript:typescript));
        const opened=await send(worker,{operation:'open',mode:'document',session:'edit',language,source});assert.equal(opened.ok,true);
        assert.deepEqual(opened.data.tokens,tokens);
        const edit={operation:'edit',session:'edit',generation:opened.generation,revision:0,start:source.indexOf('middle'),end:source.indexOf('middle')+6,text:'changed'};
        const changed=await send(worker,edit);assert.equal(changed.ok,true);assert.equal(changed.revision,1);
        assert.equal(getPlainText(changed.data.tokens),'\nconst changed = /x/g;');
        const stale=await send(worker,edit);assert.equal(stale.error.code,'STALE_REVISION');
        const closed=await send(worker,{operation:'close',session:'edit',generation:opened.generation,revision:1});assert.equal(closed.ok,true);
        const replacement=await send(worker,{operation:'open',mode:'document',session:'edit',language,source:'new'});assert.notEqual(replacement.generation,opened.generation);
        assert.equal((await send(worker,edit)).error.code,'STALE_GENERATION');
      } finally { await worker.terminate(); }
    });
    await test(`${format}: capacity and worker replacement release sessions`, async () => {
      const worker = new Worker(file,{workerData:{maxSessions:1,maxTotalCodeUnits:10}});
      const open={operation:'open',mode:'document',session:'x',language:'javascript',source:'abc'};
      try {
        const first=await send(worker,open);assert.equal(first.ok,true);
        assert.equal((await send(worker,{...open,session:'y'})).error.code,'CAPACITY');
      } finally {await worker.terminate();}
      const replacement = new Worker(file);
      try {assert.equal((await send(replacement,{operation:'close',session:'x',generation:1,revision:0})).error.code,'SESSION_NOT_FOUND');}
      finally {await replacement.terminate();}
    });
  }
} finally {await rm(temp,{recursive:true,force:true});}
