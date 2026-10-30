import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { mkdtemp, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const temp = await mkdtemp(join(tmpdir(), 'fabricacao-runtime-'));
const entry = fileURLToPath(new URL('../dist-server/index.js', import.meta.url));
let child;
let proxy;
let logs = '';
async function freePort() {
  const server = createNetServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function start(dataDir) {
  const port = await freePort();
  logs = '';
  child = spawn(process.execPath, [entry], {
    cwd: temp,
    env: { ...process.env, APP_MODE: 'local', HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { logs += chunk; });
  child.stderr.on('data', chunk => { logs += chunk; });
  let spawnError;
  child.on('error', error => { spawnError = error; });
  const base = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 100; i++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null) throw new Error(logs);
    try {
      const response = await fetch(base + 'api/health');
      if (response.ok) return base;
    } catch { /* Wait for the listener, with a bounded startup deadline. */ }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Servidor não ficou pronto: ${logs}`);
}
async function stop() {
  if (!child || !child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGTERM');
  const timeout = setTimeout(() => child.kill('SIGKILL'), 5000);
  await exited;
  clearTimeout(timeout);
}
try {
  const dataDir = join(temp, 'data');
  let base = await start(dataDir);
  assert.equal((await (await fetch(base + 'api/health')).json()).database, 'ok');
  const html = await (await fetch(base)).text();
  assert.match(html, /Fabricação e Orçamentos/);
  const asset = html.match(/src="([^"]+\.js)"/)[1];
  assert.equal((await fetch(new URL(asset, base))).status, 200);
  const save = await fetch(base + 'api/note', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Persistência independente' }),
  });
  assert.equal(save.status, 200);
  const send=async(path,method,payload)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});assert.equal(r.status,200);return r.json();};
  const client={name:'Cliente fictício para restauração',contact:'',phone:'',email:'',taxDocument:'',postal:''};
  const savedClient=await send('api/clients','POST',client);
  await send('api/quotes','POST',{data:{client:{id:savedClient.id,...client},items:[],notes:'Rascunho para restauração'},expectedRevision:0});
  await send('api/settings/fabricacao','PUT',{data:{dailyCapacity:'Capacidade de teste'},expectedRevision:0});
  async function checkBusinessData(){
    assert.equal((await (await fetch(base+'api/clients')).json())[0].name,client.name);
    assert.equal((await (await fetch(base+'api/quotes/1')).json()).data.notes,'Rascunho para restauração');
    assert.equal((await (await fetch(base+'api/quotes?pageSize=10&search=ficticio')).json()).total,1);
    assert.equal((await (await fetch(base+'api/settings/fabricacao')).json()).data.dailyCapacity,'Capacidade de teste');
  }
  await stop();
  const backup = join(temp, 'backup');
  await cp(dataDir, backup, { recursive: true, errorOnExist: true, force: false });
  base = await start(dataDir);
  assert.equal((await (await fetch(base + 'api/note')).json()).text, 'Persistência independente');
  await checkBusinessData();
  await stop();
  const restored = join(temp, 'restored');
  await cp(backup, restored, { recursive: true, errorOnExist: true, force: false });
  base = await start(restored);
  assert.equal((await (await fetch(base + 'api/note')).json()).text, 'Persistência independente');
  await checkBusinessData();
  const prefix = '/api/hassio_ingress/test-session/';
  proxy = createServer(async (req, res) => {
    try {
      if (!req.url.startsWith(prefix)) { res.writeHead(404); res.end(); return; }
      const upstream = await fetch(new URL(req.url.slice(prefix.length), base));
      res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') ?? 'text/plain' });
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch { res.writeHead(502); res.end(); }
  });
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const external = `http://127.0.0.1:${proxy.address().port}${prefix}`;
  assert.match(await (await fetch(external)).text(), /Fabricação e Orçamentos/);
  assert.equal((await fetch(new URL(asset, external))).status, 200);
  assert.equal((await (await fetch(new URL('api/health', external))).json()).status, 'ok');
  assert.equal((await (await fetch(new URL('api/note', external))).json()).text, 'Persistência independente');
  console.log('PASS: processo independente, porta configurada, diretório de execução externo, HTML/JS/API, reinício, backup/restauração e proxy com prefixo.');
  console.log('O proxy de teste não valida o Supervisor ou autenticação real do Ingress.');
} finally {
  if (proxy) await new Promise(resolve => proxy.close(resolve));
  await stop();
  await rm(temp, { recursive: true, force: true });
}
