import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createPilotApp} from '../server/pilot/app.js';
import {PilotStore,digest} from '../server/pilot/store.js';
import {InterestStore} from '../server/pilot/interest.js';
import {Invitations} from '../server/pilot/invitations.js';
import {LocalAdmin} from '../server/pilot/local-admin.js';
import {LegalStore} from '../server/pilot/legal.js';
import type {InvitationMailer} from '../server/pilot/invitation-mail.js';
const origin='https://stabilization.example.test',prefix='/artesaos-piloto/';
async function fixture(mode:'home-assistant'|'debian'='home-assistant',mailer:InvitationMailer|null=null){
 const dir=mkdtempSync(join(tmpdir(),'artesao-stabilize-'));const config={distribution:mode,publicUrl:new URL(origin+prefix),prefix,dataDir:dir,staticDir:resolve('dist'),clientId:'fixture',clientSecret:'fixture',sessionHours:8,idleMinutes:30,maxUsers:null,adminEmails:['admin@example.test']};let app=await createPilotApp(config,undefined,mailer);const store=new PilotStore(dir),interests=new InterestStore(dir),invitations=new Invitations(store,dir);let auth;
 if(mode==='debian'){const a=new LocalAdmin(store);let code='';a.issueCode('setup',c=>{code=c;});const password='Synthetic password 123!';await a.setPassword('setup','admin@example.test',password,password,code);const s=await a.login('admin@example.test',password);auth={cookie:'__Secure-artesaos_admin_session='+s.value,'x-pilot-admin-context':a.current(s.value)!.context,'x-pilot-admin-csrf':s.csrf};}
 else{const s=store.adminSession({issuer:'https://accounts.google.com',subject:'admin',email:'admin@example.test',verified:true});auth={cookie:'__Secure-artesaos_admin_session='+s.value,'x-pilot-admin-context':store.getAdmin(s.value,config.adminEmails)!.context,'x-pilot-admin-csrf':s.csrf};}
 const req=(path:string,method='GET',body?:unknown,h=auth)=>app.inject({url:prefix+path,method:method as any,headers:{host:new URL(origin).host,origin,...h},...(body===undefined?{}:{payload:body as any})});
 const add=(email='lead@example.test',phone='11999991234')=>{interests.add({name:'Interessado sintético',email,whatsapp:phone});return interests.list(1).records.find(r=>r.email===email)!;};
 return {dir,config,store,interests,invitations,auth,req,add,restart:async()=>{await app.close();app=await createPilotApp(config,undefined,mailer);},close:async()=>{await app.close();invitations.close();interests.close();store.close();rmSync(dir,{recursive:true,force:true});}};
}
for(const mode of ['home-assistant','debian'] as const)test('Pix '+mode+': telefone BR, persistência, restart, erros, permissões e exibição',async()=>{
 const f=await fixture(mode);try{
  const key='+55 (11) 99999-1234',body={enabled:true,key,beneficiary:'Beneficiário de teste',message:'Voluntário'};
  const saved=await f.req('admin/api/contribution','PUT',body);assert.equal(saved.statusCode,200,saved.body);assert.equal(saved.json().config.key,'+5511999991234');
  await f.restart();const row=(await f.req('admin/api/resources')).json().pix;assert.equal(row.pix_key,'+5511999991234');assert.equal(row.beneficiary,body.beneficiary);assert.equal(row.message,body.message);assert.equal(row.enabled,1);
  assert.equal((await f.req('admin/api/contribution','PUT',{...body,key:'11999991234'})).statusCode,200);
  const invalid=await f.req('admin/api/contribution','PUT',{...body,key:'inválida'});assert.equal(invalid.statusCode,400);assert.match(invalid.json().message,/Pix/);assert.doesNotMatch(invalid.json().message,/versão|arquivo/);assert.equal((await f.req('admin/api/resources')).json().pix.pix_key,'+5511999991234');
  assert.equal((await f.req('admin/api/contribution','PUT',body,{...f.auth,'x-pilot-admin-csrf':'wrong'})).statusCode,403);
  assert.equal((await f.req('admin/api/contribution','PUT',body,{} as any)).statusCode,401);
  const code=f.store.invite('common@example.test'),id=f.store.activate({issuer:'https://accounts.google.com',subject:'common',email:'common@example.test',verified:true},digest(code),null),s=f.store.session(id,8),h={cookie:'__Secure-artesaos_session='+s.value,'x-pilot-context':id,'x-pilot-csrf':s.csrf};
  assert.equal((await f.req('api/help','GET',undefined,h)).json().contribution.key,'+5511999991234');assert.equal((await f.req('admin/api/contribution','PUT',body,h as any)).statusCode,401);
  await f.req('admin/api/contribution','PUT',{...body,enabled:false});assert.equal((await f.req('api/help','GET',undefined,h)).json().contribution.enabled,false);
 }finally{await f.close();}
});
test('interessados: conversão atômica, cliques concorrentes/reenvio, contatos, registro real e histórico',async()=>{
 const f=await fixture();try{
  const lead=f.add();const results=await Promise.all(Array.from({length:8},()=>f.req('admin/api/interests/'+lead.id+'/invite','POST',{})));assert.ok(results.every(r=>r.statusCode===200));const ids=new Set(results.map(r=>r.json().invitationId));assert.equal(ids.size,1);const invitationId=String([...ids][0]);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM pilot_invitation_details').get()!.n,1);const link=f.store.db.prepare('SELECT * FROM pilot_interest_invitation_links').get()!;assert.equal(link.interest_id,lead.id);assert.equal(link.registered_at,lead.createdAt);assert.equal(link.actor,'admin@example.test');
  const d=(await f.req('admin/api/invitations/'+invitationId)).json();assert.equal(d.name,lead.name);assert.equal(d.email,lead.email);assert.equal(d.phone,'5511999991234');assert.match(d.messageText,new RegExp(d.code));assert.equal(d.deliveries.length,0);
  const user=f.store.activate({issuer:'https://accounts.google.com',subject:'different-google',email:'different-google@example.test',verified:true},digest(d.code),null);const state=(await f.req('admin/api/interests')).json().records[0].invitation;assert.equal(state.state,'registered');assert.equal(state.userId,user);assert.ok(state.acceptedAt);assert.ok(state.accountCreatedAt);
  assert.equal((await f.req('admin/api/interests/'+lead.id+'/invite','POST',{})).json().generated,false);assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM pilot_invites').get()!.n,1);
  await f.restart();assert.equal((await f.req('admin/api/interests')).json().records[0].invitation.state,'registered');assert.throws(()=>f.store.db.exec('DELETE FROM pilot_interest_invitation_links'),/imutável/);
 }finally{await f.close();}
});
test('interessados: convite existente, conta existente, revogação/reativação e autorização',async()=>{
 const f=await fixture();try{
  const lead=f.add(),existing=f.invitations.issue(lead.name,lead.email,'admin@example.test',randomUUID(),null,'email','5511999991234');
  assert.equal((await f.req('admin/api/interests')).json().records[0].invitation.eligible,false);assert.equal((await f.req('admin/api/interests/'+lead.id+'/invite','POST',{})).json().invitationId,existing.id);
  f.invitations.revoke(existing.id);const count=Number(f.store.db.prepare('SELECT COUNT(*) n FROM pilot_invites').get()!.n);assert.equal((await f.req('admin/api/interests/'+lead.id+'/invite','POST',{})).json().state,'revoked');assert.equal(f.store.db.prepare('SELECT COUNT(*) n FROM pilot_invites').get()!.n,count);
  const replacement=f.invitations.reactivate(existing.id,lead.name,lead.email,'admin@example.test',randomUUID(),null,'email','5511999991234');assert.equal((await f.req('admin/api/interests')).json().records[0].invitation.invitationId,replacement.id);
  const other=f.add('existing@example.test',''),code=f.store.invite(other.email);f.store.activate({issuer:'https://accounts.google.com',subject:'existing',email:other.email,verified:true},digest(code),null);assert.equal((await f.req('admin/api/interests/'+other.id+'/invite','POST',{})).json().state,'registered');
  const manual=f.add('manual-new@example.test','');const original=f.invitations.issue(manual.name,manual.email,'admin@example.test',randomUUID(),null);await f.req('admin/api/interests/'+manual.id+'/invite','POST',{});f.invitations.revoke(original.id);const independent=f.invitations.issue(manual.name,manual.email,'admin@example.test',randomUUID(),null);assert.equal((await f.req('admin/api/interests/'+manual.id+'/invite','POST',{})).json().invitationId,independent.id);
  assert.equal((await f.req('admin/api/interests/'+lead.id+'/invite','POST',{},{} as any)).statusCode,401);assert.equal((await f.req('admin/api/interests/'+lead.id+'/invite','POST',{},{...f.auth,'x-pilot-admin-csrf':'wrong'})).statusCode,403);assert.equal((await f.req('admin/api/interests/'+randomUUID()+'/invite','POST',{})).statusCode,404);
 }finally{await f.close();}
});
test('compartilhamento não é entrega; SMTP reutilizado com confirmação real do serviço e falha preserva convite',async()=>{
 let calls=0,fail=false;const f=await fixture('home-assistant',{async send(){calls++;if(fail)throw Error('synthetic failure');}});try{
  const lead=f.add(),converted=(await f.req('admin/api/interests/'+lead.id+'/invite','POST',{})).json(),id=converted.invitationId;
  assert.equal(calls,0);const shareKey=randomUUID();for(let i=0;i<2;i++)assert.equal((await f.req('admin/api/invitations/'+id+'/share','POST',{event:'open_whatsapp',requestKey:shareKey})).statusCode,200);let d=(await f.req('admin/api/invitations/'+id)).json();assert.equal(d.shareEvents.length,1);assert.equal(d.deliveries.length,0);
  const requestKey=randomUUID();for(let i=0;i<2;i++)assert.equal((await f.req('admin/api/invitations/'+id+'/send','POST',{requestKey})).statusCode,200);assert.equal(calls,1);d=(await f.req('admin/api/invitations/'+id)).json();assert.equal(d.deliveries[0].status,'smtp_accepted');
  const next=f.add('failure@example.test',''),nextId=(await f.req('admin/api/interests/'+next.id+'/invite','POST',{})).json().invitationId;fail=true;assert.equal((await f.req('admin/api/invitations/'+nextId+'/send','POST',{requestKey:randomUUID()})).statusCode,502);assert.equal((await f.req('admin/api/invitations/'+nextId)).json().status,'pending');
 }finally{await f.close();}
});
test('sem SMTP: mensagem pronta sem envio presumido; migração preserva dados e metadados internos do rodapé',async()=>{
 const f=await fixture();try{const lead=f.add(),id=(await f.req('admin/api/interests/'+lead.id+'/invite','POST',{})).json().invitationId;assert.equal((await f.req('admin/api/invitations/'+id+'/send','POST',{requestKey:randomUUID()})).statusCode,503);const page=await f.req('admin/resources');assert.doesNotMatch(page.body,/Base: Fabricação e Orçamentos/);assert.match(page.body,/pilot-current-version/);assert.ok(page.body.indexOf('Termos e privacidade')<page.body.indexOf('pilot-current-version'));assert.ok(f.store.db.prepare('PRAGMA integrity_check').get()!.integrity_check==='ok');assert.deepEqual(f.store.db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{await f.close();}
});
test('atualização control3→4 e backup frio preservam usuários/convites sem datas retroativas presumidas',async()=>{
 const {migrate,migrations}=await import('../server/foundation/migrations.js');const dir=mkdtempSync(join(tmpdir(),'control3-4-')),restore=mkdtempSync(join(tmpdir(),'control4-restore-'));let store:PilotStore|undefined;
 try{const db=new DatabaseSync(join(dir,'pilot-control.sqlite'));migrate(db,'control',migrations.control.slice(0,-1));const id=randomUUID();db.prepare('INSERT INTO pilot_users(id,issuer,subject,email,tenant_id) VALUES(?,?,?,?,?)').run(id,'https://accounts.google.com','old','old@example.test',randomUUID());db.prepare('INSERT INTO pilot_invites(hash,email,expires_at) VALUES(?,?,?)').run(digest('old-code'),'old@example.test',Date.now()+86400000);db.close();store=new PilotStore(dir);assert.equal(store.db.prepare('SELECT COUNT(*) n FROM pilot_users').get()!.n,1);assert.equal(store.db.prepare('SELECT COUNT(*) n FROM pilot_invites').get()!.n,1);assert.equal(store.db.prepare('SELECT COUNT(*) n FROM pilot_account_registrations').get()!.n,0);const interest=new InterestStore(dir);interest.add({name:'Pessoa',email:'new@example.test',whatsapp:''});const invites=new Invitations(store,dir);const {InterestInvitations}=await import('../server/pilot/interest-invitations.js');const lead=interest.list(1).records[0],result=new InterestInvitations(interest,store,invites).convert(lead.id,'admin@example.test',null);assert.ok(result.invitationId);invites.close();interest.close();store.close();store=undefined;cpSync(dir,restore,{recursive:true});store=new PilotStore(restore);assert.equal(store.db.prepare('SELECT COUNT(*) n FROM pilot_interest_invitation_links').get()!.n,1);assert.equal(store.db.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');assert.deepEqual(store.db.prepare('PRAGMA foreign_key_check').all(),[]);
 }finally{store?.close();rmSync(dir,{recursive:true,force:true});rmSync(restore,{recursive:true,force:true});}
});
