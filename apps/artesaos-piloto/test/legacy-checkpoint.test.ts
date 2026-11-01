import {removePostLegacyFixtureTables} from './synthetic-legacy.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync,cpSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {PilotStore} from '../server/pilot/store.js';
import {Invitations} from '../server/pilot/invitations.js';
import {InterestStore} from '../server/pilot/interest.js';
import {SupportStore} from '../server/pilot/support-store.js';
import {LegalStore} from '../server/pilot/legal.js';
import {LocalAdmin,bindDistribution} from '../server/pilot/local-admin.js';
import {createApp} from '../server/app.js';
import {materialLedgerSql} from '../server/material-ledger-schema.js';
import {migrate} from '../server/foundation/migrations.js';

test('checkpoint: backup frio sintético completo restaura chaves, sessões, documentos e históricos em HA e Debian',async()=>{
 for(const mode of ['home-assistant','debian'] as const){
  const root=mkdtempSync(join(tmpdir(),'legacy-restore-')),source=join(root,'source'),restored=join(root,'restored');
  try{
   let store=new PilotStore(source);bindDistribution(store,mode);
   let invites=new Invitations(store,source);const invite=invites.issue('Pessoa','p@example.test','admin','request-restore',null);
   const user=store.activate({issuer:'https://accounts.google.com',subject:'u',email:'u@example.test',verified:true},invite.id,null);
   const session=store.session(user,8);const admin=store.adminSession({issuer:'https://accounts.google.com',subject:'a',email:'a@example.test',verified:true});
   if(mode==='debian'){const local=new LocalAdmin(store);let code='';local.issueCode('setup',v=>{code=v;});await local.setPassword('setup','local@example.test','Senha sintética extensa','Senha sintética extensa',code);}
   const tenant=String(store.db.prepare('SELECT tenant_id FROM pilot_users WHERE id=?').get(user)!.tenant_id);
   const app=await createApp({dataDir:join(source,'tenants',tenant),staticDir:resolve('dist'),mode:'local',pilotFeatures:true,logRequests:false});await app.close();
   const db=new DatabaseSync(join(source,'tenants',tenant,'validation.sqlite'));
   db.prepare('INSERT INTO quote_versions VALUES(?,?,?,?)').run(1,1,'{"snapshot":"versão preservada"}','2026-01-01');
   db.prepare('INSERT INTO quote_documents VALUES(?,?,?,?,?)').run(1,1,1,'2026-01-01','{"snapshot":"documento preservado"}');
   removePostLegacyFixtureTables(db);
   db.exec('DELETE FROM schema_migrations WHERE version>=2');db.close();
   const interest=new InterestStore(source);interest.add({name:'Pessoa sintética',email:'interest@example.test',whatsapp:''});interest.db.exec('DELETE FROM schema_migrations WHERE version>=2');interest.close();
   const support=new SupportStore(source);const ticket=support.create(user,'u@example.test',{kind:'question',subject:'Teste',body:'Mensagem preservada',requestKey:'request-support'});support.db.exec('DELETE FROM schema_migrations WHERE version>=2');support.close();
   const legal=new LegalStore(source);legal.db.prepare('INSERT INTO documents VALUES(?,?,?)').run('terms','v1','{}');legal.db.prepare('INSERT INTO acceptances VALUES(?,?,?)').run(user,'v1','2026-01-01');legal.db.exec('DELETE FROM schema_migrations WHERE version>=2');legal.close();
   store.db.exec('DELETE FROM schema_migrations WHERE version>=3');invites.close();store.close();
   cpSync(source,restored,{recursive:true});
   for(const file of ['pilot-invitations.key','pilot-interest.key'])assert.deepEqual(readFileSync(join(restored,file)),readFileSync(join(source,file)));
   store=new PilotStore(restored);bindDistribution(store,mode);invites=new Invitations(store,restored);
   assert.equal(invites.detail(invite.id).name,'Pessoa');assert.equal(store.getSession(session.value,30)!.userId,user);
   if(mode==='home-assistant')assert.ok(store.getAdmin(admin.value,['a@example.test']));
   else assert.ok((await new LocalAdmin(store).login('local@example.test','Senha sintética extensa')).value);
   const restoredApp=await createApp({dataDir:join(restored,'tenants',tenant),staticDir:resolve('dist'),mode:'local',pilotFeatures:true,logRequests:false});await restoredApp.close();
   const restoredTenant=new DatabaseSync(join(restored,'tenants',tenant,'validation.sqlite'));assert.match(String(restoredTenant.prepare('SELECT data FROM quote_documents').get()!.data),/preservado/);assert.match(String(restoredTenant.prepare('SELECT data FROM quote_versions').get()!.data),/preservada/);restoredTenant.close();
   const ri=new InterestStore(restored);assert.equal(ri.list(1).total,1);ri.close();
   const rs=new SupportStore(restored);assert.equal(rs.detail(ticket.id,user).events[0].body,'Mensagem preservada');rs.close();
   const rl=new LegalStore(restored);assert.equal(rl.db.prepare('SELECT COUNT(*) n FROM acceptances').get()!.n,1);rl.close();
   invites.close();store.close();
   for(const file of ['pilot-control.sqlite','pilot-interest.sqlite','pilot-support.sqlite','pilot-legal.sqlite','tenants/'+tenant+'/validation.sqlite']){const check=new DatabaseSync(join(restored,file));try{assert.equal(check.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');assert.deepEqual(check.prepare('PRAGMA foreign_key_check').all(),[]);}finally{check.close();}}
  }finally{rmSync(root,{recursive:true,force:true});}
 }
});

test('checkpoint: transformação com falha reverte DDL/dados e admite retentativa',async()=>{
 const {migrations}=await import('../server/foundation/migrations.js');
 const db=new DatabaseSync(':memory:');try{
  migrate(db,'legal');
  const next={version:3,name:'teste-falha',upId:'teste-v1',sql:'CREATE TABLE tentative(id INTEGER);',up:(d:DatabaseSync)=>{d.prepare('INSERT INTO documents VALUES(?,?,?)').run('x','v1','{}');throw Error('interrupção simulada');}};
  assert.throws(()=>migrate(db,'legal',[...migrations.legal,next]),/interrupção/);
  assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE name='tentative'").get(),undefined);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM documents').get()!.n,0);
  assert.equal(db.prepare('SELECT MAX(version) n FROM schema_migrations').get()!.n,2);
  migrate(db,'legal',[...migrations.legal,{...next,up:()=>{}}]);
  assert.equal(db.prepare('SELECT MAX(version) n FROM schema_migrations').get()!.n,3);
 }finally{db.close();}
});
