import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync,unlinkSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createPilotApp} from '../server/pilot/app.js';
import {PilotStore,digest} from '../server/pilot/store.js';
import {Invitations} from '../server/pilot/invitations.js';
import {pilotConfig,type PilotConfig} from '../server/pilot/config.js';
import {invitationText,type InvitationMailer,type InvitationMail} from '../server/pilot/invitation-mail.js';
const origin='https://invitations.example.test',prefix='/artesaos-piloto/';
async function fixture(mailer:InvitationMailer|null=null){
 const dir=mkdtempSync(join(tmpdir(),'pilot-invitations-'));const config:PilotConfig={publicUrl:new URL(origin+prefix),prefix,dataDir:dir,staticDir:resolve('dist'),clientId:'fixture',clientSecret:'fixture',sessionHours:8,idleMinutes:30,maxUsers:5,adminEmails:['admin@example.test']};
 const store=new PilotStore(dir),session=store.adminSession({issuer:'https://accounts.google.com',subject:'admin',email:'admin@example.test',verified:true}),admin=store.getAdmin(session.value,config.adminEmails!)!;
 const headers={cookie:'__Secure-artesaos_admin_session='+session.value,'x-pilot-admin-context':admin.context,'x-pilot-admin-csrf':session.csrf};let app=await createPilotApp(config,undefined,mailer);
 const request=(path='',method='GET',payload?:unknown,h:Record<string,string>=headers)=>app.inject({url:prefix+'admin/api/invitations'+path,method:method as any,headers:{host:new URL(origin).host,origin,...h},...(payload===undefined?{}:{payload:payload as any})});
 return {dir,store,headers,request,userDetails:(id:string)=>app.inject({url:prefix+'admin/api/users/'+id,headers:{host:new URL(origin).host,...headers}}),create:async(email='person@example.test',extra:Record<string,unknown>={})=>request('','POST',{name:'Pessoa de teste',email,requestKey:randomUUID(),...extra}),restart:async()=>{await app.close();app=await createPilotApp(config,undefined,mailer);},close:async()=>{await app.close();store.close();rmSync(dir,{recursive:true,force:true});}};
}
test('Salvar gera código cifrado, idempotente, sem status de envio; primeiro Google aceita e some dos convites',async()=>{
 const f=await fixture();try{
  const input={name:'Pessoa',email:' Contact@Example.Test ',requestKey:randomUUID()};const made=await f.request('','POST',input);assert.equal(made.statusCode,200,made.body);const item=made.json();assert.equal(item.email,'contact@example.test');assert.equal(item.bindingMode,'first_google');assert.equal(item.status,'pending');assert.ok(item.code.length>=32);assert.equal('sentAt' in item,false);assert.equal('lastDelivery' in item,false);
  assert.equal((await f.request('','POST',input)).json().id,item.id);assert.equal((await f.request('','POST',{...input,name:'Outra pessoa'})).statusCode,409);
  assert.equal((await f.request()).json().records[0].code,undefined);const stored=f.store.db.prepare('SELECT * FROM pilot_invitation_details').get()!;assert.ok(!Buffer.from(stored.payload as Uint8Array).includes(Buffer.from(item.code)));assert.ok(!JSON.stringify(stored).includes('Pessoa'));assert.equal(statSync(join(f.dir,'pilot-invitations.key')).mode&0o777,0o600);
  assert.equal((await f.request('/'+item.id+'/manual-sent','POST',{confirmed:true,requestKey:randomUUID()})).statusCode,404,'Não existe confirmação manual de envio');
  assert.throws(()=>f.store.activate({issuer:'https://accounts.google.com',subject:'unverified',email:'google@example.test',verified:false},digest(item.code),5));
  const id=f.store.activate({issuer:'https://accounts.google.com',subject:'person',email:'google@example.test',verified:true},digest(item.code),5);
  assert.equal((await f.request()).json().total,0);const accepted=(await f.request('/'+item.id)).json();assert.equal(accepted.status,'accepted');assert.equal(accepted.acceptedGoogleEmail,'google@example.test');assert.equal((await f.request('?status=accepted')).json().total,1);assert.equal(f.store.listUsers().records[0].id,id);const profile=(await f.userDetails(id)).json();assert.equal(profile.invitation.name,'Pessoa');assert.equal(profile.invitation.email,'contact@example.test');assert.equal(profile.email,'google@example.test');assert.equal('code' in profile.invitation,false);
  assert.throws(()=>f.store.activate({issuer:'https://accounts.google.com',subject:'second',email:'other@example.test',verified:true},digest(item.code),5));
  await f.restart();assert.equal((await f.request('/'+item.id)).json().code,item.code);assert.equal((await f.request()).json().total,0);
 }finally{await f.close();}
});
test('permissões, validação, vagas e convites anteriores continuam protegidos sem inventar dados',async()=>{
 const f=await fixture();try{
  const body={name:'Teste',email:'person@example.test',requestKey:randomUUID()};
  assert.equal((await f.request('','GET',undefined,{})).statusCode,401);assert.equal((await f.request('','POST',body,{...f.headers,'x-pilot-admin-csrf':'wrong'})).statusCode,403);assert.equal((await f.request('','POST',body,{...f.headers,origin:'https://evil.example'})).statusCode,403);assert.equal((await f.request('','GET',undefined,{...f.headers,'x-pilot-admin-context':'old'})).statusCode,409);
  for(const input of [{name:' '},{email:'bad'},{email:'a@example.test\r\nBcc: leaked@example.test'},{channel:'whatsapp',phone:'invalid'},{channel:'whatsapp',phone:'+1'}])assert.equal((await f.create('person@example.test',input)).statusCode,400);
  const legacy=f.store.invite('legacy@example.test');const detail=(await f.request('/'+digest(legacy))).json();assert.equal(detail.legacy,true);assert.equal(detail.name,null);assert.equal(detail.code,null);assert.equal(detail.createdAt,null);assert.equal(detail.bindingMode,'email');assert.throws(()=>f.store.activate({issuer:'https://accounts.google.com',subject:'legacy-wrong',email:'other@example.test',verified:true},digest(legacy),5));
  f.store.db.prepare('UPDATE pilot_invites SET expires_at=? WHERE hash=?').run(Date.now()-1,digest(legacy));assert.equal((await f.request('?status=expired')).json().total,1);
  for(let i=0;i<5;i++)assert.equal((await f.create('person'+i+'@example.test')).statusCode,200);
  assert.equal((await f.create('extra@example.test')).statusCode,409);assert.equal((await f.create('person0@example.test')).statusCode,409);
  f.store.revoke('person0@example.test');assert.equal((await f.request('?status=revoked')).json().total,1);assert.equal((await f.create('replacement@example.test')).statusCode,200);
  assert.equal((await f.request('?status=invalid')).statusCode,400);assert.equal((await f.request('?page=-1')).statusCode,400);
 }finally{await f.close();}
});
test('SMTP é opcional, não duplica o mesmo envio e falhas mantêm o registro sem estado de envio na lista',async()=>{
 const sent:InvitationMail[]=[];let fail=false;const f=await fixture({async send(mail){sent.push(mail);if(fail)throw Error('private-provider-secret');}});
 try{
  const made=(await f.create()).json(),payload={requestKey:randomUUID()};const response=await f.request('/'+made.id+'/send','POST',payload);assert.equal(response.statusCode,200,response.body);assert.equal(response.json().status,'pending');assert.equal('lastDelivery' in response.json(),false);assert.equal(sent[0].to,'person@example.test');assert.equal(sent[0].code,made.code);assert.equal(sent[0].loginUrl,origin+prefix+'login');
  assert.equal((await f.request('/'+made.id+'/send','POST',payload)).statusCode,200);assert.equal(sent.length,1);assert.equal((await f.request('/'+made.id+'/send','POST',{requestKey:randomUUID()})).statusCode,429);
  fail=true;const next=(await f.create('another@example.test')).json();const failed=await f.request('/'+next.id+'/send','POST',{requestKey:randomUUID()});assert.equal(failed.statusCode,502);assert.ok(!failed.body.includes('private-provider-secret'));assert.equal((await f.request()).json().total,2);
  assert.ok(!invitationText(sent[0]).includes('?code='));assert.match(invitationText(sent[0]),/primeira conta Google/);
 }finally{await f.close();}
});
test('WhatsApp sem e-mail, código automático, telefone cifrado e diferentes contatos reservam vagas independentes',async()=>{
 const f=await fixture();try{
  const made=await f.create('',{channel:'whatsapp',phone:'+55 (11) 99999-0000'});assert.equal(made.statusCode,200,made.body);const item=made.json();assert.equal(item.phone,'5511999990000');assert.equal(item.email,'');assert.equal(item.channel,'whatsapp');assert.equal(item.bindingMode,'first_google');
  const row=f.store.db.prepare('SELECT payload FROM pilot_invitation_details WHERE hash=?').get(item.id)!;assert.ok(!Buffer.from(row.payload as Uint8Array).includes(Buffer.from(item.phone)));
  assert.equal((await f.request('/'+item.id+'/send','POST',{requestKey:randomUUID()})).statusCode,503);
  assert.equal((await f.create('',{channel:'whatsapp',phone:item.phone})).statusCode,409);
  for(let i=1;i<5;i++)assert.equal((await f.create('',{channel:'whatsapp',phone:'551199999000'+i})).statusCode,200);
  assert.equal((await f.create('',{channel:'whatsapp',phone:'5511999990009'})).statusCode,409);
  f.store.activate({issuer:'https://accounts.google.com',subject:'phone-google',email:'different-google@example.test',verified:true},digest(item.code),5);assert.equal((await f.request()).json().total,4);assert.equal((await f.request('/'+item.id)).json().acceptedGoogleEmail,'different-google@example.test');
 }finally{await f.close();}
});
test('SMTP requer TLS e configuração completa; chaves e tentativas interrompidas preservam recuperação segura',()=>{
 const env={PILOT_PUBLIC_URL:origin+prefix,GOOGLE_CLIENT_ID:'test',GOOGLE_CLIENT_SECRET:'test'};assert.equal(pilotConfig(env).smtp,undefined);assert.throws(()=>pilotConfig({...env,PILOT_SMTP_HOST:'smtp.example.test'}));assert.throws(()=>pilotConfig({...env,PILOT_SMTP_HOST:'smtp.example.test',PILOT_SMTP_PORT:'25',PILOT_SMTP_USER:'test',PILOT_SMTP_PASSWORD:'test',PILOT_SMTP_FROM:'sender@example.test'}));assert.equal(pilotConfig({...env,PILOT_SMTP_HOST:'smtp.example.test',PILOT_SMTP_PORT:'587',PILOT_SMTP_USER:'test',PILOT_SMTP_PASSWORD:'test',PILOT_SMTP_FROM:'sender@example.test'}).smtp!.port,587);
 const dir=mkdtempSync(join(tmpdir(),'invite-key-')),store=new PilotStore(dir);let invites=new Invitations(store,dir);
 try{const record=invites.issue('Teste','test@example.test','admin@example.test',randomUUID(),5);const attempt=invites.beginDelivery(record.id,'admin@example.test',randomUUID());invites.close();invites=new Invitations(store,dir);assert.equal(store.db.prepare('SELECT status FROM pilot_invitation_deliveries WHERE id=?').get(attempt.id)!.status,'unconfirmed');assert.equal('lastDelivery' in invites.detail(record.id),false);invites.close();const path=join(dir,'pilot-invitations.key'),key=readFileSync(path);unlinkSync(path);assert.throws(()=>new Invitations(store,dir),/Chave/);writeFileSync(path,Buffer.alloc(32,1));assert.throws(()=>new Invitations(store,dir));writeFileSync(path,key);invites=new Invitations(store,dir);assert.equal(invites.detail(record.id).code,record.code);
 }finally{invites.close();store.close();rmSync(dir,{recursive:true,force:true});}
});
test('adaptador SMTP usa TLS obrigatório, remetente configurado e mensagem com código sem acessar arquivos/URLs',async t=>{
 const nodemailer=(await import('nodemailer')).default;const {smtpInvitationMailer}=await import('../server/pilot/invitation-mail.js');
 const options:any[]=[],messages:any[]=[];let accept=true,closed=0;
 const fakeTransport=(value:any)=>{
  options.push(value);
  return {async sendMail(mail:any){messages.push(mail);return {accepted:accept?['contact@example.test']:[]};},close(){closed++;}};
 };
 t.mock.method(nodemailer,'createTransport',fakeTransport as any);
 const config:PilotConfig={publicUrl:new URL(origin+prefix),prefix,dataDir:'/tmp/disposable',staticDir:resolve('dist'),clientId:'fixture',clientSecret:'fixture',sessionHours:8,idleMinutes:30,maxUsers:5,smtp:{host:'smtp.example.test',port:587,user:'fixture-user',password:'fixture-password',from:'sender@example.test'}};
 const mailer=smtpInvitationMailer(config)!;await mailer.send({to:'contact@example.test',name:'Pessoa',code:'synthetic-code',expiresAt:Date.now()+86400000,loginUrl:origin+prefix+'login'});
 assert.equal(options[0].secure,false);assert.equal(options[0].requireTLS,true);assert.equal(options[0].logger,false);assert.equal(options[0].debug,false);assert.equal(messages[0].from.address,'sender@example.test');assert.equal(messages[0].disableFileAccess,true);assert.equal(messages[0].disableUrlAccess,true);assert.match(messages[0].text,/synthetic-code/);assert.match(messages[0].text,/primeira conta Google/);
 const tls=smtpInvitationMailer({...config,smtp:{...config.smtp!,port:465}})!;assert.equal(options[1].secure,true);accept=false;await assert.rejects(()=>tls.send({to:'contact@example.test',name:'Pessoa',code:'synthetic-code',expiresAt:Date.now(),loginUrl:origin+prefix+'login'}));mailer.close?.();tls.close?.();assert.equal(closed,2);
});
