import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';

const staticDir = loadConfig({}).staticDir;
const local = (dataDir: string) => createApp({ dataDir, staticDir, mode: 'local' });

test('gravação persiste após reabrir o banco; API rejeita dados inválidos', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'umdois-'));
  let app = await local(dir);
  try {
    assert.equal((await app.inject('/api/health')).json().database, 'ok');
    assert.equal((await app.inject('/api/company')).statusCode,404,'Cadastro de empresa é exclusivo do piloto');
    assert.equal((await app.inject({method:'PUT',url:'/api/note',payload:{text:'Teste persistente'}})).statusCode, 200);
    assert.equal((await app.inject({method:'PUT',url:'/api/note',payload:{text:'x'.repeat(501)}})).statusCode, 400);
    await app.close();
    app = await local(dir);
    assert.equal((await app.inject('/api/note')).json().text, 'Teste persistente');
    assert.equal((await app.inject('/')).statusCode, 200);
  } finally { await app.close(); rmSync(dir, {recursive:true,force:true}); }
});
test('Ingress rejeita acesso direto e cabeçalho forjado', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'umdois-'));
  const app = await createApp({ dataDir: dir, staticDir, mode: 'home-assistant' });
  try {
    assert.equal((await app.inject({url:'/api/health',remoteAddress:'127.0.0.1',headers:{'x-forwarded-for':'172.30.32.2'}})).statusCode, 403);
    assert.equal((await app.inject({url:'/api/health',remoteAddress:'172.30.32.2'})).statusCode, 200);
    assert.equal((await app.inject({url:'/',remoteAddress:'127.0.0.1'})).statusCode, 403);
    assert.equal((await app.inject({url:'/',remoteAddress:'::ffff:172.30.32.2'})).statusCode, 200);
  } finally { await app.close(); rmSync(dir,{recursive:true,force:true}); }
});

test('configuração local restringe rede e aceita porta e dados externos', () => {
  const defaults = loadConfig({});
  assert.equal(defaults.mode, 'local');
  assert.equal(defaults.host, '127.0.0.1');
  assert.throws(() => loadConfig({ HOST: '0.0.0.0' }), /loopback/);
  assert.throws(() => loadConfig({ PORT: 'abc' }), /PORT/);
  assert.throws(() => loadConfig({ PORT: '0' }), /PORT/);
  assert.throws(() => loadConfig({ APP_MODE: 'production' }), /APP_MODE/);
  assert.throws(() => loadConfig({ DATA_DIR: ' ' }), /DATA_DIR/);
  const configured = loadConfig({ PORT: '8199', HOST: '::1', DATA_DIR: '/tmp/example' });
  assert.equal(configured.port, 8199);
  assert.equal(configured.dataDir, '/tmp/example');
  assert.equal(loadConfig({ APP_MODE: 'home-assistant' }).host, '0.0.0.0');
  assert.equal(loadConfig({ INGRESS_ONLY: 'true' }).mode, 'home-assistant');
});
