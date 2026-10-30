import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../server/app.js';
import {loadConfig} from '../server/config.js';

const base={name:'Peça fictícia',sku:'TEST-CATALOG',origin:'own',publicAllowed:false,prices:{wholesale:1000,factory:1500,retail:2000},weightGrams:50,lengthCm:10,widthCm:5,heightCm:3,colors:['Azul'],sourceKeys:[],family:'Valor legado preservado',description:'Descrição fictícia',category:'Teste'};

test('catálogo é opcional, persistente e independente da privacidade no cadastro e em editores antigos',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'catalog-editor-'));
 const options={dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local' as const};let app=await createApp(options);
 const list=async()=>(await app.inject('/api/products')).json();
 try{
  const made=await app.inject({method:'POST',url:'/api/products/editor',payload:{product:{...base,catalogVisible:true},applyPrices:false}});
  assert.equal(made.statusCode,200,made.body);let product=made.json();
  assert.equal(product.catalogVisible,true);assert.equal(product.publicAllowed,false);
  const {id,updatedAt,catalogVisible,...legacyBody}=product;
  const edited=await app.inject({method:'PUT',url:`/api/products/${id}/editor`,payload:{product:{...legacyBody,name:'Peça renomeada'},applyPrices:false,expectedUpdatedAt:updatedAt}});
  assert.equal(edited.statusCode,200,edited.body);assert.equal(edited.json().catalogVisible,true);assert.equal(edited.json().family,base.family);
  product=edited.json();const {id:editId,updatedAt:editTime,catalogVisible:omitted,...legacyPut}=product;
  assert.equal((await app.inject({method:'PUT',url:`/api/products/${id}`,headers:{'x-expected-updated-at':editTime},payload:legacyPut})).statusCode,200);
  assert.equal((await list())[0].catalogVisible,true);
  const client=await app.inject({method:'POST',url:'/api/products/editor',payload:{product:{...base,name:'Personalizado fictício',origin:'client',catalogVisible:true,publicAllowed:true},applyPrices:false}});
  assert.equal(client.statusCode,200,client.body);assert.equal(client.json().catalogVisible,true);assert.equal(client.json().publicAllowed,false);
  assert.equal((await app.inject({method:'POST',url:'/api/products',payload:{...base,name:'Sem marcação'}})).statusCode,200);
  assert.equal((await list()).find((p:any)=>p.name==='Sem marcação').catalogVisible,false);
  assert.equal((await app.inject({method:'POST',url:'/api/products',payload:{...base,catalogVisible:'sim'}})).statusCode,400);
  await app.close();
  // Simulate a record from before the JSON field existed, without rewriting its other data.
  const db=new DatabaseSync(join(dir,'validation.sqlite'));
  db.prepare("UPDATE products SET data=json_remove(data,'$.catalogVisible') WHERE id=3").run();db.close();
  app=await createApp(options);
  assert.equal((await list()).find((p:any)=>p.id===3).catalogVisible,false);
  assert.equal((await list()).find((p:any)=>p.id===id).catalogVisible,true);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('catálogo em lote revisa, preserva dados e importações, protege concorrência e sobrevive ao arquivamento e reinício',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'catalog-actions-'));
 const options={dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local' as const};let app=await createApp(options);
 const list=async()=>(await app.inject('/api/products')).json();
 const action=(rows:any[],chosen:string,confirm=true,kind='products')=>app.inject({method:'POST',url:`/api/records/${kind}/actions`,payload:{action:chosen,confirm,records:rows.map(p=>({id:p.id,updatedAt:p.updatedAt}))}});
 try{
  const source={...base,manufacturing:{machineSeconds:100,humanSeconds:200,materialGrams:20,extras:1,packaging:2,label:1},sourceKeys:['excel:synthetic-catalog']};
  const imported=await app.inject({method:'POST',url:'/api/products/import',payload:{products:[source],confirm:true}});assert.equal(imported.statusCode,200,imported.body);
  await app.inject({method:'POST',url:'/api/products/editor',payload:{product:{...base,name:'De cliente fictício',sku:'TEST-CLIENT',origin:'client'},applyPrices:false}});
  let products=await list();const before=structuredClone(products);
  const preview=await action(products,'catalog_include',false);assert.equal(preview.statusCode,200);assert.equal(preview.json().affected,2);assert.deepEqual(await list(),before);
  const included=await action(products,'catalog_include');assert.equal(included.statusCode,200);assert.equal(included.json().affected,2);
  products=await list();assert.ok(products.every((p:any)=>p.catalogVisible&&!p.publicAllowed));
  for(const p of products){const original=before.find((v:any)=>v.id===p.id);const {updatedAt:oldTime,...originalData}=original;const {updatedAt,...data}=p;assert.deepEqual(data,{...originalData,catalogVisible:true});assert.ok(Date.parse(updatedAt)>Date.parse(oldTime));}
  const noop=await action(products,'catalog_include');assert.equal(noop.json().affected,0);assert.equal(noop.json().skipped,2);assert.deepEqual(await list(),products);
  const stale=[products[0],{...products[1],updatedAt:'stale'}];assert.equal((await action(stale,'catalog_remove')).statusCode,409);assert.deepEqual(await list(),products);
  assert.equal((await action(products,'catalog_include',true,'clients')).statusCode,400);
  const complement=await app.inject({method:'POST',url:'/api/products/import',payload:{products:[{...source,imageUrl:'https://example.test/ficticio.png'}],fillMissing:true,confirm:true}});assert.equal(complement.statusCode,200,complement.body);
  const complemented=(await list()).find((p:any)=>p.id===1);assert.equal(complemented.catalogVisible,true);assert.equal(complemented.imageUrl,'https://example.test/ficticio.png');
  const records=[{key:'synthetic',product:{...source,sourceKeys:['excel:synthetic-catalog'],description:'Outra descrição',catalogVisible:false}}];
  const request={records,confirm:false};const reviewed=await app.inject({method:'POST',url:'/api/products/reconcile',payload:request});assert.equal(reviewed.statusCode,200,reviewed.body);
  assert.equal((await app.inject({method:'POST',url:'/api/products/reconcile',payload:{...request,confirm:true,previewToken:reviewed.json().previewToken}})).statusCode,200);
  assert.equal((await list()).find((p:any)=>p.id===1).catalogVisible,true);
  products=await list();assert.equal((await action([products[0]],'archive')).statusCode,200);
  const archived=(await app.inject('/api/records/products/archived')).json();assert.equal((await action(archived,'catalog_remove')).statusCode,409);
  assert.equal((await action(archived,'restore')).statusCode,200);
  products=await list();assert.equal((await action(products,'catalog_remove')).statusCode,200);assert.ok((await list()).every((p:any)=>!p.catalogVisible));
  products=await list();assert.equal((await action([products[0]],'catalog_include')).statusCode,200);
  await app.close();app=await createApp(options);assert.equal((await list()).filter((p:any)=>p.catalogVisible).length,1);
  const exported=(await app.inject('/api/products/export')).json();assert.equal(exported.products.filter((p:any)=>p.catalogVisible).length,1);assert.equal(exported.clients,undefined);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
