import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.js';
import {loadConfig} from '../server/config.js';
import {importPayload} from '../src/ProductSettings.js';
const manufacturing={machineSeconds:3600,humanSeconds:600,materialGrams:50,extras:1,packaging:2,label:1};
const product={name:'Produto fictício',sku:'FAKE-1',origin:'own',publicAllowed:false,prices:{wholesale:null,factory:null,retail:1200},lengthCm:null,widthCm:null,heightCm:null,weightGrams:null,colors:[],sourceKeys:['https://loja.example#woocommerce:1'],family:'',description:'',category:''};
test('concilia piloto, protege preços/fabricação e parâmetros, preserva agrupamento Woo e exporta sem clientes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'reconciliation-'));const options={dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local' as const};let app=await createApp(options);
 const reconcile=(body:object)=>app.inject({method:'POST',url:'/api/products/reconcile',payload:body});
 try{
  assert.equal((await app.inject({method:'POST',url:'/api/products/import',payload:{products:[product],confirm:true}})).statusCode,200);
  const records=[{key:'linha-1',product:{...product,name:'Nome da planilha',sourceKeys:['excel:fake-1'],prices:{wholesale:2000,factory:3000,retail:4000},manufacturing,category:'Categoria > Subcategoria'}}];
  const settings={filamentKgPrice:'100',productiveHours:'100'};
  const request={records,settings,confirm:false};const preview=(await reconcile(request)).json();assert.equal(preview.valid,true);assert.equal(preview.counts.update,1);assert.equal(preview.details[0].targetId,1);assert.equal(preview.details[0].priceAfter.retail,1200);
  assert.equal((await app.inject('/api/products')).json()[0].manufacturing,undefined);assert.equal((await app.inject('/api/settings/fabricacao')).json().revision,0);
  assert.equal((await reconcile({...request,confirm:true})).statusCode,409);
  assert.equal((await reconcile({...request,confirm:true,previewToken:preview.previewToken})).statusCode,200);
  let saved=(await app.inject('/api/products')).json()[0];assert.equal(saved.name,product.name);assert.equal(saved.prices.retail,1200);assert.equal(saved.manufacturing.machineSeconds,3600);assert.ok(saved.sourceKeys.includes(product.sourceKeys[0]));assert.ok(saved.sourceKeys.includes('excel:fake-1'));assert.equal((await app.inject('/api/settings/fabricacao')).json().revision,0);
  const {id:staleId,updatedAt:staleTime,archived:unusedArchive,...staleBody}=saved;
  assert.equal((await app.inject({method:'PUT',url:'/api/products/1',headers:{'x-expected-updated-at':'stale'},payload:staleBody})).statusCode,409);
  const complement=await app.inject({method:'POST',url:'/api/products/import',payload:{products:[{...product,description:'Complemento fictício'}],confirm:true,fillMissing:true}});assert.equal(complement.statusCode,200);assert.equal(complement.json().updated,1);
  const repeat=(await reconcile(request)).json();assert.equal(repeat.counts.create,0);assert.equal(repeat.counts.preserve,1);
  const decisions=[{key:'linha-1',targetId:1,applyPrices:true,replaceManufacturing:true}];const replace={...request,decisions,applyConfiguration:true};const reviewed=(await reconcile(replace)).json();assert.equal(reviewed.details[0].priceAfter.retail,4000);
  assert.equal((await reconcile({...replace,confirm:true,previewToken:reviewed.previewToken})).statusCode,200);
  const exported=(await app.inject('/api/products/export')).json();assert.equal(exported.type,'catalog-export-v1');assert.equal(exported.products.length,1);assert.equal(exported.products[0].prices.retail,4000);assert.equal(exported.clients,undefined);assert.equal(exported.quotes,undefined);assert.equal(exported.manufacturingSettings.data.filamentKgPrice,'100');
  await app.close();app=await createApp(options);saved=(await app.inject('/api/products')).json()[0];assert.equal(saved.manufacturing.materialGrams,50);assert.equal(saved.prices.retail,4000);assert.equal((await app.inject('/api/products')).json().length,1);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('catálogo alterado invalida confirmação, conflitos são revisáveis e arquivados não são reativados',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'reconciliation-conflicts-'));const app=await createApp({dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local'});
 const post=(path:string,payload:object)=>app.inject({method:'POST',url:path,payload});
 try{
  const body={...product,sourceKeys:[]};await post('/api/products',body);await post('/api/products',{...body,sku:'FAKE-2'});
  const records=[{key:'linha',product:{...product,sku:'',sourceKeys:['excel:ambiguous']}}];const preview=(await post('/api/products/reconcile',{records,confirm:false})).json();assert.equal(preview.valid,false);assert.equal(preview.details[0].targetId,'review');
  const skip={records,decisions:[{key:'linha',targetId:'skip'}],confirm:false};const skipped=(await post('/api/products/reconcile',skip)).json();assert.equal(skipped.valid,true);
  await post('/api/products',{...body,name:'Outro fictício',sku:'FAKE-3'});
  assert.equal((await post('/api/products/reconcile',{...skip,confirm:true,previewToken:skipped.previewToken})).statusCode,409);
  await app.inject({method:'DELETE',url:'/api/products/1'});const archiveRecord=[{key:'arquivo',product:{...product,sourceKeys:['excel:archived']}}];const archived=(await post('/api/products/reconcile',{records:archiveRecord,decisions:[{key:'arquivo',targetId:1}],confirm:false})).json();assert.equal(archived.valid,false);
  assert.equal((await app.inject('/api/products/export')).json().products.filter((p:{archived:boolean})=>p.archived).length,1);
  const reservedOwn=[{key:'reserved',product:{...product,category:'Produtos de cliente',sourceKeys:['excel:reserved']}}];assert.equal((await post('/api/products/reconcile',{records:reservedOwn,confirm:false})).json().valid,false);
  const differentCategories=[{key:'cat-a',product:{...product,name:'Outra peça fictícia',sku:'',category:'Categoria A',sourceKeys:['excel:cat-a']}},{key:'cat-b',product:{...product,name:'Outra peça fictícia',sku:'',category:'Categoria B',sourceKeys:['excel:cat-b']}}];assert.equal((await post('/api/products/reconcile',{records:differentCategories,confirm:false})).json().valid,true);
  assert.equal(importPayload(JSON.stringify({type:'manufacturing-import-v1',records,settings:{}})).type,'reconciliation');assert.throws(()=>importPayload('{"type":"catalog-export-v1","products":[]}'),/conferência/);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
