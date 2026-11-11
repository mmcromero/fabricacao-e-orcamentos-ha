import {setModuleAccess} from '../server/pilot/module-grants.js';
import {moduleKeys} from '../server/module-access.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,statSync,symlinkSync,unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {PNG} from 'pngjs';
import {createApp} from '../server/app.js';
import {ProductPhotos,optimizedPng} from '../server/product-photos.js';
import {createPilotApp} from '../server/pilot/app.js';
import {PilotStore,digest} from '../server/pilot/store.js';
import type {PilotConfig} from '../server/pilot/config.js';
const png=(red=240)=>PNG.sync.write({width:2,height:1,data:Buffer.from([red,10,20,255,10,20,30,0])} as PNG);
const product=(name='Foto')=>({name,origin:'own',publicAllowed:false,prices:{wholesale:null,factory:null,retail:1000},weightGrams:null,lengthCm:null,widthCm:null,heightCm:null,colors:[],sourceKeys:[] as string[],family:'',description:''});
async function fixture(){const dir=mkdtempSync(join(tmpdir(),'product-photos-'));let app=await createApp({dataDir:dir,staticDir:resolve('dist'),mode:'local',pilotFeatures:true,logRequests:false});const seed=new DatabaseSync(join(dir,'validation.sqlite'));seed.prepare('INSERT INTO pilot_onboarding VALUES(1,?)').run(new Date().toISOString());seed.close();return {dir,get app(){return app;},restart:async()=>{await app.close();app=await createApp({dataDir:dir,staticDir:resolve('dist'),mode:'local',pilotFeatures:true,logRequests:false});},close:async()=>{await app.close();rmSync(dir,{recursive:true,force:true});}};}
test('photos: upload, immutable substitution, PNG content, permissions and restart without schema change',async()=>{
 const f=await fixture();try{
  const upload=await f.app.inject({method:'POST',url:'/api/product-photos',payload:{png:png().toString('base64')}});assert.equal(upload.statusCode,200,upload.body);const photo=upload.json();assert.match(photo.url,/^api\/product-photos\/[a-f0-9]{32}\/[a-f0-9]{64}\.png$/);assert.equal(photo.width,2);
  const consign=await f.app.inject({method:'POST',url:'/api/inventory/consigned',payload:{requestKey:'photo-consigned',name:'Consignado foto',supplier:'Teste',salePrice:1000,repass:500,imageUrl:photo.url,active:true}});assert.equal(consign.statusCode,200,consign.body);
  const made=await f.app.inject({method:'POST',url:'/api/products',payload:{...product(),imageUrl:photo.url}});assert.equal(made.statusCode,200,made.body);
  const read=await f.app.inject('/'+photo.url);assert.equal(read.statusCode,200);assert.match(String(read.headers['content-type']),/^image\/png/);assert.equal(PNG.sync.read(read.rawPayload).data[7],0);
  const path=join(f.dir,'product-photos',photo.sha256+'.png');assert.equal(statSync(path).mode&0o777,0o600);assert.equal(statSync(join(f.dir,'product-photos')).mode&0o777,0o700);
  const duplicate=(await f.app.inject({method:'POST',url:'/api/product-photos',payload:{png:png().toString('base64')}})).json();assert.equal(duplicate.url,photo.url);
  const second=(await f.app.inject({method:'POST',url:'/api/product-photos',payload:{png:png(180).toString('base64')}})).json();assert.notEqual(second.url,photo.url);
  assert.equal((await f.app.inject({method:'POST',url:'/api/inventory/consigned',payload:{requestKey:'replace-consigned-photo',id:consign.json().id,expectedRevision:1,name:'Consignado foto',supplier:'Teste',salePrice:1000,repass:500,imageUrl:second.url,active:true}})).statusCode,200);
  assert.equal((await f.app.inject({method:'PUT',url:'/api/products/'+made.json().id,payload:{...product(),imageUrl:second.url}})).statusCode,200);
  await f.restart();assert.equal((await f.app.inject('/'+photo.url)).statusCode,200);assert.equal((await f.app.inject('/'+second.url)).statusCode,200);assert.equal((await f.app.inject('/api/products')).json()[0].imageUrl,second.url);
  const noImage=await f.app.inject({method:'POST',url:'/api/products',payload:product('Sem foto')});assert.equal(noImage.statusCode,200);
 }finally{await f.close();}
});
test('photos: corrupt/truncated/oversized/dangerous formats and references refused before storage',async()=>{
 const f=await fixture();try{
  const original=png(),wide=Buffer.from(original),crc=Buffer.from(original);wide.writeUInt32BE(50000,16);crc[crc.length-1]^=255;
  for(const data of ['invalid','PHN2Zz48L3N2Zz4=',wide.toString('base64'),crc.toString('base64'),original.subarray(0,40).toString('base64'),Buffer.concat([original,Buffer.from('trailing')]).toString('base64'),Buffer.concat([original.subarray(0,33),original.subarray(8)]).toString('base64')])assert.equal((await f.app.inject({method:'POST',url:'/api/product-photos',payload:{png:data}})).statusCode,400);
  assert.equal((await f.app.inject({method:'POST',url:'/api/product-photos',payload:{png:'A'.repeat(700001)}})).statusCode,413);
  for(const imageUrl of ['https://outside.example/photo.jpg','api/product-photos/'+'a'.repeat(32)+'/'+'b'.repeat(64)+'.png','data:image/png;base64,AA','../../secret'])assert.equal((await f.app.inject({method:'POST',url:'/api/products',payload:{...product(),imageUrl}})).statusCode,400);
  const own=new ProductPhotos(f.dir),photo=own.put(original.toString('base64')),path=join(own.directory,photo.sha256+'.png');unlinkSync(path);symlinkSync(join(f.dir,'validation.sqlite'),path);assert.equal(own.read(photo.url),null);assert.equal(own.read('api/product-photos/'+own.owner+'/../../validation.sqlite'),null);
  assert.throws(()=>optimizedPng(wide.toString('base64')));
 }finally{await f.close();}
});
test('photos: grandfathered external reference only on original record; all product write paths protected',async()=>{
 const f=await fixture();try{
  const legacy={...product('Antigo'),imageUrl:'https://old.example/photo.jpg'};const db=new DatabaseSync(join(f.dir,'validation.sqlite'));const id=Number(db.prepare('INSERT INTO products(data,updated_at) VALUES (?,?)').run(JSON.stringify(legacy),'2026-01-01T00:00:00.000Z').lastInsertRowid);db.close();
  assert.equal((await f.app.inject({method:'PUT',url:'/api/products/'+id,payload:{...legacy,name:'Renomeado'}})).statusCode,200);
  assert.equal((await f.app.inject({method:'PUT',url:'/api/products/'+id,payload:product('Sem alterar foto')})).statusCode,200);assert.equal((await f.app.inject('/api/products')).json()[0].imageUrl,legacy.imageUrl);
  assert.equal((await f.app.inject({method:'PUT',url:'/api/products/'+id,payload:{...legacy,imageUrl:'https://new.example/photo.jpg'}})).statusCode,400);
  assert.equal((await f.app.inject({method:'POST',url:'/api/products/editor',payload:{product:legacy,applyPrices:false}})).statusCode,400);
  const updated=(await f.app.inject('/api/products')).json()[0];assert.equal((await f.app.inject({method:'PUT',url:'/api/products/'+id+'/editor',payload:{product:legacy,applyPrices:false,expectedUpdatedAt:updated.updatedAt}})).statusCode,200);
  assert.equal((await f.app.inject({method:'POST',url:'/api/products/import',payload:{confirm:true,products:[{...legacy,name:'Novo importado',sourceKeys:['external:1']}]}})).statusCode,400);
  const request={confirm:false,records:[{key:'new',product:{...legacy,name:'Novo',sourceKeys:['external:2']}}]};const preview=(await f.app.inject({method:'POST',url:'/api/products/reconcile',payload:request})).json();assert.equal(preview.valid,false);assert.ok(preview.details[0].errors.some((m:string)=>m.includes('URLs externas')));
  const reconcile=await f.app.inject({method:'POST',url:'/api/products/reconcile',payload:{...request,confirm:true,previewToken:preview.previewToken}});assert.equal(reconcile.statusCode,400,reconcile.body);
  const consign={requestKey:'new-bad-photo',name:'Terceiro',supplier:'Pessoa',salePrice:1000,repass:500,imageUrl:legacy.imageUrl,active:true};assert.equal((await f.app.inject({method:'POST',url:'/api/inventory/consigned',payload:consign})).statusCode,400);
 }finally{await f.close();}
});
test('photos: authenticated cookie image read, expiry, CSRF and strict tenant isolation including copied references',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pilot-photos-')),origin='https://photos.example.test',prefix='/artesaos-piloto/';const config:PilotConfig={publicUrl:new URL(origin+prefix),prefix,dataDir:dir,staticDir:resolve('dist'),clientId:'synthetic',clientSecret:'synthetic',sessionHours:8,idleMinutes:30,maxUsers:5,adminEmails:[]};const control=new PilotStore(dir);
 const accounts=['a','b'].map(name=>{const invite=control.invite(name+'@example.test'),id=control.activate({issuer:'https://accounts.google.com',subject:name,email:name+'@example.test',verified:true},digest(invite),5),s=control.session(id,8);return {id,cookie:'__Secure-artesaos_session='+s.value,csrf:s.csrf};});let app=await createPilotApp(config);
 const request=(path:string,who=accounts[0],method='GET',payload?:unknown,context=true)=>app.inject({method:method as any,url:prefix+path,headers:{host:'photos.example.test',origin,cookie:who.cookie,...(context?{'x-pilot-context':who.id,'x-pilot-csrf':who.csrf}:{})},...(payload===undefined?{}:{payload:payload as any})});
 try{
  for(const a of accounts){setModuleAccess(control.db,a.id,moduleKeys,0,'fixture');const status=(await request('api/legal/status',a)).json();assert.equal((await request('api/legal/accept',a,'POST',{version:status.version,termsHash:status.termsHash,accepted:true})).statusCode,200);await request('api/company',a);const tenant=String(control.db.prepare('SELECT tenant_id FROM pilot_users WHERE id=?').get(a.id)!.tenant_id);const db=new DatabaseSync(join(dir,'tenants',tenant,'validation.sqlite'));db.prepare('INSERT INTO pilot_onboarding VALUES(1,?)').run(new Date().toISOString());db.close();}
  const uploaded=await request('api/product-photos',accounts[0],'POST',{png:png().toString('base64')});assert.equal(uploaded.statusCode,200,uploaded.body);const a=uploaded.json();
  assert.equal((await request(a.url,accounts[0],'GET',undefined,false)).statusCode,200);assert.equal((await request(a.url,accounts[1],'GET',undefined,false)).statusCode,404);
  assert.equal((await request('api/products',accounts[1],'POST',{...product(),imageUrl:a.url})).statusCode,400);
  assert.equal((await request('api/inventory/consigned',accounts[1],'POST',{requestKey:'copied-photo',name:'Teste',supplier:'Fornecedor',salePrice:1000,repass:500,imageUrl:a.url,active:true})).statusCode,400);
  assert.equal((await request('api/product-photos',accounts[0],'POST',{png:png().toString('base64')},false)).statusCode,409);
  assert.equal((await request('api/product-photos',{...accounts[0],csrf:'wrong'},'POST',{png:png().toString('base64')})).statusCode,403);
  const b=(await request('api/product-photos',accounts[1],'POST',{png:png().toString('base64')})).json();assert.notEqual(a.url,b.url);
  await app.close();app=await createPilotApp(config);assert.equal((await request(a.url,accounts[0],'GET',undefined,false)).statusCode,200);
  const anonymous=await app.inject({url:prefix+a.url,headers:{host:'photos.example.test'}});assert.equal(anonymous.statusCode,401);
  control.db.prepare('UPDATE pilot_sessions SET expires_at=0').run();assert.equal((await request(a.url,accounts[0],'GET',undefined,false)).statusCode,401);
 }finally{await app.close();control.close();rmSync(dir,{recursive:true,force:true});}
});
