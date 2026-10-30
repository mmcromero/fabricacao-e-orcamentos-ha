import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.js';
import {loadConfig} from '../server/config.js';
const base={name:'Produto sintético',sku:'TEST',origin:'own',publicAllowed:false,prices:{wholesale:null,factory:null,retail:1000},weightGrams:null,lengthCm:null,widthCm:null,heightCm:null,colors:[],sourceKeys:[],family:'',description:'',category:''};
const manufacturing={machineSeconds:3600,humanSeconds:600,materialGrams:50,extras:1,packaging:2,label:1};
test('editor completo salva atomicamente, protege concorrência e só aplica cálculo explicitamente',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'editor-'));const app=await createApp({dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local'});
 try{
  const created=await app.inject({method:'POST',url:'/api/products/editor',payload:{product:{...base,manufacturing,description:'Descrição completa',imageUrl:'https://example.test/photo.jpg'},applyPrices:false}});assert.equal(created.statusCode,200,created.body);const p=created.json();assert.equal(p.prices.retail,1000);assert.equal(p.manufacturing.machineSeconds,3600);
  const {id,updatedAt,...data}=p;
  assert.equal((await app.inject({method:'PUT',url:`/api/products/${id}/editor`,payload:{product:data,applyPrices:false,expectedUpdatedAt:'old'}})).statusCode,409);
  assert.equal((await app.inject({method:'PUT',url:`/api/products/${id}/editor`,payload:{product:data,applyPrices:true,expectedUpdatedAt:updatedAt,expectedSettingsRevision:99}})).statusCode,409);
  const config={filamentKgPrice:'100',energyHour:'1',wearHour:'2',humanHour:'30',productiveHours:'100',wholesaleMarkup:'2',factoryMarkup:'3',retailMarkup:'4'};
  assert.equal((await app.inject({method:'PUT',url:'/api/settings/fabricacao',payload:{data:config,expectedRevision:0}})).statusCode,200);
  const response=await app.inject({method:'PUT',url:`/api/products/${id}/editor`,payload:{product:data,applyPrices:true,expectedUpdatedAt:updatedAt,expectedSettingsRevision:1}});assert.equal(response.statusCode,200,response.body);assert.equal(response.json().prices.retail,6800);assert.equal(response.json().description,data.description);
  const selected=response.json();const {id:selectedId,updatedAt:selectedTime,...selectedData}=selected;
  const individual=await app.inject({method:'PUT',url:`/api/products/${id}/editor`,payload:{product:{...selectedData,manufacturing:{...manufacturing,extras:2}},applyPrices:false,applyTiers:['retail'],expectedUpdatedAt:selectedTime,expectedSettingsRevision:1}});assert.equal(individual.statusCode,200,individual.body);assert.deepEqual(individual.json().prices,{wholesale:3400,factory:5100,retail:7200});
  const privateClient=await app.inject({method:'POST',url:'/api/products/editor',payload:{product:{...base,name:'Cliente sintético',origin:'client',publicAllowed:true},applyPrices:false}});assert.equal(privateClient.statusCode,200);assert.equal(privateClient.json().publicAllowed,false);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('lotes revisáveis, clientes privados, arquivamento/restauração e histórico preservados após reinício',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'actions-'));const options={dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local' as const};let app=await createApp(options);
 const action=(kind:string,records:any[],chosen:string,confirm=true)=>app.inject({method:'POST',url:`/api/records/${kind}/actions`,payload:{action:chosen,confirm,records:records.map(r=>({id:r.id,updatedAt:r.updatedAt}))}});
 try{
  for(const origin of ['own','client'])assert.equal((await app.inject({method:'POST',url:'/api/products/editor',payload:{product:{...base,origin},applyPrices:false}})).statusCode,200);
  let products=(await app.inject('/api/products')).json();const preview=await action('products',products,'public',false);assert.equal(preview.json().affected,1);assert.equal(preview.json().skipped,1);assert.equal((await app.inject('/api/products')).json().filter((r:any)=>r.publicAllowed).length,0);
  assert.equal((await action('products',products,'public')).statusCode,200);assert.equal((await action('products',products,'archive')).statusCode,409);products=(await app.inject('/api/products')).json();assert.equal(products.filter((r:any)=>r.publicAllowed).length,1);
  const c=(await app.inject({method:'POST',url:'/api/clients',payload:{name:'Cliente de teste',contact:'',phone:'',email:'',taxDocument:'',postal:'',street:'',number:'',complement:'',district:'',city:'',state:''}})).json();assert.ok(c.id);
  const q=(await app.inject({method:'POST',url:'/api/quotes',payload:{data:{title:'Teste histórico',client:{id:c.id,name:'Cliente de teste',contact:'',phone:'',email:'',taxDocument:'',postal:''},items:[],notes:''},expectedRevision:0}})).json();assert.ok(q.id);
  const quotes=(await app.inject('/api/quotes?pageSize=all')).json().items;const clients=(await app.inject('/api/clients')).json();
  for(const [kind,rows] of [['products',products],['clients',clients],['quotes',quotes]] as const){assert.equal((await action(kind,rows,'archive')).statusCode,200);assert.equal((await app.inject(`/api/records/${kind}/archived`)).json().length,rows.length);}
  const archivedClientQuote={title:'Novo indevido',client:{id:c.id,name:'Cliente de teste',contact:'',phone:'',email:'',taxDocument:'',postal:''},items:[],notes:''};assert.equal((await app.inject({method:'POST',url:'/api/quotes',payload:{data:archivedClientQuote,expectedRevision:0}})).statusCode,400);
  assert.equal((await app.inject('/api/products')).json().length,0);assert.equal((await app.inject('/api/clients')).json().length,0);assert.equal((await app.inject('/api/quotes?pageSize=all')).json().total,0);
  await app.close();app=await createApp(options);
  for(const kind of ['products','clients','quotes']){const archived=(await app.inject(`/api/records/${kind}/archived`)).json();assert.equal((await action(kind,archived,'restore')).statusCode,200);}
  assert.equal((await app.inject('/api/products')).json().length,2);assert.equal((await app.inject(`/api/quotes/${q.id}`)).json().data.title,'Teste histórico');assert.equal((await app.inject(`/api/quotes/${q.id}`)).json().data.client.name,'Cliente de teste');
  assert.equal((await action('clients',(await app.inject('/api/clients')).json(),'public')).statusCode,400);
  assert.equal((await app.inject('/api/records/notes/archived')).statusCode,400);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
