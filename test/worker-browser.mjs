import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('tsup'))('esbuild');
const chrome = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
assert.equal(typeof WebSocket, 'function', 'Browser harness requires Node 22 or later');
await access(chrome);
const temp = await mkdtemp(join(tmpdir(), 'neo-worker-browser-'));
const demo = process.env.NEO_DEMOS_DIR ? resolve(process.env.NEO_DEMOS_DIR, 'dist') : undefined;
const output = process.env.NEO_WORKER_REPORT ? resolve(process.env.NEO_WORKER_REPORT) : undefined;
let browser; let ws; let server;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  for (const [name, entry] of [
    ['selected-worker', 'test/worker-fixtures/browser-worker.ts'],
    ['legacy-worker', 'dist/worker/index.js'],
    ['incremental-worker', 'test/stream-fixtures/browser-worker.ts'],
    ['checks', 'test/worker-fixtures/browser-checks.ts'],
  ]) await build({ entryPoints: [entry], outfile: join(temp, name + '.js'), bundle: true,
    format: 'esm', platform: 'browser', target: 'es2022', minify: true, logLevel: 'silent' });
  await writeFile(join(temp, 'index.html'), '<!doctype html><meta charset="utf-8"><div id="output"></div><script type="module" src="/checks.js"></script>');
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const demoRequest = demo && (pathname.startsWith('/assets/') || ['/highlight', '/case'].includes(pathname));
      const root = demoRequest ? demo : temp;
      const path = resolve(root, pathname === '/' || pathname === '/highlight' || pathname === '/case' ? 'index.html' : '.' + pathname);
      if (!path.startsWith(root + sep)) throw new Error('Invalid path');
      response.setHeader('Content-Type', extname(path) === '.js' ? 'text/javascript' : extname(path) === '.css' ? 'text/css' : 'text/html');
      response.end(await readFile(path));
    } catch { response.writeHead(404); response.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  browser = spawn(chrome, ['--headless', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--remote-debugging-port=0', '--user-data-dir=' + join(temp, 'profile'), 'about:blank'], { stdio: 'ignore' });
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { port = (await readFile(join(temp, 'profile/DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await pause(50); }
  }
  assert.ok(port, 'Chrome debugging port');
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data); const task = pending.get(message.id); if (!task) return;
    pending.delete(message.id); clearTimeout(task.timer);
    if (message.error) task.reject(new Error(JSON.stringify(message.error))); else task.resolve(message.result);
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const request = ++id; const timer = setTimeout(() => { pending.delete(request); reject(new Error('CDP timeout: ' + method)); }, 15000);
    pending.set(request, { resolve, reject, timer }); ws.send(JSON.stringify({ id: request, method, params }));
  });
  const evaluate = async expression => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value;
  };
  const until = async expression => {
    for (let attempt = 0; attempt < 150; attempt++) { if (await evaluate(expression)) return; await pause(30); }
    throw new Error('Browser condition timed out: ' + expression);
  };
  await call('Page.enable'); await call('Page.navigate', { url: origin });
  await until('!!window.workerCheckPromise'); const report = await evaluate('window.workerCheckPromise');
  assert.deepEqual(report.failures, [], 'Native browser worker checks');
  report.browser = (await call('Browser.getVersion')).product;
  if (demo) {
    await call('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.workerCounters={created:0,posted:0,stopped:0};
      const NativeWorker=window.Worker;
      window.Worker=class extends NativeWorker {
        constructor(...args){super(...args);window.workerCounters.created++;}
        postMessage(...args){window.workerCounters.posted++;return super.postMessage(...args);}
        terminate(){window.workerCounters.stopped++;return super.terminate();}
      };
    ` });
    report.demo = [];
    for (const [name, width, height] of [['desktop',1280,1000],['mobile',390,900]]) {
      await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await call('Page.navigate', { url: origin + '/highlight' });
      await until(`document.querySelector('[data-worker-status]')?.textContent==='Ready' && !!document.querySelector('[data-worker-output] .neo-worker-keyword')`);
      const check = async (expression, label) => { assert.ok(await evaluate(expression), name + ': ' + label); report.checks++; };
      const setCode = code => evaluate(`(() => { const field=document.querySelector('#worker-source'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,${JSON.stringify(code)});field.dispatchEvent(new Event('input',{bubbles:true})); })()`);
      await check('window.workerCounters.created===1', 'one initial worker');
      await setCode('const discarded = 1;');
      const latest='const latest = "<img src=x onerror=alert(1)> 😀";\n';
      await setCode(latest); await until(`document.querySelector('[data-worker-status]').textContent==='Ready' && document.querySelector('[data-worker-output] code').textContent===${JSON.stringify(latest)}`);
      await check(`!document.querySelector('[data-worker-output] img, [data-worker-output] script')`, 'inert source output');
      const posts = await evaluate('window.workerCounters.posted');
      await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='Dracula').click()`); await pause(150);
      await check(`window.workerCounters.posted===${posts}`, 'theme changes do not tokenize worker source');
      await evaluate(`document.querySelector('[aria-labelledby="output-worker-preview"]').scrollIntoView({block:'center'})`);
      await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedWorkerSource=text;}}});`);
      await evaluate(`[...document.querySelector('[aria-labelledby="output-worker-preview"]').querySelectorAll('button')].find(button=>button.textContent.includes('Copy')).click()`);
      await until(`window.copiedWorkerSource===${JSON.stringify(latest)}`); report.checks++;
      await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='Load large sample').click()`);
      await until(`document.querySelector('[data-worker-status]').textContent==='Updating preview…'`);
      await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent==='Cancel preview').click()`);
      await check(`document.querySelector('[data-worker-status]').textContent==='Canceled'`, 'cancel control');
      await setCode(latest); await until(`document.querySelector('[data-worker-status]').textContent==='Ready'`);
      await check(`document.documentElement.scrollWidth<=window.innerWidth`, 'viewport fit');
      if (output) {
        await mkdir(output, { recursive: true });
        const shot = await call('Page.captureScreenshot', { format: 'png' });
        await writeFile(join(output, `demo-${name}.png`), Buffer.from(shot.data, 'base64'));
      }
      const stopped = await evaluate('window.workerCounters.stopped');
      await evaluate(`document.querySelector('a[href="/case"]').click()`); await until(`!document.querySelector('[data-worker-status]')`);
      await check(`window.workerCounters.stopped===${stopped+1}`, 'route change disposes the owned worker');
      report.demo.push({ viewport: name, ...(await evaluate('window.workerCounters')) });
    }
  }
  if (output) { await mkdir(output, { recursive: true }); await writeFile(join(output, 'browser-report.json'), JSON.stringify(report,null,2)+'\n'); }
  console.log(JSON.stringify(report,null,2));
} finally {
  ws?.close(); browser?.kill('SIGTERM'); server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
  if (browser && browser.exitCode === null) await new Promise(resolve => { browser.once('exit',resolve); setTimeout(resolve,2000).unref(); });
  await rm(temp, { recursive: true, force: true });
}
