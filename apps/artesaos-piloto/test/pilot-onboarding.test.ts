import {removePostLegacyFixtureTables} from './synthetic-legacy.js';
import {materialLedgerSql} from '../server/material-ledger-schema.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createApp} from '../server/app.js';
import {calculateManufacturing,emptyProduction} from '../server/manufacturing-model.js';
const company={name:'Ateliê',responsible:'Responsável',phone:'11999990000',email:'contato@example.test'};
const material={name:'Material de teste',mode:'quantity',purchaseQuantity:1,purchasePrice:10,purchaseUnit:'kg',customUnit:''};
const settings={energyHour:'2',wearHour:'1',humanHour:'20',productiveHours:'160',wholesaleMarkup:'1.5',factoryMarkup:'2',retailMarkup:'3',otherCost:'160'};
test('rateio manual usa horas humanas somente quando não há máquina, sem dupla cobrança',()=>{
 const production={...emptyProduction(),machineSeconds:0,humanSeconds:7200,packaging:10};
 assert.equal(calculateManufacturing(production,settings,true).cost,52);
 assert.equal(calculateManufacturing({...production,machineSeconds:3600},settings,true).cost,54);
 assert.equal(calculateManufacturing(production,settings).cost,50,'Fórmula do principal permanece preservada');
 assert.equal(calculateManufacturing({...production,base:{...emptyProduction(),machineSeconds:0,humanSeconds:3600}},settings,true).cost,73);
});
test('boas-vindas bloqueia atalhos, valida mínimos, persiste conclusão e corrige dados antigos',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pilot-onboarding-'));
 const options={dataDir:dir,staticDir:resolve('dist'),mode:'local' as const,pilotFeatures:true,logRequests:false};let app=await createApp(options);
 const put=(url:string,payload:unknown)=>app.inject({method:'PUT',url,payload:payload as any});
 try{
  assert.equal((await app.inject('/api/products')).statusCode,428);
  assert.equal((await app.inject({method:'POST',url:'/api/onboarding/complete'})).statusCode,400);
  assert.equal((await put('/api/company',{data:{...company,responsible:''},expectedRevision:0})).statusCode,400);
  assert.equal((await put('/api/company',{data:company,expectedRevision:0})).statusCode,200);
  let state=(await app.inject('/api/onboarding')).json();assert.equal(state.checks.company,true);assert.equal(state.ready,true);
  assert.equal((await app.inject({method:'POST',url:'/api/materials',payload:material})).statusCode,200);
  let stored=(await app.inject('/api/settings/fabricacao')).json();assert.equal(stored.data.wholesaleMarkup,'1.5');assert.equal(stored.data.factoryMarkup,'2.0');assert.equal(stored.data.retailMarkup,'3.0');
  assert.equal((await put('/api/settings/fabricacao',{data:{...settings,wholesaleMarkup:'0',factoryMarkup:'1',retailMarkup:'',productiveHours:'0'},expectedRevision:stored.revision})).statusCode,200);
  assert.equal((await app.inject({method:'POST',url:'/api/onboarding/complete'})).statusCode,200,'Horas e custos não bloqueiam o acesso');
  stored=(await app.inject('/api/settings/fabricacao')).json();assert.equal(stored.data.wholesaleMarkup,'1.5');assert.equal(stored.data.factoryMarkup,'2.0');assert.equal(stored.data.retailMarkup,'3.0');
  await put('/api/settings/fabricacao',{data:{...stored.data,productiveHours:'160',otherCost:'0'},expectedRevision:stored.revision});
  assert.equal((await app.inject({method:'POST',url:'/api/onboarding/complete'})).statusCode,200,'Conclusão é idempotente sem custos');
  stored=(await app.inject('/api/settings/fabricacao')).json();await put('/api/settings/fabricacao',{data:{...stored.data,otherCost:'160'},expectedRevision:stored.revision});
  assert.equal((await app.inject({method:'POST',url:'/api/onboarding/complete'})).statusCode,200);
  assert.equal((await app.inject('/api/products')).statusCode,200);
  const base={name:'Cliente',origin:'client',catalogVisible:true,publicAllowed:false,prices:{retail:1000,wholesale:null,factory:null},weightGrams:null,lengthCm:null,widthCm:null,heightCm:null,colors:[],sourceKeys:[],family:'',description:''};
  const manual=await app.inject({method:'POST',url:'/api/products/editor',payload:{product:{...base,origin:'own',name:'Manual',manufacturing:{...emptyProduction(),machineSeconds:0,humanSeconds:7200,packaging:10}},applyPrices:true,expectedSettingsRevision:(await app.inject('/api/settings/fabricacao')).json().revision}});assert.equal(manual.statusCode,200,manual.body);assert.equal(manual.json().prices.retail,15600);
  const created=await app.inject({method:'POST',url:'/api/products/editor',payload:{product:base,applyPrices:false}});assert.equal(created.statusCode,200,created.body);assert.equal(created.json().catalogVisible,false);
  const row=created.json();const batch=await app.inject({method:'POST',url:'/api/records/products/actions',payload:{action:'catalog_include',records:[{id:row.id,updatedAt:row.updatedAt}],confirm:true}});assert.equal(batch.json().skipped,1);assert.equal(batch.json().affected,0);
  await app.close();const db=new DatabaseSync(join(dir,'validation.sqlite'));
  removePostLegacyFixtureTables(db);
  db.exec('DELETE FROM schema_migrations WHERE version>=2'); // fixture de versão anterior, antes da migração consolidada
  db.prepare("UPDATE area_settings SET data=json_set(json_remove(data,'$.retailMarkup'),'$.wholesaleMarkup','0','$.factoryMarkup','-1') WHERE area='fabricacao'").run();
  db.prepare("UPDATE products SET data=json_set(data,'$.catalogVisible',json('true'))").run();db.close();
  app=await createApp(options);assert.equal((await app.inject('/api/onboarding')).json().complete,true);
  stored=(await app.inject('/api/settings/fabricacao')).json();assert.equal(stored.data.wholesaleMarkup,'1.5');assert.equal(stored.data.factoryMarkup,'2.0');assert.equal(stored.data.retailMarkup,'3.0');
  const legacy=new DatabaseSync(join(dir,'validation.sqlite'));assert.equal(JSON.parse(String(legacy.prepare("SELECT data FROM products WHERE json_extract(data,'$.origin')='client'").get()!.data)).catalogVisible,false);legacy.close();
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});


test('cadastro mínimo libera produtos sem fabricação, preserva Pix e isola contas',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'welcome-minimum-')),other=mkdtempSync(join(tmpdir(),'welcome-other-'));
 const options={staticDir:resolve('dist'),mode:'local' as const,pilotFeatures:true,logRequests:false};
 let app=await createApp({...options,dataDir:dir});const second=await createApp({...options,dataDir:other});
 const put=(data:unknown,expectedRevision=0)=>app.inject({method:'PUT',url:'/api/company',payload:{data,expectedRevision}});
 try{
  assert.equal((await app.inject('/api/company/logo/meta')).statusCode,200,'Logo disponível antes da conclusão');
  const minimal={name:'',responsible:'Ana',phone:'11999990000',email:'',pixKey:'ana@example.test'};
  assert.equal((await put({...minimal,phone:''})).statusCode,400);
  assert.equal((await put({...minimal,email:'inválido'})).statusCode,400);
  assert.equal((await put({...minimal,pixKey:'inválido'})).statusCode,400);
  assert.equal((await put(minimal)).statusCode,200);
  assert.equal((await put({...minimal,responsible:'Outra aba'})).statusCode,409,'Revisão antiga não sobrescreve cadastro');
  assert.equal((await app.inject('/api/onboarding')).json().ready,true);
  assert.equal((await app.inject({method:'POST',url:'/api/onboarding/complete'})).statusCode,200);
  assert.equal((await app.inject('/api/products')).statusCode,200);
  const product={name:'Produto com preço pronto',origin:'own',catalogVisible:false,publicAllowed:false,prices:{retail:2500,wholesale:null,factory:null},weightGrams:null,lengthCm:null,widthCm:null,heightCm:null,colors:[],sourceKeys:[],family:'',description:''};
  const created=await app.inject({method:'POST',url:'/api/products/editor',payload:{product,applyPrices:false}});
  assert.equal(created.statusCode,200,created.body);
  assert.equal(created.json().prices.retail,2500);
  const {pixKey,...legacy}=minimal;
  assert.equal((await put({...legacy,name:'Negócio existente'},1)).statusCode,200);
  assert.equal((await app.inject('/api/company')).json().data.pixKey,pixKey,'Formulários antigos não apagam Pix');
  assert.equal((await second.inject('/api/company')).json().data.responsible,'');
  assert.equal((await second.inject('/api/onboarding')).json().complete,false);
  assert.equal((await second.inject('/api/products')).statusCode,428);
  await app.close();app=await createApp({...options,dataDir:dir});
  assert.equal((await app.inject('/api/onboarding')).json().complete,true);
  const stored=(await app.inject('/api/company')).json();assert.equal(stored.data.name,'Negócio existente');assert.equal(stored.data.pixKey,pixKey);
  assert.equal((await app.inject('/api/products')).json().length,1);
 }finally{await app.close();await second.close();rmSync(dir,{recursive:true,force:true});rmSync(other,{recursive:true,force:true});}
});
