import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.js';
import {loadConfig} from '../server/config.js';
import {calculateManufacturing,durationParts,type Production} from '../server/manufacturing-model.js';
const settings={filamentKgPrice:'100',energyHour:'1',wearHour:'2',humanHour:'30',productiveHours:'100',wholesaleMarkup:'2',factoryMarkup:'3',retailMarkup:'4',internetCost:'100'};
const production:Production={machineSeconds:3600,humanSeconds:600,materialGrams:50,extras:1,packaging:2,label:1};
test('cálculo mantém precisão, usa operação/hora e etapa adicional, sem limitar a 24h',()=>{
 const result=calculateManufacturing(production,settings);assert.equal(result.cost,18);assert.deepEqual(result.prices,{wholesale:3600,factory:5400,retail:7200});
 assert.equal(calculateManufacturing({...production,base:production},settings).cost,36);
 assert.deepEqual(durationParts(90061),{hours:25,minutes:1,seconds:1});assert.ok(Math.abs(calculateManufacturing({...production,machineSeconds:4020},settings).cost!-(18+4*7/60))<1e-10);
 assert.ok(calculateManufacturing(production,{...settings,productiveHours:'0'}).pending.length);assert.ok(calculateManufacturing({...production,materialGrams:null},settings).pending.length);
});
test('cadastro único: guarda fabricação sem alterar preços, aplica só por escolha e protege revisões',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'manufacturing-'));const options={dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local' as const};let app=await createApp(options);
 const product={name:'Produto fictício',origin:'own',publicAllowed:false,prices:{wholesale:1200,factory:null,retail:null},lengthCm:null,widthCm:null,heightCm:null,weightGrams:null,colors:[],sourceKeys:[],family:'',description:'Preservar',category:''};
 try{
  assert.equal((await app.inject({method:'PUT',url:'/api/settings/fabricacao',payload:{data:settings,expectedRevision:0}})).statusCode,200);
  const id=(await app.inject({method:'POST',url:'/api/products',payload:product})).json().id;
  const current=async()=> (await app.inject('/api/products')).json().find((p:{id:number})=>p.id===id);
  let saved=await current();const payload={name:saved.name,sku:'TESTE',category:'',manufacturing:production,applyPrices:false,expectedUpdatedAt:saved.updatedAt,expectedSettingsRevision:1};
  assert.equal((await app.inject({method:'PUT',url:`/api/products/${id}/manufacturing`,payload})).statusCode,200);saved=await current();assert.deepEqual(saved.prices,product.prices);assert.deepEqual(saved.manufacturing,production);assert.equal(saved.description,'Preservar');
  assert.equal((await app.inject({method:'PUT',url:`/api/products/${id}/manufacturing`,payload})).statusCode,409);
  assert.equal((await app.inject({method:'PUT',url:`/api/products/${id}/manufacturing`,payload:{...payload,expectedUpdatedAt:saved.updatedAt,expectedSettingsRevision:0}})).statusCode,409);
  assert.equal((await app.inject({method:'PUT',url:`/api/products/${id}/manufacturing`,payload:{...payload,expectedUpdatedAt:saved.updatedAt,applyPrices:true}})).statusCode,200);saved=await current();assert.deepEqual(saved.prices,{wholesale:3600,factory:5400,retail:7200});
  const {id:ignore,updatedAt,...body}=saved;assert.equal((await app.inject({method:'PUT',url:`/api/products/${id}`,payload:{...body,name:'Editado no cadastro básico'}})).statusCode,200);
  assert.equal((await current()).manufacturing.machineSeconds,3600);
  const created=await app.inject({method:'POST',url:'/api/manufacturing/products',payload:{name:'Novo de cliente',sku:'',category:'Não usar',origin:'client',manufacturing:production,applyPrices:true,expectedSettingsRevision:1}});assert.equal(created.statusCode,200);
  const clientProduct=(await app.inject('/api/products')).json().find((p:{id:number})=>p.id===created.json().id);assert.equal(clientProduct.category,'Produtos de cliente');assert.equal(clientProduct.publicAllowed,false);
  await app.close();app=await createApp(options);assert.equal((await current()).manufacturing.machineSeconds,3600);assert.equal((await current()).prices.wholesale,3600);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
