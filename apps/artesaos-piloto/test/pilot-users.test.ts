import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createPilotApp} from '../server/pilot/app.js';
import {PilotStore,digest} from '../server/pilot/store.js';
import type {PilotConfig} from '../server/pilot/config.js';
const origin='https://users.example.test',prefix='/artesaos-piloto/';
test('admin consulta somente contas ativadas e dados cadastrais; convite pendente, sessão comum e aba antiga não autorizam acesso',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pilot-users-'));const config:PilotConfig={publicUrl:new URL(origin+prefix),prefix,dataDir:dir,staticDir:resolve('dist'),clientId:'fixture',clientSecret:'fixture',sessionHours:8,idleMinutes:30,maxUsers:5,adminEmails:['admin@example.test']};
 const store=new PilotStore(dir);let app=await createPilotApp(config);
 const identity=(name:string)=>({issuer:'https://accounts.google.com',subject:name,email:name+'@example.test',verified:true});
 const admin=store.adminSession(identity('admin'));const adminSession=store.getAdmin(admin.value,config.adminEmails!)!;
 const headers={cookie:'__Secure-artesaos_admin_session='+admin.value,'x-pilot-admin-context':adminSession.context};
 const request=(path:string,h:Record<string,string>=headers)=>app.inject({url:prefix+path,headers:{host:new URL(origin).host,...h}});
 try{
  assert.deepEqual((await request('admin/api/users')).json(),{records:[],total:0});
  store.invite('pending@example.test');
  assert.equal((await request('admin/api/users')).json().total,0);
  const invite=store.invite('registered@example.test'),id=store.activate(identity('registered'),digest(invite),5);
  const noProfileInvite=store.invite('new@example.test'),newId=store.activate(identity('new'),digest(noProfileInvite),5);
  const tenant=String(store.db.prepare('SELECT tenant_id FROM pilot_users WHERE id=?').get(id)!.tenant_id),tenantDir=join(dir,'tenants',tenant);mkdirSync(tenantDir,{recursive:true});
  const db=new DatabaseSync(join(tenantDir,'validation.sqlite'));db.exec('CREATE TABLE company_profile(id INTEGER PRIMARY KEY,data TEXT,revision INTEGER); CREATE TABLE products(id INTEGER PRIMARY KEY,data TEXT)');
  db.prepare('INSERT INTO company_profile VALUES(1,?,1)').run(JSON.stringify({name:'Ateliê <script>literal</script>',responsible:'Pessoa de teste',phone:'11999990000',email:'contato@example.test',secret:'must not leak'}));db.prepare('INSERT INTO products VALUES(1,?)').run('commercial data must not leak');db.close();
  let result=await request('admin/api/users');assert.equal(result.statusCode,200);assert.equal(result.json().total,2);assert.ok(!result.body.includes('pending@example.test'));assert.deepEqual(Object.keys(result.json().records[0]).sort(),['disabled','email','id']);
  const details=await request('admin/api/users/'+id);assert.equal(details.statusCode,200);assert.deepEqual(details.json().company,{name:'Ateliê <script>literal</script>',responsible:'Pessoa de teste',phone:'11999990000',email:'contato@example.test'});assert.ok(!details.body.includes('must not leak'));assert.ok(!details.body.includes('tenant'));assert.ok(!details.body.includes('commercial data'));
  assert.equal((await request('admin/api/users/'+newId)).json().company,null);const newTenant=String(store.db.prepare('SELECT tenant_id FROM pilot_users WHERE id=?').get(newId)!.tenant_id);assert.equal(existsSync(join(dir,'tenants',newTenant)),false,'Consultar não cria banco nem configuração para usuário');
  const session=store.session(id,8),ordinary={cookie:'__Secure-artesaos_session='+session.value,'x-pilot-context':id};
  for(const path of ['admin/api/users','admin/api/users/'+id]){assert.equal((await request(path,{})).statusCode,401);assert.equal((await request(path,ordinary)).statusCode,401);assert.equal((await request(path,{...headers,'x-pilot-admin-context':'old-tab'})).statusCode,409);}
  assert.equal((await request('admin/api/users/00000000-0000-0000-0000-000000000000')).statusCode,404);
  assert.equal((await request('admin/users',ordinary)).statusCode,302);
  store.revoke('registered@example.test');assert.equal((await request('admin/api/users/'+id)).json().disabled,true);assert.equal((await request('admin/api/users')).json().total,2);
  await app.close();app=await createPilotApp(config);assert.equal((await request('admin/api/users')).json().total,2);
  await app.close();app=await createPilotApp({...config,adminEmails:[]});assert.equal((await request('admin/api/users')).statusCode,401);
 }finally{await app.close();store.close();rmSync(dir,{recursive:true,force:true});}
});
