import {PDFDocument} from 'pdf-lib';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {LegalStore} from '../server/pilot/legal.js';
import {createApp} from '../server/app.js';
import {createPilotApp} from '../server/pilot/app.js';
import {PilotStore,digest} from '../server/pilot/store.js';
import {migrate,migrations} from '../server/foundation/migrations.js';
const temp=()=>mkdtempSync(join(tmpdir(),'artesao-evolution-'));
const doc=(version:string,requiresAcceptance=true)=>({version,content:'Texto beta '+version,requiresAcceptance});
test('documentos: novos/existentes, renovação, dispensa, imutabilidade, recusa, metadado manual e reinício',()=>{
 const dir=temp();let l=new LegalStore(dir);try{
  assert.equal(l.status('existing').required,true);assert.equal(l.status('new').required,true);
  let s=l.status('existing');assert.equal(l.accept('existing',s.version,s.termsHash,true,'tenant-a','session-a'),true);
  const unchanged=l.create('terms',doc('2',false),'admin');l.publish(unchanged,'admin');assert.equal(l.status('existing').required,false);assert.equal(l.status('new').required,true);
  const mandatory=l.create('terms',doc('3'),'admin');l.publish(mandatory,'admin');assert.equal(l.status('existing').required,true);
  assert.throws(()=>l.db.prepare('UPDATE resource_versions SET content=? WHERE id=?').run('forged',mandatory),/imutável/);
  l.event('existing','tenant-a',mandatory,'refuse','session-a');assert.equal(l.status('existing').required,true);
  const pdf=Buffer.from('%PDF-1.4\n1 0 obj <<>> endobj\n%%EOF');const manual=l.create('manual',{version:'manual-1',pdf:pdf.toString('base64'),requiresAcceptance:false},'admin');l.publish(manual,'admin');assert.throws(()=>l.event('existing','tenant-a',manual,'acknowledge','session-a'));
  s=l.status('existing');l.accept('existing',s.version,s.termsHash,true,'tenant-a','session-b');assert.equal(l.audit('existing')[0].manual_id,manual);assert.equal(l.audit('existing').length,3);
  assert.throws(()=>l.db.prepare('DELETE FROM resource_events').run(),/imutável/);l.close();l=new LegalStore(dir);assert.equal(l.status('existing').required,false);assert.equal(l.list().filter((x:any)=>x.kind==='terms').length,3);
 }finally{l.close();rmSync(dir,{recursive:true,force:true});}
});
test('Pix e manual: ativação dinâmica, validação, histórico, desligamento e persistência',()=>{
 const dir=temp();let l=new LegalStore(dir);try{
  assert.deepEqual(l.contribution(),{enabled:false});assert.throws(()=>l.configurePix({enabled:true,key:'',beneficiary:'',message:''}));
  l.configurePix({enabled:true,key:'example@example.test',beneficiary:'Tudoe3d',message:'Voluntário'});assert.equal(l.contribution().enabled,true);
  assert.throws(()=>l.create('manual',{version:'invalid',pdf:Buffer.from('not PDF').toString('base64'),requiresAcceptance:false},'admin'));
  for(const v of ['1','2']){const id=l.create('manual',{version:v,pdf:Buffer.from('%PDF-1.4\n%%EOF').toString('base64'),requiresAcceptance:false},'admin');l.publish(id,'admin');}
  assert.equal(l.active('manual').version,'2');assert.equal(l.list().filter((x:any)=>x.kind==='manual').length,2);
  l.close();l=new LegalStore(dir);assert.equal(l.contribution().beneficiary,'Tudoe3d');l.configurePix({enabled:false,key:'',beneficiary:'',message:''});assert.equal(l.contribution().enabled,false);
 }finally{l.close();rmSync(dir,{recursive:true,force:true});}
});
test('APIs protegidas: sessão aberta bloqueada após publicação; permissões, CSRF, cookies necessários e auditoria',async()=>{
 const dir=temp(),prefix='/artesaos-piloto/',origin='https://evolution.example.test';
 const c=new PilotStore(dir);const invite=c.invite('user@example.test'),user=c.activate({issuer:'https://accounts.google.com',subject:'one',email:'user@example.test',verified:true},digest(invite),10),session=c.session(user,8);const admin=c.adminSession({issuer:'https://accounts.google.com',subject:'admin',email:'admin@example.test',verified:true});
 const cfg={dataDir:dir,staticDir:resolve('dist'),prefix,publicUrl:new URL(origin+prefix),clientId:'test',clientSecret:'test',sessionHours:8,idleMinutes:30,maxUsers:10,adminEmails:['admin@example.test']};const app=await createPilotApp(cfg);const uh={cookie:'__Secure-artesaos_session='+session.value,'x-pilot-context':user,'x-pilot-csrf':session.csrf};const a=c.getAdmin(admin.value,cfg.adminEmails)!;const ah={cookie:'__Secure-artesaos_admin_session='+admin.value,'x-pilot-admin-context':a.context,'x-pilot-admin-csrf':admin.csrf};
 const req=(path:string,h=uh,method='GET',payload?:any)=>app.inject({url:prefix+path,method:method as any,headers:{host:new URL(origin).host,origin,...h},...(payload===undefined?{}:{payload})});
 try{
  assert.equal((await req('api/company')).statusCode,428);assert.equal((await req('api/support')).statusCode,428);
  assert.equal((await req('admin/api/resources',uh)).statusCode,401);assert.equal((await req('admin/api/resources',ah,'POST',{kind:'terms',...doc('x')})).statusCode,200);
  const id=(await req('admin/api/resources',ah)).json().versions.find((x:any)=>x.version==='x').id;
  let s=(await req('api/legal/status')).json();await req('api/legal/accept',uh,'POST',{version:s.version,termsHash:s.termsHash,accepted:true});assert.equal((await req('api/company')).statusCode,200);
  assert.equal((await req('admin/api/resources/'+id+'/publish',{...ah,'x-pilot-admin-csrf':'wrong'},'POST',{})).statusCode,403);
  assert.equal((await req('admin/api/resources/'+id+'/publish',ah,'POST',{})).statusCode,200);assert.equal((await req('api/company')).statusCode,428);
  s=(await req('api/legal/status')).json();assert.equal(s.optionalCookies,false);await req('api/legal/events',uh,'POST',{documentId:s.documentId,action:'refuse'});assert.equal((await req('api/company')).statusCode,428);
  await req('api/legal/accept',uh,'POST',{version:s.version,termsHash:s.termsHash,accepted:true});assert.equal((await req('api/company')).statusCode,200);
  assert.equal((await req('admin/api/legal-audit',ah)).json().length,3);assert.equal((await req('api/help')).json().manual,null);
  assert.equal((await req('admin/api/resources',ah,'POST',{kind:'manual',version:'bad',pdf:Buffer.from('%PDF-1.4\n%%EOF').toString('base64'),requiresAcceptance:false})).statusCode,400);
  const pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());const manual=(await req('admin/api/resources',ah,'POST',{kind:'manual',version:'valid',pdf:bytes.toString('base64'),requiresAcceptance:false})).json();
  assert.equal((await req('api/manuals/'+manual.id)).statusCode,404);await req('admin/api/resources/'+manual.id+'/publish',ah,'POST',{});assert.deepEqual((await req('api/manuals/'+manual.id)).rawPayload,bytes);assert.equal((await req('api/manuals/'+manual.id,{} as any)).statusCode,401);

 }finally{await app.close();c.close();rmSync(dir,{recursive:true,force:true});}
});
test('migração preserva cliente antigo sem inventar tipo/origem; contador, reenvio, concorrência e novos contatos reais',async()=>{
 const dir=temp(),path=join(dir,'validation.sqlite');const old=new DatabaseSync(path);migrate(old,'tenant',migrations.tenant.slice(0,-1));const data={name:'Antigo',contact:'',phone:'',email:'',taxDocument:'',postal:''};old.prepare('INSERT INTO clients(data,updated_at) VALUES(?,?)').run(JSON.stringify(data),'2020-01-01');old.close();
 let app=await createApp({dataDir:dir,staticDir:resolve('dist'),mode:'local',pilotFeatures:true,logRequests:false});
 const onboarding=new DatabaseSync(path);onboarding.prepare('INSERT INTO pilot_onboarding VALUES(1,?)').run(new Date().toISOString());onboarding.close();
 const req=(url:string,method='GET',payload?:any)=>app.inject({url:'/api/'+url,method:method as any,...(payload===undefined?{}:{payload})});
 try{
  const oldClient=(await req('clients')).json()[0];assert.equal(oldClient.commercialType,'undefined');assert.equal(oldClient.registrationOrigin,'undefined');assert.equal(oldClient.createdAt,null);
  const place=(await req('sales-places','POST',{requestKey:randomUUID(),name:'Evento',address:'',notes:'',active:true})).json();
  const session=(await req('sales-sessions','POST',{requestKey:randomUUID(),placeId:place.id,dateOn:'2026-11-01',tier:'retail',stockControl:false})).json();const id=session.id;
  assert.equal((await req('sales-sessions/'+id+'/engagement')).json().total,0);
  const key=randomUUID();for(let i=0;i<2;i++)assert.equal((await req('sales-sessions/'+id+'/visitors','POST',{delta:1,requestKey:key})).json().total,1);
  await Promise.all(Array.from({length:20},()=>req('sales-sessions/'+id+'/visitors','POST',{delta:1,requestKey:randomUUID()})));assert.equal((await req('sales-sessions/'+id+'/engagement')).json().total,21);
  await req('sales-sessions/'+id+'/visitor-preference','PUT',{expanded:true});
  for(let i=0;i<5;i++)assert.equal((await req('clients','POST',{...data,name:'Novo '+i,commercialType:'retail',registrationOrigin:'sale',captureSessionId:id})).statusCode,200);
  await req('clients','POST',{...data,name:'Orçamento',commercialType:'wholesale',registrationOrigin:'quote'});await req('clients','POST',{...data,name:'Direto',commercialType:'retail',registrationOrigin:'direct'});
  const client=(await req('clients')).json().find((c:any)=>c.name==='Novo 0');await req('clients/'+client.id,'PUT',{...data,commercialType:'wholesale',registrationOrigin:'direct'});
  const saved=(await req('clients')).json().find((c:any)=>c.id===client.id);assert.equal(saved.registrationOrigin,'sale');assert.equal(saved.captureSessionId,id);assert.equal(saved.commercialType,'wholesale');
  await app.close();app=await createApp({dataDir:dir,staticDir:resolve('dist'),mode:'local',pilotFeatures:true,logRequests:false});const e=(await req('sales-sessions/'+id+'/engagement')).json();assert.equal(e.newContacts,5);assert.equal(e.expanded,true);assert.equal(e.total,21);
  for(let i=0;i<21;i++)await req('sales-sessions/'+id+'/visitors','POST',{delta:-1,requestKey:randomUUID()});assert.equal((await req('sales-sessions/'+id+'/visitors','POST',{delta:-1,requestKey:randomUUID()})).statusCode,400);assert.equal((await req('sales-sessions/'+id+'/engagement')).json().conversion,null);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
