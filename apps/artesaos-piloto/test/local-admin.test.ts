import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,statSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {PilotStore} from '../server/pilot/store.js';
import {LocalAdmin,bindDistribution} from '../server/pilot/local-admin.js';
import {createPilotApp} from '../server/pilot/app.js';
import {pilotConfig,type PilotConfig} from '../server/pilot/config.js';
const origin='https://debian.example.test',prefix='/artesaos-piloto/',password='Senha de teste longa 321!';
const email='admin@example.test';
async function fixture(distribution:'home-assistant'|'debian'='debian'){
 const dir=mkdtempSync(join(tmpdir(),'local-admin-'));
 const config:PilotConfig={distribution,publicUrl:new URL(origin+prefix),prefix,dataDir:dir,staticDir:resolve('dist'),clientId:'fixture',clientSecret:'fixture',sessionHours:8,idleMinutes:30,maxUsers:null,adminEmails:[email]};
 let identity={issuer:'https://accounts.google.com',subject:'user',email:'user@example.test',verified:true};
 const provider={async start(state:string){return 'https://accounts.google.com/test?state='+state;},async complete(){return identity;}};
 const app=await createPilotApp(config,provider),store=new PilotStore(dir),local=new LocalAdmin(store);
 const request=(path:string,method='GET',payload?:unknown,headers:Record<string,string>={})=>app.inject({url:prefix+path,method:method as any,headers:{host:new URL(origin).host,...(method==='GET'?{}:{origin}),...headers},...(payload===undefined?{}:{payload:payload as any})});
 return {dir,app,store,local,request,setIdentity:(next:typeof identity)=>{identity=next;},async close(){await app.close();store.close();rmSync(dir,{recursive:true,force:true});}};
}
const body=(code:string)=>({email,password,confirmation:password,code});
const cookies=(r:any)=>r.cookies.map((c:any)=>c.name+'='+c.value).join('; ');
function codeFor(local:LocalAdmin,purpose:'setup'|'recovery'='setup'){let code='';local.issueCode(purpose,value=>{code=value;});return code;}

test('Debian: Primeiro Acesso, senha protegida, login, APIs administrativas e logout com CSRF',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('admin/login')).headers.location,prefix+'admin/setup');
  const page=await f.request('admin/setup');assert.match(page.body,/Primeiro Acesso/);assert.doesNotMatch(page.body,/Entrar na administração com Google/);
  assert.equal((await f.request('admin/api/users')).statusCode,401);
  assert.equal((await f.request('admin/auth/google/start','POST',{})).statusCode,403);
  const code=codeFor(f.local);
  assert.equal((await f.request('admin/auth/setup','POST',body(code),{origin:'https://evil.example'})).statusCode,403);
  assert.equal((await f.request('admin/auth/setup','POST',body(code))).statusCode,303);
  assert.equal((await f.request('admin/setup')).statusCode,404);
  assert.equal((await f.request('admin/auth/setup','POST',body(code))).statusCode,403);
  const row=f.store.db.prepare('SELECT * FROM local_admin').get()!;assert.match(String(row.password_hash),/^scrypt\$32768\$8\$1\$/);assert.ok(!JSON.stringify(row).includes(password));
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM local_admin_activation').get()!.n,0);
  const login=await f.request('admin/auth/login','POST',{email,password});assert.equal(login.statusCode,303,login.body);
  const sessionCookie=cookies(login);assert.ok(login.cookies.every((c:any)=>c.secure&&c.path===prefix+'admin/'));assert.ok(login.cookies.find((c:any)=>c.name==='__Secure-artesaos_admin_session').httpOnly);
  const session=await f.request('admin/api/session','GET',undefined,{cookie:sessionCookie});assert.equal(session.statusCode,200);
  const auth={cookie:sessionCookie,'x-pilot-admin-context':session.json().context,'x-pilot-admin-csrf':login.cookies.find((c:any)=>c.name==='__Secure-artesaos_admin_csrf').value};
  assert.equal((await f.request('admin/api/users','GET',undefined,auth)).statusCode,200);
  assert.equal((await f.request('admin/api/users','GET',undefined,{...auth,'x-pilot-admin-context':'wrong'})).statusCode,409);
  assert.equal((await f.request('admin/api/invitations','POST',{name:'Pessoa',email:'invite@example.test',requestKey:'a'.repeat(36)},{...auth,'x-pilot-admin-csrf':'wrong'})).statusCode,403);
  assert.equal((await f.request('admin/auth/logout','POST',{},auth)).statusCode,200);
  assert.equal((await f.request('admin/api/session','GET',undefined,auth)).statusCode,401);
 }finally{await f.close();}
});

test('primeiro acesso simultâneo admite exatamente um administrador e consome o código uma vez',async()=>{
 const f=await fixture();try{
  const code=codeFor(f.local);
  const replies=await Promise.all([f.request('admin/auth/setup','POST',body(code)),f.request('admin/auth/setup','POST',{...body(code),email:'other@example.test'})]);
  assert.deepEqual(replies.map(r=>r.statusCode).sort(),[303,403]);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM local_admin').get()!.n,1);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM local_admin_activation').get()!.n,0);
  assert.throws(()=>f.store.db.prepare('INSERT INTO local_admin VALUES(2,?,?,1,?)').run('second@example.test','invalid','now'),/CHECK/);
 }finally{await f.close();}
});

test('código expirado, código substituído, senha curta e confirmação divergente não criam administrador',async()=>{
 const f=await fixture();try{
  let now=Date.now();const local=new LocalAdmin(f.store,()=>now);const old=codeFor(local),fresh=codeFor(local);
  await assert.rejects(local.setPassword('setup',email,password,password,old),/Código/);
  await assert.rejects(local.setPassword('setup',email,'curta','curta',fresh),/12 a 128/);
  await assert.rejects(local.setPassword('setup',email,password,'outra',fresh),/confirmação/);
  now+=30*60000;
  await assert.rejects(local.setPassword('setup',email,password,password,fresh),/expirado/);
  assert.equal(local.exists(),false);
  f.store.db.prepare('UPDATE local_admin_activation SET expires_at=?').run(Date.now()-1);
  assert.equal((await f.request('admin/auth/setup','POST',body(fresh))).statusCode,403);
  assert.equal(local.exists(),false);
 }finally{await f.close();}
});

test('recuperação por código local troca senha, invalida sessões e não permite reuso nem reabrir setup',async()=>{
 const f=await fixture();try{
  await f.local.setPassword('setup',email,password,password,codeFor(f.local));
  const before=await f.local.login(email,password);assert.ok(f.local.current(before.value));
  const code=codeFor(f.local,'recovery'),next='Outra senha de teste 456!';
  await assert.rejects(f.local.setPassword('recovery','wrong@example.test',next,next,code),/Código/);
  const recovered=await f.request('admin/auth/recovery','POST',{email,password:next,confirmation:next,code});assert.equal(recovered.statusCode,303,recovered.body);
  assert.equal(f.local.current(before.value),null);
  await assert.rejects(f.local.login(email,password),/inválidos/);
  assert.ok((await f.local.login(email,next)).value);
  await assert.rejects(f.local.setPassword('recovery',email,password,password,code),/Código/);
  assert.throws(()=>codeFor(f.local),/indisponível/);
  assert.equal((await f.request('admin/setup')).statusCode,404);
 }finally{await f.close();}
});

test('limites e origem protegem autenticação local, sem refletir senha ou código',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('admin/auth/login','POST',{email,password},{origin:'https://evil.example'})).statusCode,403);
  const code=codeFor(f.local);assert.ok(!String(f.store.db.prepare('SELECT * FROM local_admin_activation').get()!.code_hash).includes(code));
  for(let i=0;i<10;i++){const r=await f.request('admin/auth/setup','POST',body('invalido'));assert.equal(r.statusCode,403);assert.ok(!r.body.includes(password));assert.ok(!r.body.includes('value="invalido"'));}
  assert.equal((await f.request('admin/auth/setup','POST',body(code))).statusCode,429);
  assert.equal(f.local.exists(),false);
 }finally{await f.close();}
});

test('HA mantém login Google e não publica rotas locais; bancos HA e Debian têm schema idêntico',async()=>{
 const ha=await fixture('home-assistant'),debian=await fixture('debian');try{
  assert.match((await ha.request('admin/login')).body,/Entrar na administração com Google/);
  for(const path of ['admin/setup','admin/recover'])assert.equal((await ha.request(path)).statusCode,404);
  for(const path of ['admin/auth/setup','admin/auth/login','admin/auth/recovery'])assert.equal((await ha.request(path,'POST',body('invalid'))).statusCode,404);
  const schema=(s:PilotStore)=>s.db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();assert.deepEqual(schema(ha.store),schema(debian.store));
  assert.throws(()=>bindDistribution(ha.store,'debian'),/outra distribuição/);
  assert.throws(()=>bindDistribution(debian.store,'home-assistant'),/outra distribuição/);
  const login=await debian.request('admin/auth/login','POST',{email,password});assert.equal(login.statusCode,403);
 }finally{await ha.close();await debian.close();}
});

test('Google comum mantém contas e tenants nos dois modos; cookies não atravessam instalações ou administração',async()=>{
 for(const mode of ['home-assistant','debian'] as const){
  const f=await fixture(mode),other=await fixture(mode);try{
   const login=async(mail:string,subject:string)=>{
    f.setIdentity({issuer:'https://accounts.google.com',subject,email:mail,verified:true});
    const invite=f.store.invite(mail),start=await f.request('auth/google/start','POST',{invite});assert.equal(start.statusCode,302);
    const state=new URL(String(start.headers.location)).searchParams.get('state'),flow=start.cookies.find((c:any)=>c.name==='__Secure-artesaos_flow')!;
    return f.request('auth/google/callback?state='+state+'&code=fixture','GET',undefined,{cookie:flow.name+'='+flow.value});
   };
   const a=await login('a@example.test','a'),b=await login('b@example.test','b');assert.equal(a.statusCode,200);assert.equal(b.statusCode,200);
   const getSession=async(r:any)=>(await f.request('api/pilot/session','GET',undefined,{cookie:cookies(r)})).json();
   const sa=await getSession(a),sb=await getSession(b);assert.notEqual(sa.context,sb.context);
   assert.equal((await f.request('api/company','GET',undefined,{cookie:cookies(a),'x-pilot-context':sb.context})).statusCode,409);
   assert.equal((await f.request('admin/api/users','GET',undefined,{cookie:cookies(a)})).statusCode,401);
   assert.equal((await other.request('api/pilot/session','GET',undefined,{cookie:cookies(a)})).statusCode,401);
   const tenants=f.store.db.prepare('SELECT tenant_id FROM pilot_users').all();assert.equal(new Set(tenants.map(t=>t.tenant_id)).size,2);
  }finally{await f.close();await other.close();}
 }
});

test('console gera arquivo restrito sem segredo em stdout; recusa HA e sobrescrita',()=>{
 const dir=mkdtempSync(join(tmpdir(),'local-console-')),data=join(dir,'data'),output=join(dir,'activation');
 const script=resolve('server/pilot/local-admin-console.ts');
 const run=(action:string,file:string,mode='debian')=>spawnSync(process.execPath,['--import','tsx',script,action,data,file],{encoding:'utf8',env:{...process.env,ARTESAO_DISTRIBUTION:mode}});
 try{
  assert.notEqual(run('setup-code',output,'home-assistant').status,0);assert.equal(existsSync(data),false);
  const first=run('setup-code',output);assert.equal(first.status,0,first.stderr);
  const code=readFileSync(output,'utf8').trim();assert.ok(code.length>=32);assert.ok(!first.stdout.includes(code));assert.equal(statSync(output).mode&0o777,0o600);
  assert.notEqual(run('setup-code',output).status,0);assert.equal(readFileSync(output,'utf8').trim(),code);
  const store=new PilotStore(data);try{assert.notEqual(store.db.prepare('SELECT code_hash FROM local_admin_activation').get()!.code_hash,code);}finally{store.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('configuração mantém HA por padrão e aceita somente modo Debian explícito',()=>{
 assert.match(readFileSync(existsSync('pilot/config.yaml')?'pilot/config.yaml':'config.yaml','utf8'),/ARTESAO_DISTRIBUTION: "home-assistant"/);
 const env={PILOT_PUBLIC_URL:origin+prefix,GOOGLE_CLIENT_ID:'fixture',GOOGLE_CLIENT_SECRET:'fixture'};
 assert.equal(pilotConfig(env).distribution,'home-assistant');
 assert.equal(pilotConfig({...env,ARTESAO_DISTRIBUTION:'debian'}).distribution,'debian');
 assert.throws(()=>pilotConfig({...env,ARTESAO_DISTRIBUTION:'outro'}),/Distribuição/);
});

test('migração B1 para B2 preserva sessão Google administrativa e não cria admin local no HA',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'b1-admin-upgrade-'));let store=new PilotStore(dir);
 try{
  const identity={issuer:'https://accounts.google.com',subject:'admin-google',email,verified:true};
  const session=store.adminSession(identity),context=store.getAdmin(session.value,[email])!.context;
  // Fixture sintética do schema B1: somente estruturas da nova migração são retiradas.
  store.db.exec('DROP TABLE local_admin; DROP TABLE local_admin_activation; DROP TABLE installation_distribution; DELETE FROM schema_migrations WHERE version>=2;');
  store.close();store=new PilotStore(dir);bindDistribution(store,'home-assistant');
  assert.equal(store.getAdmin(session.value,[email])!.context,context);
  assert.equal(store.db.prepare('SELECT COUNT(*) n FROM local_admin').get()!.n,0);
  assert.equal(store.db.prepare('SELECT MAX(version) n FROM schema_migrations').get()!.n,3);
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

test('sessões locais respeitam inatividade, expiração e isolamento entre instalações',async()=>{
 const f=await fixture(),other=await fixture();try{
  await f.local.setPassword('setup',email,password,password,codeFor(f.local));
  await other.local.setPassword('setup',email,password,password,codeFor(other.local));
  const a=await f.local.login(email,password);assert.equal(other.local.current(a.value),null);
  f.store.db.prepare('UPDATE pilot_admin_sessions SET last_seen=?').run(Date.now()-16*60000);assert.equal(f.local.current(a.value),null);
  const b=await f.local.login(email,password);f.store.db.prepare('UPDATE pilot_admin_sessions SET expires_at=?').run(Date.now()-1);assert.equal(f.local.current(b.value),null);
 }finally{await f.close();await other.close();}
});

test('código de recuperação expirado não altera senha nem encerra sessão válida',async()=>{
 const f=await fixture();try{
  await f.local.setPassword('setup',email,password,password,codeFor(f.local));
  const session=await f.local.login(email,password),code=codeFor(f.local,'recovery');
  f.store.db.prepare('UPDATE local_admin_activation SET expires_at=?').run(Date.now()-1);
  assert.equal((await f.request('admin/auth/recovery','POST',body(code))).statusCode,403);
  assert.ok(f.local.current(session.value));
 }finally{await f.close();}
});

test('Debian recusa callback Google administrativo mesmo com fluxo pré-existente e e-mail autorizado',async()=>{
 const f=await fixture();try{
  f.setIdentity({issuer:'https://accounts.google.com',subject:'google-admin',email,verified:true});
  f.store.flow('synthetic-state','synthetic-browser','verifier','nonce','','admin');
  const response=await f.request('auth/google/callback?state=synthetic-state&code=fixture','GET',undefined,{cookie:'__Secure-artesaos_flow=synthetic-browser'});
  assert.equal(response.statusCode,403);
  assert.equal(response.cookies.some((c:any)=>c.name==='__Secure-artesaos_admin_session'),false);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM pilot_admin_sessions').get()!.n,0);
 }finally{await f.close();}
});

test('dois processos disputam o mesmo Primeiro Acesso sem criar segundo administrador',async()=>{
 const {spawn}=await import('node:child_process');
 const f=await fixture();try{
  const code=codeFor(f.local),moduleUrl=new URL('../server/pilot/local-admin.ts',import.meta.url).href,storeUrl=new URL('../server/pilot/store.ts',import.meta.url).href;
  const script=`import {readFileSync} from 'node:fs';import {PilotStore} from ${JSON.stringify(storeUrl)};import {LocalAdmin} from ${JSON.stringify(moduleUrl)};const v=JSON.parse(readFileSync(0,'utf8')),s=new PilotStore(v.dir);try{await new LocalAdmin(s).setPassword('setup',v.email,v.password,v.password,v.code);process.stdout.write('created');}catch(e){if(e.status!==403)throw e;process.stdout.write('denied');}finally{s.close();}`;
  const run=(mail:string)=>new Promise<string>((resolve,reject)=>{
   const child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',script],{stdio:['pipe','pipe','pipe']});let out='',err='';
   child.stdout.on('data',chunk=>out+=chunk);child.stderr.on('data',chunk=>err+=chunk);child.on('error',reject);child.on('exit',status=>status===0?resolve(out):reject(Error(err)));
   child.stdin.end(JSON.stringify({dir:f.dir,email:mail,password,code}));
  });
  assert.deepEqual((await Promise.all([run(email),run('other@example.test')])).sort(),['created','denied']);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM local_admin').get()!.n,1);
 }finally{await f.close();}
});
