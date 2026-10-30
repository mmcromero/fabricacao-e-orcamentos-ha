import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,readdirSync} from 'node:fs';
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
  assert.equal((await request('auth/google/start',{origin:'https://evil.example'},'POST',{})).statusCode,403);
  assert.equal((await request('login',{host:'evil.example'})).statusCode,421);
  const inviteA=admin.invite('a@example.test');const invalid=await login('wrong@example.test','wrong',inviteA);assert.equal(invalid.statusCode,403);
  const aLogin=await login('a@example.test','a',inviteA);assert.equal(aLogin.statusCode,302,aLogin.body);const a=session(aLogin);assert.ok(aLogin.cookies.find(c=>c.name==='__Secure-artesaos_session')!.httpOnly);assert.ok(aLogin.cookies.every(c=>c.secure));
  a['x-pilot-context']=(await request('api/pilot/session',a)).json().context;
  assert.equal((await request('api/products',a,'POST',product('Produto A'))).statusCode,200);
  assert.equal((await request('api/clients',a,'POST',{name:'Cliente A',contact:'',phone:'',email:'',taxDocument:'',postal:''})).statusCode,200);
  assert.equal((await request('api/quotes',a,'POST',{data:{title:'Pedido A',client:null,items:[],notes:''},expectedRevision:0})).statusCode,200);
  assert.equal((await request('api/settings/produtos',a,'PUT',{data:{productsPerPage:'20'},expectedRevision:0})).statusCode,200);
  const bLogin=await login('b@example.test','b',admin.invite('b@example.test'));const b=session(bLogin);b['x-pilot-context']=(await request('api/pilot/session',b)).json().context;
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
  const html=await request('',a);assert.equal(html.statusCode,200);assert.match(html.body,/pilot-context/);assert.match(html.body,/pilot-session.js/);
  assert.equal((await request('auth/logout',b,'POST')).statusCode,200);assert.equal((await request('api/products',b)).statusCode,401);
  admin.revoke('a@example.test');assert.equal((await request('api/products',a)).statusCode,401);assert.equal((await login('a@example.test','a')).statusCode,403);
  const leaked=readFileSync(join(dir,'pilot-control.sqlite'));assert.ok(!leaked.includes(Buffer.from(inviteA)));
 }finally{await app.close();admin.close();rmSync(dir,{recursive:true,force:true});}
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
