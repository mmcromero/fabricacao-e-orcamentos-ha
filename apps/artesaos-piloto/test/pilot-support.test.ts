import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createPilotApp} from '../server/pilot/app.js';
import {PilotStore,type Identity} from '../server/pilot/store.js';
import {SupportStore} from '../server/pilot/support-store.js';
import type {PilotConfig} from '../server/pilot/config.js';
const origin='https://support.example.test:8443',prefix='/artesaos-piloto/';
test('suporte: isolamento por conta, sessão/contexto/CSRF, conversa, status, reenvio e persistência',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pilot-support-'));const config:PilotConfig={publicUrl:new URL(origin+prefix),prefix,dataDir:dir,staticDir:resolve('dist'),clientId:'fixture',clientSecret:'fixture',sessionHours:8,idleMinutes:30,maxUsers:5,adminEmails:['admin@example.test']};
 let identity:Identity={issuer:'https://accounts.google.com',subject:'a',email:'a@example.test',verified:true};
 const provider={async start(state:string){return 'https://accounts.google.com/test?state='+state;},async complete(){return identity;}};
 let app=await createPilotApp(config,provider);const control=new PilotStore(dir);
 const request=(path:string,headers:Record<string,string>={},method='GET',payload?:unknown)=>app.inject({url:prefix+path,method:method as any,headers:{host:new URL(origin).host,origin,...headers},...(payload===undefined?{}:{payload:payload as any})});
 async function login(subject:string,admin=false){
  identity={issuer:'https://accounts.google.com',subject,email:subject+'@example.test',verified:true};const start=await request(admin?'admin/auth/google/start':'auth/google/start',{},'POST',{invite:admin?'':control.invite(identity.email)});assert.equal(start.statusCode,302,start.body);const flow=start.cookies.find(cookie=>cookie.name==='__Secure-artesaos_flow')!;const state=new URL(String(start.headers.location)).searchParams.get('state');const result=await request('auth/google/callback?state='+state+'&code=fixture',{cookie:flow.name+'='+flow.value});assert.equal(result.statusCode,200,result.body);
  const cookies=result.cookies.map(cookie=>cookie.name+'='+cookie.value).join('; '),csrf=result.cookies.find(cookie=>cookie.name===(admin?'__Secure-artesaos_admin_csrf':'__Secure-artesaos_csrf'))!.value;
  const session=(await request(admin?'admin/api/session':'api/pilot/session',{cookie:cookies})).json();return {cookie:cookies,[admin?'x-pilot-admin-context':'x-pilot-context']:session.context,[admin?'x-pilot-admin-csrf':'x-pilot-csrf']:csrf};
 }
 try{
  assert.equal((await request('api/support')).statusCode,401);assert.equal((await request('admin/api/support')).statusCode,401);
  const a=await login('a'),b=await login('b'),admin=await login('admin',true);
  assert.equal((await request('api/products',a)).statusCode,428,'Suporte funciona durante as boas-vindas');
  const input={kind:'bug',subject:'Erro no cadastro',body:'Texto literal <script>alert(1)</script>\nPasso a passo do teste.',requestKey:randomUUID()};
  assert.equal((await request('api/support',a,'POST',{...input,owner:'forged'})).statusCode,400);
  assert.equal((await request('api/support',a,'POST',{...input,kind:'invalid'})).statusCode,400);
  assert.equal((await request('api/support',a,'POST',{...input,body:' '})).statusCode,400);
  assert.equal((await request('api/support',a,'POST',{...input,subject:'x'.repeat(161)})).statusCode,400);
  assert.equal((await request('api/support',{...a,'x-pilot-csrf':'wrong'},'POST',input)).statusCode,403);
  assert.equal((await request('api/support',{...a,origin:'https://evil.example'},'POST',input)).statusCode,403);
  const made=await request('api/support',a,'POST',input);assert.equal(made.statusCode,200,made.body);const ticket=made.json();assert.equal(ticket.status,'open');assert.equal(ticket.email,'a@example.test');assert.equal(ticket.events[0].body,input.body);
  assert.equal((await request('api/support',a,'POST',input)).json().id,ticket.id);assert.equal((await request('api/support',a)).json().total,1);
  assert.equal((await request('api/support',{...a,'x-pilot-context':b['x-pilot-context']})).statusCode,409);
  assert.equal((await request('api/support',b)).json().total,0);assert.equal((await request('api/support/'+ticket.id,b)).statusCode,404);
  const reply={body:'Resposta de teste',expectedRevision:1,requestKey:randomUUID()};
  assert.equal((await request('api/support/'+ticket.id+'/messages',b,'POST',reply)).statusCode,404);
  assert.equal((await request('api/support/'+ticket.id+'/messages',a,'POST',{...reply,status:'closed'})).statusCode,400);
  assert.equal((await request('admin/api/support',a)).statusCode,401);assert.equal((await request('api/support',admin)).statusCode,401);
  assert.equal((await request('admin/api/support',{cookie:admin.cookie})).statusCode,409);assert.equal((await request('admin/api/support',admin)).json().total,1);
  assert.equal((await request('admin/api/support?status=forged',admin)).statusCode,400);
  assert.equal((await request('admin/api/support/'+ticket.id+'/messages',{...admin,'x-pilot-admin-csrf':'wrong'},'POST',{...reply,status:'waiting_customer'})).statusCode,403);
  const answered=await request('admin/api/support/'+ticket.id+'/messages',admin,'POST',{...reply,status:'waiting_customer'});assert.equal(answered.statusCode,200,answered.body);assert.equal(answered.json().status,'waiting_customer');assert.equal(answered.json().events[1].role,'admin');
  assert.equal((await request('api/support/'+ticket.id,a)).json().events.length,2);
  assert.equal((await request('admin/api/support/'+ticket.id+'/messages',admin,'POST',{body:'Stale',status:'closed',expectedRevision:1,requestKey:randomUUID()})).statusCode,409);
  const customer={body:'Mais informações',expectedRevision:2,requestKey:randomUUID()};const posted=await request('api/support/'+ticket.id+'/messages',a,'POST',customer);assert.equal(posted.statusCode,200);assert.equal(posted.json().status,'open');assert.equal(posted.json().revision,3);
  assert.equal((await request('api/support/'+ticket.id+'/messages',a,'POST',customer)).json().events.length,3);
  for(const [index,status] of ['analysis','answered','closed'].entries()){
   const changed=await request('admin/api/support/'+ticket.id+'/messages',admin,'POST',{body:'',status,expectedRevision:3+index,requestKey:randomUUID()});assert.equal(changed.statusCode,200,changed.body);assert.equal(changed.json().status,status);
  }
  const reopened=await request('api/support/'+ticket.id+'/messages',a,'POST',{body:'Preciso retomar',expectedRevision:6,requestKey:randomUUID()});assert.equal(reopened.json().status,'open');assert.equal(reopened.json().revision,7);
  assert.equal((await request('admin/api/support?kind=bug&status=open',admin)).json().total,1);
  await app.close();app=await createPilotApp(config,provider);assert.equal((await request('api/support/'+ticket.id,a)).json().events.length,7);assert.equal((await request('api/support',b)).json().total,0);assert.equal((await request('admin/api/support',admin)).json().items[0].email,'a@example.test');
  assert.equal(statSync(join(dir,'pilot-support.sqlite')).mode&0o777,0o600);
  await app.close();app=await createPilotApp({...config,adminEmails:[]},provider);assert.equal((await request('admin/api/support',admin)).statusCode,401);
 }finally{await app.close();control.close();rmSync(dir,{recursive:true,force:true});}
});
test('suporte pagina por dono e filtro sem vazar registros de outras contas',()=>{
 const dir=mkdtempSync(join(tmpdir(),'support-pages-'));const store=new SupportStore(dir);
 try{for(let index=0;index<24;index++)store.create('a','a@example.test',{kind:'question',subject:'Dúvida '+index,body:'Detalhes',requestKey:randomUUID()});store.create('b','b@example.test',{kind:'bug',subject:'Erro privado B',body:'Privado',requestKey:randomUUID()});assert.equal(store.list('a',1).items.length,20);assert.equal(store.list('a',2).items.length,4);assert.equal(store.list('a',2).total,24);assert.equal(store.list(undefined,1,undefined,'bug').total,1);assert.equal(store.list('a',1,undefined,'bug').total,0);assert.equal(store.list('b',999).page,1);}finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
