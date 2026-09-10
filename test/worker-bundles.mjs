import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('tsup'))('esbuild');
async function bundle(contents) {
  const result = await build({ stdin: { contents, resolveDir: process.cwd() }, bundle: true, write: false,
    minify: true, format: 'esm', platform: 'browser', target: 'es2022', metafile: true, logLevel: 'silent' });
  const inputs = Object.values(result.metafile.outputs)[0].inputs;
  return { bytes: result.outputFiles[0].contents.length, gzip: gzipSync(result.outputFiles[0].contents).length,
    included: Object.keys(inputs).filter(name => inputs[name].bytesInOutput > 0) };
}
const samples = {};
for (const root of ['src', 'dist']) {
  const ext = root === 'src' ? '.ts' : '.js';
  samples[root] = {
    full: await bundle(`import {handleHighlightWorkerRequest} from './${root}/worker/index${ext}'; globalThis.handle=handleHighlightWorkerRequest;`),
    selected: await bundle(`import {installHighlightWorker} from './${root}/worker/core${ext}'; import {javascript} from './${root}/grammars/javascript${ext}'; installHighlightWorker(self,{grammars:[javascript]});`),
    client: await bundle(`import {createHighlightWorkerClient} from './${root}/worker/client${ext}'; globalThis.client=createHighlightWorkerClient({createWorker:()=>new Worker('./worker.js',{type:'module'})});`),
    synchronous: await bundle(`import {tokenize} from './${root}/index${ext}'; import {javascript} from './${root}/grammars/javascript${ext}'; console.log(tokenize('const x=1;',javascript));`),
  };
  assert.ok(samples[root].selected.gzip < samples[root].full.gzip * 0.6, `Selected JS worker must save at least 40% gzip: selected=${samples[root].selected.gzip}, full=${samples[root].full.gzip}`);
  assert.ok(samples[root].client.gzip < 5000, 'Client must stay below 5 KB gzip');
}
assert.ok(samples.src.full.included.some(name => name.endsWith('/grammars/python.ts')));
assert.ok(samples.src.selected.included.some(name => name.endsWith('/grammars/javascript.ts')));
assert.ok(!samples.src.selected.included.some(name => /grammars\/(?:index|python|rust|vue)\.ts$/.test(name)), 'Selected worker cannot retain unrelated grammars');
assert.ok(!samples.src.client.included.some(name => /grammars\/|core\/tokenizer/.test(name)), 'Client cannot import grammars or tokenizer');
assert.ok(!samples.src.synchronous.included.some(name => /worker\//.test(name)), 'Synchronous entry cannot import worker code');
assert.ok(!samples.src.synchronous.included.some(name => /experimental\//.test(name)), 'Synchronous entry cannot import experimental sessions');
console.log(JSON.stringify(Object.fromEntries(Object.entries(samples).map(([root, values]) => [root,
  Object.fromEntries(Object.entries(values).map(([name, { bytes, gzip }]) => [name, { bytes, gzip }]))])), null, 2));
console.log('Worker bundle boundaries and size gates passed');
