import {buildInfo} from '../server/pilot/build-info.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createPilotApp} from '../server/pilot/app.js';
import {PilotStore,digest} from '../server/pilot/store.js';
import {pilotConfig,type PilotConfig} from '../server/pilot/config.js';
import type {IdentityProvider} from '../server/pilot/google.js';
const origin='https://pilot.example.test:8443',prefix='/artesaos-piloto/';
const product=(name:string)=>({name,origin:'own',publicAllowed:false,prices:{wholesale:1000,factory:null,retail:null},weightGrams:null,lengthCm:null,widthCm:null,heightCm:null,colors:[],sourceKeys:[],family:'',description:''});
const config=(dataDir:string):PilotConfig=>({publicUrl:new URL(origin+prefix),prefix,dataDir,staticDir:resolve('dist'),clientId:'test',clientSecret:'test',sessionHours:8,idleMinutes:30,maxUsers:5});
test('configuração recusa HTTP, caminhos Ingress e credenciais ausentes',()=>{
 assert.throws(()=>pilotConfig({PILOT_PUBLIC_URL:'http://localhost/artesaos-piloto/'}));
 assert.throws(()=>pilotConfig({PILOT_PUBLIC_URL:origin+'/api/hassio_ingress/session/'}));
 assert.throws(()=>pilotConfig({PILOT_PUBLIC_URL:origin+prefix}));
 const c=pilotConfig({PILOT_PUBLIC_URL:origin+prefix,GOOGLE_CLIENT_ID:'id',GOOGLE_CLIENT_SECRET:'secret'});assert.equal(c.prefix,prefix);
});
test('convites, sessão, CSRF, abas, isolamento completo, persistência e revogação',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pilot-'));const settings=config(dir);let identity={issuer:'https://accounts.google.com',subject:'a',email:'a@example.test',verified:true};
 // Dependency injection exists only in the test; production always constructs the Google provider.
 const provider:IdentityProvider={async start(state,nonce,verifier){assert.ok(nonce);assert.ok(verifier);return `https://accounts.google.com/test?state=${state}`;},async complete(_url,_state,nonce,verifier){assert.ok(nonce);assert.ok(verifier);return identity;}};
 let app=await createPilotApp(settings,provider);const admin=new PilotStore(dir);
 const request=(url:string,headers:Record<string,string>={},method='GET',payload?:unknown)=>app.inject({url:prefix+url,method:method as any,headers:{host:new URL(origin).host,...headers},...(payload===undefined?{}:{payload:payload as any})});
 async function login(email:string,subject:string,invite=''){
  identity={...identity,email,subject};const start=await request('auth/google/start',{origin},'POST',{invite});assert.equal(start.statusCode,302,start.body);const state=new URL(String(start.headers.location)).searchParams.get('state')!;
  const flow=start.cookies.find(c=>c.name==='__Secure-artesaos_flow')!;const callback=await request(`auth/google/callback?state=${state}&code=synthetic`,{cookie:`${flow.name}=${flow.value}`});
  return callback;
 }
 function session(response:any){const cookies=response.cookies;const csrf=cookies.find((c:any)=>c.name==='__Secure-artesaos_csrf')!.value;return {cookie:cookies.filter((c:any)=>c.name!=='__Secure-artesaos_flow').map((c:any)=>`${c.name}=${c.value}`).join('; '),origin,'x-pilot-csrf':csrf} as Record<string,string>;}
 try{
  assert.equal((await request('api/products')).statusCode,401);
  const bundle=readFileSync(join(settings.staticDir,'index.html'),'utf8').match(/src="\.\/assets\/([^"]+)"/)![1];
  const publicBundle=await request('assets/'+bundle);assert.equal(publicBundle.statusCode,200,'Arquivos públicos de interface não podem ser redirecionados para o login');assert.match(String(publicBundle.headers['content-type']),/javascript/);assert.ok(!publicBundle.body.startsWith('<!doctype'));

  const worker=await request('service-worker.js?v='+buildInfo.pilotVersion);
  assert.equal(worker.statusCode,200);assert.match(String(worker.headers['content-type']),/javascript/);
  assert.equal(worker.headers['service-worker-allowed'],prefix);assert.equal(worker.headers['cache-control'],'no-store');
  assert.equal((await request('browser-ready.js?v='+buildInfo.pilotVersion)).statusCode,200);
  assert.equal((await request('auth/google/start',{origin:'https://evil.example'},'POST',{})).statusCode,403);
  assert.equal((await request('login',{host:'evil.example'})).statusCode,421);
  const inviteA=admin.invite('a@example.test');const invalid=await login('wrong@example.test','wrong',inviteA);assert.equal(invalid.statusCode,403);
  const aLogin=await login('a@example.test','a',inviteA);assert.equal(aLogin.statusCode,200,aLogin.body);assert.match(aLogin.body,/auth\/finish.js/);assert.equal(aLogin.headers['referrer-policy'],'no-referrer');assert.ok(!aLogin.body.includes('synthetic-code'));const a=session(aLogin);assert.ok(aLogin.cookies.find(c=>c.name==='__Secure-artesaos_session')!.httpOnly);assert.ok(aLogin.cookies.every(c=>c.secure));
  a['x-pilot-context']=(await request('api/pilot/session',a)).json().context;
  const authenticatedEntry=await request('login',a);assert.equal(authenticatedEntry.statusCode,302);assert.equal(authenticatedEntry.headers.location,prefix+'?view=orcamentos');
  const finish=await request('auth/finish',a);assert.equal(finish.statusCode,200);const finishScript=await request('auth/finish.js',a);assert.match(finishScript.body,/history.replaceState/);assert.match(finishScript.body,/api\/pilot\/session/);assert.match(finishScript.body,/view=orcamentos/);
  assert.equal((await request('api/products',a,'POST',product('Produto A'))).statusCode,200);
  assert.equal((await request('api/clients',a,'POST',{name:'Cliente A',contact:'',phone:'',email:'',taxDocument:'',postal:''})).statusCode,200);
  assert.equal((await request('api/quotes',a,'POST',{data:{title:'Pedido A',client:null,items:[],notes:''},expectedRevision:0})).statusCode,200);
  assert.equal((await request('api/settings/produtos',a,'PUT',{data:{productsPerPage:'20'},expectedRevision:0})).statusCode,200);
  const bLogin=await login('b@example.test','b',admin.invite('b@example.test'));assert.equal(bLogin.statusCode,200,bLogin.body);const b=session(bLogin);b['x-pilot-context']=(await request('api/pilot/session',b)).json().context;
  for(const area of ['products','clients','quotes'])assert.deepEqual((await request('api/'+area,b)).json(),[]);
  assert.equal((await request('api/settings/produtos',b)).json().revision,0);
  assert.equal((await request('api/quotes/1',b)).statusCode,404);
  assert.equal((await request('api/products',b,'POST',product('Produto B'))).statusCode,200);
  const exported=(await request('api/products/export',b)).json();assert.equal(exported.products.length,1);assert.equal(exported.products[0].name,'Produto B');assert.ok(!JSON.stringify(exported).includes('Produto A'));
  assert.equal((await request('api/products',{...b,'x-pilot-context':a['x-pilot-context']})).statusCode,409);
  assert.equal((await request('api/products',{...a,'x-pilot-csrf':'wrong'},'POST',product('Forbidden'))).statusCode,403);
  assert.equal((await request('api/products',{...a,origin:'https://evil.example'},'POST',product('Forbidden'))).statusCode,403);
  const aProduct=(await request('api/products',a)).json()[0];
  assert.equal((await request('api/records/products/actions',a,'POST',{action:'archive',records:[{id:aProduct.id,updatedAt:aProduct.updatedAt}],confirm:true})).statusCode,200);
  assert.equal((await request('api/records/products/archived',b)).json().length,0);
  assert.equal((await request('api/records/products/archived',a)).json()[0].name,'Produto A');
  assert.equal((await request('api/products',b)).json()[0].name,'Produto B');
  assert.ok(readdirSync(join(dir,'tenants')).length===2);
  const hashes=admin.db.prepare('SELECT hash FROM pilot_sessions').all();assert.ok(hashes.every(r=>!a.cookie.includes(String(r.hash))));
  await app.close();app=await createPilotApp(settings,provider);
  assert.equal((await request('api/clients',a)).json()[0].name,'Cliente A');assert.equal((await request('api/clients',b)).json().length,0);
  const html=await request('',a);assert.equal(html.statusCode,200);assert.match(html.body,/pilot-context/);assert.match(html.body,/pilot-session.js/);assert.match(html.body,/data-pilot-module/);assert.ok(!html.body.includes('<script type="module"'),'Interface deve esperar o isolamento de cache antes de carregar JavaScript');assert.ok(html.body.includes('Artesão Digital v'+buildInfo.pilotVersion));assert.ok(html.body.includes('Fabricação e Orçamentos v'+buildInfo.coreVersion));
  // A stale tab must not revoke a valid session without CSRF/context proof.
  const refused=await request('auth/logout',{...b,'x-pilot-csrf':'wrong'},'POST');assert.equal(refused.statusCode,403);assert.equal(refused.headers['set-cookie'],undefined);
  assert.equal((await request('api/products',b)).statusCode,200);
  assert.equal((await request('auth/logout',{...b,'x-pilot-context':a['x-pilot-context']},'POST')).statusCode,403);
  assert.equal((await request('auth/logout',{...b,origin:'https://evil.example'},'POST')).statusCode,403);
  // Idle expiry with cookies still present: leaving the application is idempotent.
  admin.db.prepare('UPDATE pilot_sessions SET last_seen=0 WHERE user_id=?').run(b['x-pilot-context']);
  assert.equal((await request('api/products',b)).statusCode,401);
  const expiredLogout=await request('auth/logout',b,'POST');assert.equal(expiredLogout.statusCode,200);assert.equal(expiredLogout.cookies.length,2);assert.ok(expiredLogout.cookies.every(c=>c.maxAge===0));
  const repeatedLogout=await request('auth/logout',{origin},'POST');assert.equal(repeatedLogout.statusCode,200);assert.equal(repeatedLogout.cookies.length,2);

  admin.revoke('a@example.test');assert.equal((await request('api/products',a)).statusCode,401);assert.equal((await login('a@example.test','a')).statusCode,403);
  const leaked=readFileSync(join(dir,'pilot-control.sqlite'));assert.ok(!leaked.includes(Buffer.from(inviteA)));
 }finally{await app.close();admin.close();rmSync(dir,{recursive:true,force:true});}
});
test('opções aceitam cinco pares, preservam dois antigos e não reativam convites consumidos',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pilot-five-'));const optionsFile=join(dir,'options.json');
 const options:Record<string,string>={public_url:origin+prefix,google_client_id:'fixture',google_client_secret:'fixture'};
 const env={PILOT_OPTIONS_FILE:optionsFile,DATA_DIR:dir};
 const provider:IdentityProvider={async start(){throw Error('Not used');},async complete(){throw Error('Not used');}};
 try{
  for(const n of [1,2]){options['test_email_'+n]=`account${n}@example.test`;options['test_invite_'+n]=`synthetic-invite-${n}-01234567890123456789`;}
  writeFileSync(optionsFile,JSON.stringify(options));assert.equal(pilotConfig(env).initialInvites!.length,2);
  for(const n of [3,4,5]){options['test_email_'+n]=`account${n}@example.test`;options['test_invite_'+n]=`synthetic-invite-${n}-01234567890123456789`;}
  writeFileSync(optionsFile,JSON.stringify(options));const settings=pilotConfig(env);assert.equal(settings.initialInvites!.length,5);assert.equal(settings.maxUsers,5);
  const overridden=pilotConfig({...env,PILOT_TEST_EMAIL_5:'override@example.test',PILOT_TEST_INVITE_5:'synthetic-override-01234567890123456789'});
  assert.equal(overridden.initialInvites![4].email,'override@example.test');
  const manifest=readFileSync(resolve('pilot/config.yaml'),'utf8');
  for(const n of [1,2,3,4,5]){assert.ok(manifest.includes(`  test_email_${n}: ""`));assert.ok(manifest.includes(`  test_invite_${n}: password`));}
  const app=await createPilotApp(settings,provider);await app.close();
  const store=new PilotStore(dir);
  try{
   assert.equal(store.db.prepare('SELECT COUNT(*) n FROM pilot_invites').get()!.n,5);
   for(const n of [1,2,3,4,5]){
    const user=store.activate({issuer:'https://accounts.google.com',subject:'subject'+n,email:`account${n}@example.test`,verified:true},digest(options['test_invite_'+n]),settings.maxUsers);
    assert.ok(user);
   }
   const extra=store.invite('extra@example.test');
   assert.throws(()=>store.activate({issuer:'https://accounts.google.com',subject:'sixth',email:'extra@example.test',verified:true},digest(extra),settings.maxUsers),/Limite/);
   const before=store.db.prepare('SELECT hash,used_at,expires_at FROM pilot_invites ORDER BY hash').all();
   const restarted=await createPilotApp(settings,provider);await restarted.close();
   assert.deepEqual(store.db.prepare('SELECT hash,used_at,expires_at FROM pilot_invites ORDER BY hash').all(),before);
   assert.equal(store.db.prepare('SELECT COUNT(*) n FROM pilot_users').get()!.n,5);
  }finally{store.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('estados e convites expiram, não são reutilizados e limite de participantes é aplicado',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pilot-store-'));const store=new PilotStore(dir);
 try{
  const invite=store.invite('a@example.test');const id={issuer:'https://accounts.google.com',subject:'a',email:'a@example.test',verified:true};
  store.flow('state','browser','verifier','nonce',invite);assert.equal(store.takeFlow('state','wrong'),null);assert.ok(store.takeFlow('state','browser'));assert.equal(store.takeFlow('state','browser'),null);
  store.flow('expired','browser','verifier','nonce',invite);store.db.prepare('UPDATE pilot_flows SET expires_at=0').run();assert.equal(store.takeFlow('expired','browser'),null);
  assert.throws(()=>store.activate({...id,verified:false},digest(invite),5));const a=store.activate(id,digest(invite),1);assert.ok(a);
  assert.throws(()=>store.activate({...id,subject:'different'},digest(invite),5));assert.throws(()=>store.activate({...id,subject:'b',email:'b@example.test'},digest(store.invite('b@example.test')),1));
  const created=store.session(a,8);store.db.prepare('UPDATE pilot_sessions SET last_seen=0').run();assert.equal(store.getSession(created.value,30),null);
  assert.equal(store.limited('login',1),false);assert.equal(store.limited('login',1),true);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
