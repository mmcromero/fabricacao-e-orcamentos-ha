import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {PNG} from 'pngjs';
import {PDFDocument} from 'pdf-lib';
import {createPilotApp} from '../server/pilot/app.js';
import {PilotStore,digest} from '../server/pilot/store.js';
import {LegalStore} from '../server/pilot/legal.js';
import type {PilotConfig} from '../server/pilot/config.js';
const origin='https://documents.example.test',prefix='/artesaos-piloto/';
const company={name:'Ateliê São João',responsible:'Pessoa responsável',phone:'11999990000',email:'atelie@example.test'};
const client={id:1,name:'Cliente fictício',contact:'',phone:'',email:'',taxDocument:'',postal:''};
const item={id:1,name:'Peça em aço — seleção',productId:null,origin:'own',prices:{wholesale:777,factory:888,retail:1234},priceKey:'retail',quantity:'3',lengthCm:null,widthCm:null,heightCm:null,weightGrams:null,packaging:'with',packagingType:'Caixa',packagingAmount:'2,50',packagingIncluded:false};
const quote={title:'Pedido',status:'finalized',client,items:[item],notes:'Pagamento: manual. Validade: 10 dias. Prazo: a combinar.',delivery:{mode:'carrier',carrier:'Entrega manual',amount:'12,34',notes:''}};
const png=()=>PNG.sync.write({width:2,height:1,data:Buffer.from([255,0,0,255,0,0,0,0])} as PNG);
async function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'pilot-documents-'));
 const config:PilotConfig={publicUrl:new URL(origin+prefix),prefix,dataDir:dir,staticDir:resolve('dist'),clientId:'fixture',clientSecret:'fixture',sessionHours:8,idleMinutes:30,maxUsers:5,adminEmails:[]};
 const control=new PilotStore(dir);
 function account(name:string){const invite=control.invite(name+'@example.test');const id=control.activate({issuer:'https://accounts.google.com',subject:name,email:name+'@example.test',verified:true},digest(invite),5);const s=control.session(id,8);return {id,headers:{cookie:'__Secure-artesaos_session='+s.value,'x-pilot-context':id,'x-pilot-csrf':s.csrf}};}
 const a=account('a'),b=account('b');let app=await createPilotApp(config);
 const request=(path:string,who=a,method='GET',payload?:unknown)=>app.inject({method:method as any,url:prefix+path,headers:{host:new URL(origin).host,origin,...who.headers},...(payload===undefined?{}:{payload:payload as any})});
 async function ready(who:typeof a){const ls=(await request('api/legal/status',who)).json();await request('api/legal/accept',who,'POST',{version:ls.version,termsHash:ls.termsHash,accepted:true});await request('api/company',who,'PUT',{data:company,expectedRevision:0});const tenant=String(control.db.prepare('SELECT tenant_id FROM pilot_users WHERE id=?').get(who.id)!.tenant_id);const db=new DatabaseSync(join(dir,'tenants',tenant,'validation.sqlite'));db.prepare('INSERT INTO pilot_onboarding VALUES(1,?)').run(new Date().toISOString());db.close();return join(dir,'tenants',tenant,'validation.sqlite');}
 return {dir,config,control,a,b,request,ready,restart:async()=>{await app.close();app=await createPilotApp(config);},close:async()=>{await app.close();control.close();rmSync(dir,{recursive:true,force:true});}};
}
test('logo única: valida PNG, transparência, concorrência, remoção, reinício e proteção entre contas',async()=>{
 const f=await fixture();try{const path=await f.ready(f.a);await f.ready(f.b);
  const input={expectedRevision:0,png:png().toString('base64')};
  assert.equal((await f.request('api/company/logo',f.a,'PUT',input)).statusCode,200);
  assert.equal((await f.request('api/company/logo',f.a,'PUT',input)).statusCode,409);
  assert.equal((await f.request('api/company/logo',f.b)).statusCode,404);
  const image=await f.request('api/company/logo');assert.equal(PNG.sync.read(image.rawPayload).data[7],0);
  assert.equal((await f.request('api/company/logo',{...f.a,headers:{...f.a.headers,'x-pilot-csrf':'wrong'}},'DELETE',{expectedRevision:1})).statusCode,403);
  const oversized=Buffer.from(png());oversized.writeUInt32BE(99999,16);
  const original=png(),duplicate=Buffer.concat([original.subarray(0,33),original.subarray(8)]),interlaced=Buffer.from(original);interlaced[28]=1;
  for(const data of ['invalid',oversized.toString('base64'),duplicate.toString('base64'),interlaced.toString('base64')])assert.equal((await f.request('api/company/logo',f.a,'PUT',{expectedRevision:1,png:data})).statusCode,400);
  await f.restart();assert.equal((await f.request('api/company/logo/meta')).json().revision,1);
  assert.equal((await f.request('api/company/logo',f.a,'DELETE',{expectedRevision:1})).statusCode,200);
  const db=new DatabaseSync(path);assert.equal(db.prepare('SELECT COUNT(*) n FROM company_logo').get()!.n,1);assert.equal(db.prepare('SELECT image FROM company_logo').get()!.image,null);db.close();
  assert.equal((await f.request('api/company/logo')).statusCode,404);
 }finally{await f.close();}
});
test('PDF: valores e empresa imutáveis por edição, logo atual, histórico, isolamento e geração sem arquivo',async()=>{
 const f=await fixture();try{const path=await f.ready(f.a);await f.ready(f.b);
  const made=await f.request('api/quotes',f.a,'POST',{data:quote,expectedRevision:0});assert.equal(made.statusCode,200,made.body);const id=made.json().id;
  assert.equal((await f.request(`api/quotes/${id}/document`,f.b)).statusCode,404);
  assert.equal((await f.request(`api/quotes/${id}/documents`)).json().length,1);
  const pdf=await f.request(`api/quotes/${id}/document`);assert.equal(pdf.statusCode,200,pdf.body);assert.match(pdf.headers['content-type']!,/application\/pdf/);assert.equal((await PDFDocument.load(pdf.rawPayload)).getPageCount(),1);
  assert.equal((await f.request(`api/quotes/${id}`)).json().data.status,'finalized','Gerar não confirma envio');
  await f.request('api/company',f.a,'PUT',{data:{...company,name:'Nova empresa'},expectedRevision:1});
  const saved=(await f.request(`api/quotes/${id}`)).json();await f.request(`api/quotes/${id}`,f.a,'PUT',{data:{...saved.data,status:'draft'},expectedRevision:1});
  assert.equal((await f.request(`api/quotes/${id}`,f.a,'PUT',{data:{...saved.data,notes:'Nova edição',items:[{...item,quantity:'5'}]},expectedRevision:2})).statusCode,200);
  const db=new DatabaseSync(path);const rows=db.prepare('SELECT * FROM quote_documents ORDER BY edition').all();assert.equal(rows.length,2);const first=JSON.parse(String(rows[0].data)),second=JSON.parse(String(rows[1].data));assert.equal(first.company.name,company.name);assert.equal(first.totals.totalCents,5686);assert.equal(second.company.name,'Nova empresa');assert.equal(second.totals.totalCents,8654);assert.equal(first.quote.notes,quote.notes);assert.ok(!('logo' in first));
  await f.request('api/company/logo',f.a,'PUT',{expectedRevision:0,png:png().toString('base64')});
  const withLogo=await f.request(`api/quotes/${id}/document?edition=1`);assert.equal(withLogo.statusCode,200);assert.ok(withLogo.rawPayload.length>pdf.rawPayload.length);
  await f.restart();assert.equal((await f.request(`api/quotes/${id}/documents`)).json().length,2);
  assert.equal((await f.request(`api/quotes/${id}/document?edition=0`)).statusCode,400);
  const dir='/tmp/artesao-validation';mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'orcamento.pdf'),withLogo.rawPayload);writeFileSync(join(dir,'metrics.json'),JSON.stringify({pdfBytes:withLogo.rawPayload.length,pages:1,rssBytes:process.memoryUsage().rss}));
  // Failure to capture must roll back both quote and document changes.
  db.exec('DELETE FROM company_profile');const count=db.prepare('SELECT COUNT(*) n FROM quotes').get()!.n;
  assert.equal((await f.request('api/quotes',f.a,'POST',{data:quote,expectedRevision:0})).statusCode,500);assert.equal(db.prepare('SELECT COUNT(*) n FROM quotes').get()!.n,count);db.close();
 }finally{await f.close();}
});
test('aceite legal obrigatório por padrão e bloqueio no servidor antes de dados e suporte',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('api/legal/status')).json().enabled,true);
  const doc={version:'test-1',effectiveAt:'2026-01-01',text:'Documento fictício de teste <script>não executar</script>'};
  const config={enabled:true,reviewed:true,terms:doc,privacy:doc,cookies:doc};writeFileSync(join(f.dir,'legal-config.json'),JSON.stringify(config));await f.restart();
  assert.equal((await f.request('api/company')).statusCode,428);assert.equal((await f.request('api/support')).statusCode,428);
  const page=await f.request('legal');assert.equal(page.statusCode,200);assert.match(page.body,/&lt;script&gt;/);
  const status=(await f.request('api/legal/status')).json();
  assert.equal((await f.request('api/legal/accept',f.a,'POST',{version:status.version,termsHash:status.termsHash,accepted:false})).statusCode,400);
  const payload={version:status.version,termsHash:status.termsHash,accepted:true};
  assert.equal((await f.request('api/legal/accept',{...f.a,headers:{...f.a.headers,'x-pilot-csrf':'wrong'}},'POST',payload)).statusCode,403);
  assert.equal((await f.request('api/legal/accept',f.a,'POST',{...payload,version:'stale'})).statusCode,409);
  assert.equal((await f.request('api/legal/accept',f.a,'POST',payload)).statusCode,200);
  assert.equal((await f.request('api/company')).statusCode,200);assert.equal((await f.request('api/legal/status',f.b)).json().required,true);
  await f.restart();assert.equal((await f.request('api/legal/status')).json().required,false);
  writeFileSync(join(f.dir,'legal-config.json'),JSON.stringify({...config,terms:{...doc,version:'test-2'}}));await f.restart();assert.equal((await f.request('api/legal/status')).json().required,true);
  const archive=new DatabaseSync(join(f.dir,'pilot-legal.sqlite'));assert.equal(archive.prepare('SELECT COUNT(*) n FROM acceptances').get()!.n,1);assert.match(String(archive.prepare("SELECT data FROM documents WHERE kind='terms' AND version='test-1'").get()!.data),/fictício/);archive.close();
 }finally{await f.close();}
});
test('versões jurídicas são imutáveis e ativação exige revisão',()=>{
 const dir=mkdtempSync(join(tmpdir(),'legal-immutable-'));const doc={version:'1',effectiveAt:'2026-01-01',text:'Teste'};const config={enabled:true,reviewed:true,terms:doc,privacy:doc,cookies:doc};
 try{writeFileSync(join(dir,'legal-config.json'),JSON.stringify(config));new LegalStore(dir).close();writeFileSync(join(dir,'legal-config.json'),JSON.stringify({...config,terms:{...doc,text:'Mudança na mesma versão'}}));assert.throws(()=>new LegalStore(dir),/imutável/);writeFileSync(join(dir,'legal-config.json'),JSON.stringify({...config,reviewed:false}));assert.throws(()=>new LegalStore(dir),/revisados/);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('PDF limita concorrência e pagina conteúdo extenso sem alterar dados',async()=>{
 const f=await fixture();try{
  await f.ready(f.a);
  const made=await f.request('api/quotes',f.a,'POST',{data:{...quote,items:Array.from({length:80},(_,i)=>({...item,id:i+1})),notes:'Condições comerciais. '.repeat(300)},expectedRevision:0});assert.equal(made.statusCode,200,made.body);
  const id=made.json().id;const responses=await Promise.all([1,2,3].map(()=>f.request(`api/quotes/${id}/document`)));
  assert.ok(responses.some(r=>r.statusCode===503));const ok=responses.find(r=>r.statusCode===200)!;assert.ok(ok);
  const pdf=await PDFDocument.load(ok.rawPayload);assert.ok(pdf.getPageCount()>2);assert.ok(pdf.getPageCount()<=40);
  writeFileSync('/tmp/artesao-validation/multipagina.pdf',ok.rawPayload);
 }finally{await f.close();}
});
