import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import type {HTTPMethods} from 'fastify';
import {createPilotApp} from '../server/pilot/app.js';
import {pilotConfig} from '../server/pilot/config.js';
import {PilotStore} from '../server/pilot/store.js';
import type {IdentityProvider} from '../server/pilot/google.js';
const canonical='https://artesaodigital.com.br',alias='https://forja-01.taila6d74.ts.net',prefix='/artesaos-piloto/';
const env={PILOT_PUBLIC_URL:canonical+prefix,GOOGLE_CLIENT_ID:'synthetic',GOOGLE_CLIENT_SECRET:'synthetic'};

test('origem oficial vem da configuração única, sem introduzir aliases',()=>{
 const config=pilotConfig(env);assert.equal(config.publicUrl.href,canonical+prefix);
 assert.equal(config.prefix,prefix);assert.equal('allowedOrigins' in config,false);
 const dir=mkdtempSync(join(tmpdir(),'public-origin-config-'));
 try{const file=join(dir,'options.json');writeFileSync(file,JSON.stringify({public_url:canonical+prefix,google_client_id:'synthetic',google_client_secret:'synthetic'}));assert.equal(pilotConfig({PILOT_OPTIONS_FILE:file}).publicUrl.href,canonical+prefix);}finally{rmSync(dir,{recursive:true,force:true});}
});

async function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'pilot-public-origin-'));
 const calls:{origin:string;state:string}[]=[],completed:string[]=[];
 const config={...pilotConfig(env),dataDir:dir,staticDir:resolve('dist'),adminEmails:['synthetic@example.test']};
 const provider:IdentityProvider={async start(state,_nonce,_verifier){calls.push({origin:canonical,state});return 'https://accounts.google.com/synthetic?state='+state;},async complete(url){completed.push(url.origin);return {issuer:'https://accounts.google.com',subject:'synthetic',email:'synthetic@example.test',verified:true};}};
 const app=await createPilotApp(config,provider,null),store=new PilotStore(dir);
 const request=(origin:string,path:string,headers:Record<string,string>={},method:HTTPMethods='GET',payload?:object)=>app.inject({url:prefix+path,method,headers:{host:new URL(origin).host,...headers},...(payload===undefined?{}:{payload})});
 return {request,store,calls,completed,async close(){store.close();await app.close();rmSync(dir,{recursive:true,force:true});}};
}
const flowCookie=(r:{cookies:readonly {name:string;value:string}[]})=>{const c=r.cookies.find(v=>v.name==='__Secure-artesaos_flow');assert.ok(c);return c.name+'='+c.value;};

test('Host/Origin oficiais estritos; Tailscale e cabeçalhos de proxy não autorizam acesso',async()=>{
 const f=await fixture();const {request}=f;try{
 for(const origin of [canonical]){
  assert.equal((await request(origin,'login')).statusCode,200);
  assert.equal((await request(origin,'api/interest/form',{origin})).statusCode,200);
  for(const foreign of ['https://evil.test',origin===alias?canonical:alias,'null',''])assert.equal((await request(origin,'auth/google/start',{origin:foreign},'POST',{})).statusCode,403);
  assert.equal((await request(origin,'auth/google/start',{},'POST',{})).statusCode,403);
  assert.equal((await request(origin,'api/interest/form',{origin:origin===alias?canonical:alias})).statusCode,403);
 }
 for(const host of [new URL(alias).host,'evil.test','www.artesaodigital.com.br','artesaodigital.com.br.evil.test','artesaodigital.com.br:444','artesaodigital.com.br.'])assert.equal((await request(canonical,'login',{host,'x-forwarded-host':new URL(canonical).host,'x-forwarded-proto':'https'})).statusCode,421);
 assert.equal((await request(canonical,'auth/google/start',{origin:canonical,'x-forwarded-host':'evil.test','forwarded':'host=evil.test;proto=http'},'POST',{})).statusCode,302);
 }finally{await f.close();}
});

test('login oficial mantém estado/cookie, rejeita outro Host, replay e estado inválido',async()=>{
 const f=await fixture();const {request,store,calls,completed}=f;try{
 const invite=store.invite('synthetic@example.test');
 for(const origin of [canonical]){
  const start=await request(origin,'auth/google/start',{origin},'POST',{invite});assert.equal(start.statusCode,302);
  const {state}=calls.at(-1)!;assert.equal(calls.at(-1)!.origin,origin);const cookie=flowCookie(start);
  const callback='auth/google/callback?state='+state+'&code=synthetic';
  assert.equal((await request(alias,callback,{cookie})).statusCode,421);
  assert.equal(completed.length,origin===canonical?0:1,'callback incompatível não chega à troca de tokens');
  assert.equal((await request(origin,'auth/google/callback?state=invalid&code=synthetic',{cookie})).statusCode,400);
  assert.equal((await request(origin,callback+'&state=duplicate',{cookie})).statusCode,400);
  assert.equal((await request(origin,callback)).statusCode,400);
  const done=await request(origin,callback,{cookie});assert.equal(done.statusCode,200,done.body);assert.equal(completed.at(-1),origin);
  assert.equal(done.headers['referrer-policy'],'no-referrer');assert.equal(done.headers['cache-control'],'no-store');
  assert.ok(done.cookies.every(c=>c.secure&&!c.domain&&c.path===prefix));
  assert.equal(done.cookies.find(c=>c.name==='__Secure-artesaos_session')!.httpOnly,true);
  assert.equal((await request(origin,callback,{cookie})).statusCode,400);
 }
 }finally{await f.close();}
});

test('administração HA usa callback oficial comum, allowlist e CSRF; retorno externo ignorado',async()=>{
 const f=await fixture();const {request,calls}=f;try{
 for(const origin of [canonical]){
  const start=await request(origin,'admin/auth/google/start?returnTo=https://evil.test',{origin},'POST',{});assert.equal(start.statusCode,302);
  const state=calls.at(-1)!.state,cookie=flowCookie(start),path='auth/google/callback?state='+state+'&code=synthetic&returnTo=https://evil.test';
  assert.equal((await request(alias,path,{cookie})).statusCode,421);
  const done=await request(origin,path,{cookie});assert.equal(done.statusCode,200,done.body);assert.ok(!done.headers.location);assert.ok(!done.body.includes('evil.test'));
  const session=done.cookies.find(c=>c.name==='__Secure-artesaos_admin_session')!;assert.ok(session);assert.ok(session.secure&&session.httpOnly&&!session.domain);assert.equal(session.path,prefix+'admin/');
  const csrf=done.cookies.find(c=>c.name==='__Secure-artesaos_admin_csrf')!.value;
  const headers={cookie:session.name+'='+session.value,origin};const current=await request(origin,'admin/api/session',headers);assert.equal(current.statusCode,200);
  assert.equal((await request(origin,'admin/auth/logout',{...headers,'x-pilot-admin-context':current.json().context,'x-pilot-admin-csrf':'wrong'},'POST',{})).statusCode,403);
  assert.equal((await request(origin,'admin/auth/logout',{...headers,'x-pilot-admin-context':current.json().context,'x-pilot-admin-csrf':csrf},'POST',{})).statusCode,200);
 }
 }finally{await f.close();}
});

test('sessão/CSRF/contexto e cadastros preservados em logins consecutivos na origem oficial',async()=>{
 const f=await fixture();const {request,store,calls}=f;try{
 const invite=store.invite('synthetic@example.test');let context:string|undefined;
 for(const origin of [canonical,canonical]){
  const start=await request(origin,'auth/google/start',{origin},'POST',{invite});const state=calls.at(-1)!.state;
  const done=await request(origin,'auth/google/callback?state='+state+'&code=synthetic',{cookie:flowCookie(start)});
  const cookies=done.cookies.filter(c=>c.name!=='__Secure-artesaos_flow').map(c=>c.name+'='+c.value).join('; ');
  const session=(await request(origin,'api/pilot/session',{cookie:cookies})).json();assert.ok(session.context);
  if(context)assert.equal(session.context,context);context=session.context;
  assert.equal((await request(origin,'api/pilot/session')).statusCode,401);
  const headers={cookie:cookies,origin,'x-pilot-context':session.context};
  assert.equal((await request(origin,'auth/logout',{...headers,'x-pilot-csrf':'wrong'},'POST',{})).statusCode,403);
  const csrf=done.cookies.find(c=>c.name==='__Secure-artesaos_csrf')!.value;
  assert.equal((await request(origin,'auth/logout',{...headers,'x-pilot-csrf':csrf},'POST',{})).statusCode,200);
 }
 assert.equal(store.db.prepare('SELECT COUNT(*) n FROM pilot_users').get()!.n,1);
 assert.equal(store.db.prepare('SELECT COUNT(DISTINCT tenant_id) n FROM pilot_users').get()!.n,1);
 }finally{await f.close();}
});

test('PWA/worker/update/login preservam prefixo e rede sem cache comercial no domínio oficial',async()=>{
 const f=await fixture();const {request}=f;try{
 for(const origin of [canonical]){
  const manifest=await request(origin,'manifest.webmanifest');assert.equal(manifest.statusCode,200);assert.equal(manifest.json().scope,prefix);assert.equal(manifest.json().start_url,prefix);assert.equal(manifest.json().display,'standalone');
  for(const icon of ['192','512'])assert.equal((await request(origin,'pwa/icon-'+icon+'.png')).statusCode,200);
  const worker=await request(origin,'service-worker.js');assert.equal(worker.statusCode,200);assert.equal(worker.headers['service-worker-allowed'],prefix);assert.equal(worker.headers['cache-control'],'no-store');assert.ok(!worker.body.includes('cache.put'));
  const login=await request(origin,'login');assert.match(login.body,/version-guard.js/);assert.ok(!login.body.includes(canonical));
 }
 }finally{await f.close();}
});
