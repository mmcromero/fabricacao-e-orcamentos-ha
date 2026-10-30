import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {materialUseCost,emptyMaterial,definitionOf,type MaterialUse} from '../server/material-model.js';
import {calculateManufacturing,emptyProduction} from '../server/manufacturing-model.js';
import {createApp} from '../server/app.js';
import {loadConfig} from '../server/config.js';
const filament:MaterialUse={...emptyMaterial(),name:'Filamento fictício',purchaseQuantity:1,purchasePrice:100,purchaseUnit:'kg',quantity:20,unit:'g'};
const thread:MaterialUse={...emptyMaterial(),name:'Linha fictícia',purchaseQuantity:5,purchasePrice:5,purchaseUnit:'m',quantity:50,unit:'cm'};
const direct:MaterialUse={...emptyMaterial(),name:'Ímãs fictícios',mode:'direct',quantity:3};
const settings={energyHour:'0',wearHour:'0',humanHour:'0',productiveHours:'100',wholesaleMarkup:'2',factoryMarkup:'3',retailMarkup:'4'};
const product={name:'Peça fictícia com materiais',origin:'own',publicAllowed:false,prices:{wholesale:1000,factory:2000,retail:3000},weightGrams:null,lengthCm:null,widthCm:null,heightCm:null,colors:[],sourceKeys:[],family:'Legado preservado',description:'',category:''};
const production={...emptyProduction(),machineSeconds:0,humanSeconds:0,materials:[filament,thread,direct]};

test('custo proporcional converte apenas unidades compatíveis, mantém precisão e soma materiais/etapas',()=>{
 assert.equal(materialUseCost(filament).cost,2);assert.equal(materialUseCost(thread).cost,0.5);assert.equal(materialUseCost(direct).cost,3);
 assert.equal(materialUseCost({...filament,purchaseQuantity:2,purchasePrice:12,purchaseUnit:'l',quantity:250,unit:'ml'}).cost,1.5);
 assert.equal(materialUseCost({...filament,purchaseQuantity:100,purchasePrice:8,purchaseUnit:'un',quantity:3,unit:'un'}).cost,0.24);
 assert.equal(materialUseCost({...filament,purchaseQuantity:5,purchasePrice:10,purchaseUnit:'custom',customUnit:'lote',quantity:2,unit:'custom'}).cost,4);
 assert.equal(materialUseCost({...filament,unit:'ml'}).cost,null);assert.equal(materialUseCost({...filament,purchaseQuantity:0}).cost,null);assert.equal(materialUseCost({...filament,purchasePrice:null}).cost,null);assert.equal(materialUseCost({...filament,quantity:-1}).cost,null);
 assert.equal(materialUseCost({...filament,purchaseUnit:'custom',unit:'custom',customUnit:''}).cost,null);
 assert.equal(calculateManufacturing(production,settings).cost,5.5);assert.deepEqual(calculateManufacturing(production,settings).prices,{wholesale:1100,factory:1650,retail:2200});
 assert.equal(calculateManufacturing({...production,base:production},settings).cost,11);
 const repeated={...production,materials:Array.from({length:3},()=>({...filament,purchasePrice:1,purchaseQuantity:3,quantity:1,unit:'kg' as const}))};
 assert.equal(calculateManufacturing(repeated,settings).cost,1);
 const legacy={machineSeconds:3600,humanSeconds:600,materialGrams:50,extras:1,packaging:2,label:1};
 assert.equal(calculateManufacturing(legacy,{...settings,filamentKgPrice:'100',energyHour:'1',wearHour:'2',humanHour:'30'}).cost,17);
 assert.equal(calculateManufacturing({...production,materials:[{...filament,unit:'ml'}]},settings).cost,null);
 const fractional={...settings,filamentKgPrice:'100',energyHour:'0.01',humanHour:'0.01',wholesaleMarkup:'1.5',factoryMarkup:'2.5',retailMarkup:'3.5'};
 const oldFractional={machineSeconds:3600,humanSeconds:3600,materialGrams:0.1,extras:0.06,packaging:0,label:0};
 assert.deepEqual(calculateManufacturing(oldFractional,fractional).prices,{wholesale:14,factory:22,retail:32});
 const newFractional={...oldFractional,materialGrams:0,extras:0,materials:[{...filament,quantity:0.1},{...direct,quantity:0.06}]};
 assert.deepEqual(calculateManufacturing(newFractional,fractional).prices,{wholesale:14,factory:23,retail:32});
 assert.equal(emptyProduction().materials?.length,0);
});

test('base reutilizável persiste, protege revisões e não altera snapshots, preços ou dados legados de produtos',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'materials-'));const options={dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local' as const};let app=await createApp(options);
 const send=(path:string,payload:object,method:'POST'|'PUT'='POST')=>app.inject({method,url:path,payload});
 try{
  assert.equal((await send('/api/settings/fabricacao',{data:settings,expectedRevision:0},'PUT')).statusCode,200);
  const made=await send('/api/products/editor',{product:{...product,manufacturing:production},applyPrices:false});assert.equal(made.statusCode,200,made.body);const saved=made.json();
  assert.deepEqual(saved.prices,product.prices);assert.equal(saved.family,product.family);assert.equal(saved.manufacturing.materials.length,3);
  const library=(await app.inject('/api/materials')).json();assert.equal(library.length,3);assert.ok(saved.manufacturing.materials.every((m:any)=>m.materialId&&m.materialRevision===1));
  const material=library.find((m:any)=>m.name===filament.name);const changed=await send(`/api/materials/${material.id}`,{...definitionOf(material),purchasePrice:200,expectedRevision:1},'PUT');assert.equal(changed.statusCode,200,changed.body);assert.equal(changed.json().revision,2);
  assert.equal((await send(`/api/materials/${material.id}`,{...definitionOf(material),purchasePrice:400,expectedRevision:1},'PUT')).statusCode,409);
  assert.equal((await send('/api/materials',definitionOf(material))).statusCode,409);
  assert.equal((await send('/api/materials',{...definitionOf(filament),name:'Referência inválida',purchaseQuantity:0})).statusCode,400);
  assert.equal((await send('/api/materials',{...definitionOf(filament),name:'Unidade específica',purchaseUnit:'custom',customUnit:''})).statusCode,400);
  let fromProduct=(await app.inject('/api/products')).json()[0];assert.equal(fromProduct.manufacturing.materials[0].purchasePrice,100);assert.equal(calculateManufacturing(fromProduct.manufacturing,settings).cost,5.5);assert.deepEqual(fromProduct.prices,product.prices);
  const {id,updatedAt,...body}=fromProduct;
  const applied=await send(`/api/products/${id}/editor`,{product:body,applyPrices:false,applyTiers:['retail'],expectedUpdatedAt:updatedAt,expectedSettingsRevision:1},'PUT');assert.equal(applied.statusCode,200,applied.body);assert.deepEqual(applied.json().prices,{wholesale:1000,factory:2000,retail:2200});
  const legacy={machineSeconds:3600,humanSeconds:600,materialGrams:50,extras:1,packaging:2,label:1};
  const old=await send('/api/products/editor',{product:{...product,name:'Legado fictício',manufacturing:legacy},applyPrices:false});assert.equal(old.statusCode,200,old.body);assert.deepEqual(old.json().manufacturing,legacy);
  await app.close();app=await createApp(options);fromProduct=(await app.inject('/api/products')).json().find((p:any)=>p.id===id);assert.equal(fromProduct.manufacturing.materials[0].purchasePrice,100);assert.equal((await app.inject('/api/materials')).json().find((m:any)=>m.id===material.id).purchasePrice,200);
  assert.equal((await app.inject('/api/products')).json().find((p:any)=>p.name==='Legado fictício').manufacturing.materialGrams,50);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('prévia de importação não cria materiais e cálculo inválido não grava produto ou referência',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'materials-import-'));const app=await createApp({dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local'});
 try{
  const incoming={...product,sourceKeys:['excel:synthetic-materials'],manufacturing:production};
  const preview=await app.inject({method:'POST',url:'/api/products/import',payload:{products:[incoming],confirm:false}});assert.equal(preview.statusCode,200,preview.body);assert.equal((await app.inject('/api/materials')).json().length,0);
  const imported=await app.inject({method:'POST',url:'/api/products/import',payload:{products:[incoming],confirm:true}});assert.equal(imported.statusCode,200,imported.body);assert.equal((await app.inject('/api/materials')).json().length,3);
  assert.equal((await app.inject('/api/products')).json()[0].manufacturing.materials[0].purchasePrice,100);
  const invalid=await app.inject({method:'POST',url:'/api/products/editor',payload:{product:{...product,name:'Inválido',manufacturing:{...production,materials:[{...filament,name:'Não cadastrar',unit:'ml'}]}},applyPrices:true,expectedSettingsRevision:0}});assert.equal(invalid.statusCode,400);assert.equal((await app.inject('/api/materials')).json().length,3);assert.equal((await app.inject('/api/products')).json().length,1);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});


test('materiais de produto usado apenas no orçamento são reutilizáveis sem criar produto nem substituir a base',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'materials-adhoc-'));const app=await createApp({dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local'});
 try{
  const remember=(materials:MaterialUse[])=>app.inject({method:'POST',url:'/api/materials/remember',payload:{materials}});
  assert.equal((await remember([filament])).statusCode,200);
  assert.equal((await app.inject('/api/products')).json().length,0);assert.equal((await app.inject('/api/materials')).json()[0].purchasePrice,100);
  assert.equal((await remember([{...filament,purchasePrice:200}])).statusCode,200);assert.equal((await app.inject('/api/materials')).json().length,1);assert.equal((await app.inject('/api/materials')).json()[0].purchasePrice,100);
  assert.equal((await remember([{...filament,name:'Não criar'}, {...thread,unit:'kg'}])).statusCode,400);assert.equal((await app.inject('/api/materials')).json().length,1);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
