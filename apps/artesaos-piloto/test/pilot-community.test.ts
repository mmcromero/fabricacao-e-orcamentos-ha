import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,unlinkSync,statSync,writeFileSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createPilotApp} from '../server/pilot/app.js';
import {PilotStore,type Identity} from '../server/pilot/store.js';
import {InterestStore,parseInterest} from '../server/pilot/interest.js';
import {pilotConfig,type PilotConfig} from '../server/pilot/config.js';
const origin='https://pilot.example.test:8443',prefix='/artesaos-piloto/';
const example={name:'Pessoa de Teste',email:'contact@example.test',whatsapp:'+55 (11) 91234-5678',consent:true,website:''};
test('interesse exige nome e e-mail; WhatsApp é opcional e campos têm limites',()=>{
 assert.equal(parseInterest({...example,whatsapp:''}).whatsapp,'');
 assert.equal(parseInterest(example).whatsapp,'5511912345678');
 for(const body of [{...example,name:' '},{...example,email:''},{...example,email:'invalid'},{...example,consent:false},{...example,whatsapp:'not-a-phone'},{...example,name:'x'.repeat(101)},{...example,name:'<script>'},{...example,admin:true}])assert.throws(()=>parseInterest(body));
 const dir=mkdtempSync(join(tmpdir(),'pilot-config-admin-'));
 try{const file=join(dir,'options.json');writeFileSync(file,JSON.stringify({public_url:origin+prefix,google_client_id:'fixture',google_client_secret:'fixture',admin_emails:['admin@example.test']}));assert.deepEqual(pilotConfig({PILOT_OPTIONS_FILE:file}).adminEmails,['admin@example.test']);assert.throws(()=>pilotConfig({PILOT_OPTIONS_FILE:file,PILOT_ADMIN_EMAILS:'not-an-email'}));}finally{rmSync(dir,{recursive:true,force:true});}
});
test('lista pública não libera conta; somente sessão administrativa autorizada pode consultar contatos',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pilot-community-'));
 const config:PilotConfig={publicUrl:new URL(origin+prefix),prefix,dataDir:dir,staticDir:resolve('dist'),clientId:'fixture',clientSecret:'fixture',sessionHours:8,idleMinutes:30,maxUsers:5,adminEmails:['admin@example.test']};
 let identity:Identity={issuer:'https://accounts.google.com',subject:'admin',email:'admin@example.test',verified:true};
 const provider={async start(state:string){return 'https://accounts.google.com/test?state='+state;},async complete(){return identity;}};
 let app=await createPilotApp(config,provider);const admin=new PilotStore(dir);
 const request=(path:string,headers:Record<string,string>={},method='GET',payload?:unknown)=>app.inject({url:prefix+path,method:method as any,headers:{host:new URL(origin).host,...headers},...(payload===undefined?{}:{payload:payload as any})});
 async function login(kind:'user'|'admin',who:Identity,invite=''){
  identity=who;const start=await request(kind==='admin'?'admin/auth/google/start':'auth/google/start',{origin},'POST',{invite});assert.equal(start.statusCode,302,start.body);const state=new URL(String(start.headers.location)).searchParams.get('state');const cookie=start.cookies.find(c=>c.name==='__Secure-artesaos_flow')!;
  return request('auth/google/callback?state='+state+'&code=fixture',{cookie:cookie.name+'='+cookie.value});
 }
 const cookieHeader=(r:any)=>r.cookies.map((c:any)=>c.name+'='+c.value).join('; ');
 try{
  const loginPage=await request('login');assert.match(loginPage.body,/Projeto piloto/);assert.match(loginPage.body,/interest-email/);
  assert.equal((await request('admin/api/interests')).statusCode,401);
  assert.equal((await request('api/interest')).statusCode,401);
  assert.equal((await request('api/interest/form',{origin:'https://evil.example'})).statusCode,403);
  const form=await request('api/interest/form');assert.equal(form.statusCode,200);assert.ok(form.cookies[0].httpOnly);assert.ok(form.cookies[0].secure);
  const headers={origin,cookie:cookieHeader(form)};const payload={...example,token:form.json().token};
  assert.equal((await request('api/interest',{...headers,origin:'https://evil.example'},'POST',payload)).statusCode,403);
  assert.equal((await request('api/interest',headers,'POST',{...payload,email:''})).statusCode,400);
  assert.equal((await request('api/interest',{origin},'POST',payload)).statusCode,403);
  const sent=await request('api/interest',headers,'POST',payload);assert.equal(sent.statusCode,202);assert.ok(!sent.body.includes(example.email));
  assert.equal((await request('api/interest',headers,'POST',payload)).statusCode,403,'token must be single use');
  assert.equal(admin.db.prepare('SELECT COUNT(*) n FROM pilot_users').get()!.n,0);
  const denied=await login('admin',{...identity,email:'ordinary@example.test',subject:'ordinary'});assert.equal(denied.statusCode,403);assert.ok(!denied.cookies.some(c=>c.name==='__Secure-artesaos_admin_session'));
  const userIdentity={...identity,email:'ordinary@example.test',subject:'ordinary'};const userLogin=await login('user',userIdentity,admin.invite(userIdentity.email));assert.equal(userLogin.statusCode,200);const userHeaders={cookie:cookieHeader(userLogin)};
  assert.equal((await request('admin/api/interests',userHeaders)).statusCode,401);
  assert.equal((await request('admin/',userHeaders)).headers.location,prefix+'admin/login');
  assert.equal((await request('admin/api/interests',{...userHeaders,'x-pilot-admin-context':'forged'})).statusCode,401);
  const adminLogin=await login('admin',{...identity,email:'admin@example.test',subject:'admin'});assert.equal(adminLogin.statusCode,200,adminLogin.body);assert.match(adminLogin.body,/admin\/finish.js/);assert.ok(adminLogin.cookies.filter(c=>c.name.startsWith('__Secure-artesaos_admin')).every(c=>c.path===prefix+'admin/'));
  assert.equal(admin.db.prepare('SELECT COUNT(*) n FROM pilot_users').get()!.n,1,'admin does not consume pilot user slots');
  const sessionCookie={cookie:cookieHeader(adminLogin)},adminSession=await request('admin/api/session',sessionCookie);assert.equal(adminSession.statusCode,200);
  const access={...sessionCookie,'x-pilot-admin-context':adminSession.json().context,origin,'x-pilot-admin-csrf':adminLogin.cookies.find(c=>c.name==='__Secure-artesaos_admin_csrf')!.value};
  assert.equal((await request('admin/api/interests',sessionCookie)).statusCode,409);
  const list=await request('admin/api/interests',access);assert.equal(list.statusCode,200);assert.equal(list.headers['cache-control'],'no-store');assert.equal(list.json().records[0].email,example.email);assert.equal(list.json().total,1);
  assert.equal((await request('admin/api/interests?page=1%20OR%201=1',access)).statusCode,400);
  const second=await request('api/interest/form');assert.equal((await request('api/interest',{origin,cookie:cookieHeader(second)},'POST',{...payload,token:second.json().token})).statusCode,202);assert.equal((await request('admin/api/interests',access)).json().total,1,'duplicates do not overwrite contacts');
  // Administrative pagination is bounded; returned strings are rendered as text.
  const leads=new InterestStore(dir);try{for(let n=0;n<27;n++)leads.add({name:'Pessoa '+n,email:`person${n}@example.test`,whatsapp:''});}finally{leads.close();}
  const pageTwo=await request('admin/api/interests?page=2',access);assert.equal(pageTwo.json().total,28);assert.equal(pageTwo.json().records.length,3);assert.equal(pageTwo.json().pages,2);
  const dbBytes=readFileSync(join(dir,'pilot-interest.sqlite'));for(const value of [example.name,example.email,'5511912345678'])assert.ok(!dbBytes.includes(Buffer.from(value)),'plaintext contact in database');
  assert.equal(statSync(join(dir,'pilot-interest.key')).mode&0o777,0o600);
  assert.equal((await request('admin/auth/logout',{...access,'x-pilot-admin-csrf':'wrong'},'POST')).statusCode,403);
  assert.equal((await request('admin/auth/logout',{...access,origin:'https://evil.example'},'POST')).statusCode,403);
  await app.close();app=await createPilotApp(config,provider);assert.equal((await request('admin/api/interests',access)).json().total,28,'restart preserves encrypted contacts');
  admin.db.prepare('UPDATE pilot_admin_sessions SET last_seen=0').run();assert.equal((await request('admin/api/interests',access)).statusCode,401);assert.equal((await request('admin/auth/logout',access,'POST')).statusCode,200);
  const renewed=await login('admin',{...identity,email:'admin@example.test',subject:'admin'});const renewedCookie={cookie:cookieHeader(renewed)};
  await app.close();app=await createPilotApp({...config,adminEmails:[]},provider);assert.equal((await request('admin/api/session',renewedCookie)).statusCode,401);assert.equal((await request('api/interest/form')).statusCode,503);
 }finally{await app.close();admin.close();rmSync(dir,{recursive:true,force:true});}
});
test('formulário rejeita token expirado, robôs não gravam contatos e tentativas são limitadas',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pilot-interest-abuse-'));const config:PilotConfig={publicUrl:new URL(origin+prefix),prefix,dataDir:dir,staticDir:resolve('dist'),clientId:'fixture',clientSecret:'fixture',sessionHours:8,idleMinutes:30,maxUsers:5,adminEmails:['admin@example.test']};const app=await createPilotApp(config,{async start(){throw Error();},async complete(){throw Error();}});
 const request=(path:string,headers:Record<string,string>={},method='GET',payload?:unknown)=>app.inject({url:prefix+path,method:method as any,headers:{host:new URL(origin).host,...headers},...(payload===undefined?{}:{payload:payload as any})});
 const store=new InterestStore(dir);
 try{
  let form=await request('api/interest/form');const cookies=()=>form.cookies.map(c=>c.name+'='+c.value).join('; ');
  store.db.prepare('UPDATE form_tokens SET expires_at=0').run();assert.equal((await request('api/interest',{origin,cookie:cookies()},'POST',{...example,token:form.json().token})).statusCode,403);
  form=await request('api/interest/form');assert.equal((await request('api/interest',{origin,cookie:cookies()},'POST',{...example,website:'robot',token:form.json().token})).statusCode,202);assert.equal(store.list(1).total,0);
  for(let n=0;n<20;n++)await request('api/interest',{origin},'POST',{});
  assert.equal((await request('api/interest',{origin},'POST',{})).statusCode,429);
 }finally{await app.close();store.close();rmSync(dir,{recursive:true,force:true});}
});
test('contatos cifrados falham sem a chave correta e retenção limita dados antigos',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pilot-interest-key-'));let store:InterestStore|undefined;
 try{store=new InterestStore(dir);store.add(parseInterest(example));assert.equal(store.list(1).total,1);store.db.prepare('UPDATE interests SET created_at=0').run();assert.equal(store.list(1).total,0);store.add(parseInterest(example));store.close();store=undefined;const original=readFileSync(join(dir,'pilot-interest.key'));writeFileSync(join(dir,'pilot-interest.key'),Buffer.alloc(32));assert.throws(()=>new InterestStore(dir));writeFileSync(join(dir,'pilot-interest.key'),original);store=new InterestStore(dir);assert.equal(store.list(1).total,1);store.close();store=undefined;unlinkSync(join(dir,'pilot-interest.key'));assert.throws(()=>new InterestStore(dir));}
 finally{store?.close();rmSync(dir,{recursive:true,force:true});}
});
test('migração de fluxos antigos preserva o login dos usuários existentes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pilot-flow-migration-'));const db=new DatabaseSync(join(dir,'pilot-control.sqlite'));db.exec('CREATE TABLE pilot_flows(hash TEXT PRIMARY KEY,browser_hash TEXT NOT NULL,verifier TEXT NOT NULL,nonce TEXT NOT NULL,invite_hash TEXT NOT NULL,expires_at INTEGER NOT NULL)');db.close();const store=new PilotStore(dir);try{store.flow('state','browser','verifier','nonce','');assert.equal(store.takeFlow('state','browser')!.purpose,'user');}finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

test('backup e restauração da lista exigem preservar banco e chave juntos',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pilot-interest-backup-')),restored=join(dir,'restore'),source=join(dir,'source');
 try{const original=new InterestStore(source);original.add(parseInterest(example));original.close();cpSync(source,restored,{recursive:true});const recovered=new InterestStore(restored);try{assert.equal(recovered.list(1).records[0].email,example.email);}finally{recovered.close();}}
 finally{rmSync(dir,{recursive:true,force:true});}
});
