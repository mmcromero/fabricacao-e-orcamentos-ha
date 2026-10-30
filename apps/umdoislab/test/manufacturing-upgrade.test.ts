import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.js';
import {loadConfig} from '../server/config.js';
import {calculateManufacturing,emptyProduction,markupRanges} from '../server/manufacturing-model.js';
import {emptyMaterial} from '../server/material-model.js';
const settings={energyHour:'0',wearHour:'0',humanHour:'0',productiveHours:'100',wholesaleMarkup:'1.5',factoryMarkup:'2.5',retailMarkup:'3.5'};
const step={machineSeconds:0,humanSeconds:0,materialGrams:20,extras:1,packaging:2,label:0};
const product={name:'Produto antigo fictício',origin:'own',publicAllowed:false,catalogVisible:true,prices:{wholesale:1234,factory:2345,retail:3456},weightGrams:20,lengthCm:null,widthCm:null,heightCm:null,colors:[],sourceKeys:[],family:'Preservar',description:'Referência antiga',category:'',manufacturing:{...step,base:{...step,materialGrams:10,extras:0}}};
const reference={...emptyMaterial(),name:'Z primeiro material',purchaseQuantity:1,purchasePrice:200,purchaseUnit:'kg' as const};
function prepare(){const dir=mkdtempSync(join(tmpdir(),'upgrade-material-'));const db=new DatabaseSync(join(dir,'validation.sqlite'));db.exec('CREATE TABLE products(id INTEGER PRIMARY KEY,data TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL); CREATE TABLE materials(id INTEGER PRIMARY KEY,material_key TEXT UNIQUE NOT NULL,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL)');db.prepare('INSERT INTO products VALUES (1,?,0,?)').run(JSON.stringify(product),'2026-01-01T00:00:00.000Z');return {dir,db,options:{dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local' as const}};}

test('migração única usa o menor ID, converte etapas/arquivados, preserva preços e cópia original; novos registros ficam fora',async()=>{
 const {dir,db,options}=prepare();const modern={...product,name:'Já usa materiais',manufacturing:{...emptyProduction(),machineSeconds:0,humanSeconds:0,materials:[]}};
 db.prepare('INSERT INTO products VALUES (2,?,1,?)').run(JSON.stringify({...product,name:'Arquivado'}),'2026-01-01T00:00:00.000Z');db.prepare('INSERT INTO products VALUES (3,?,0,?)').run(JSON.stringify(modern),'2026-01-01T00:00:00.000Z');
 for(const [id,name,price] of [[4,'Z primeiro material',200],[7,'A segundo material',999]] as const)db.prepare('INSERT INTO materials VALUES (?,?,?,?,?)').run(id,name,JSON.stringify({...reference,name,purchasePrice:price}),1,'2026-01-01T00:00:00.000Z');db.close();let app=await createApp(options);
 try{
  const saved=(await app.inject('/api/products')).json().find((p:any)=>p.id===1);assert.deepEqual(saved.prices,product.prices);assert.equal(saved.description,product.description);assert.equal(saved.catalogVisible,true);assert.equal(saved.manufacturing.materials[0].materialId,4);assert.equal(saved.manufacturing.materials[0].purchasePrice,200);assert.equal(saved.manufacturing.materials[0].quantity,20);assert.equal(saved.manufacturing.materials[0].unit,'g');assert.equal(saved.manufacturing.base.materials[0].quantity,10);assert.equal(saved.manufacturing.extras,0);assert.equal(calculateManufacturing(saved.manufacturing,{...settings,filamentKgPrice:'9999'}).cost,11);
  let status=(await app.inject('/api/manufacturing/material-upgrade')).json();assert.equal(status.complete,true);assert.equal(status.changed,2);assert.equal(status.reference.id,4);
  const inspect=new DatabaseSync(join(dir,'validation.sqlite'));assert.deepEqual(JSON.parse(String(inspect.prepare('SELECT data FROM manufacturing_material_backup WHERE product_id=1').get()!.data)),product);assert.ok(JSON.parse(String(inspect.prepare('SELECT data FROM products WHERE id=2').get()!.data)).manufacturing.materials);assert.deepEqual(JSON.parse(String(inspect.prepare('SELECT data FROM products WHERE id=3').get()!.data)),modern);inspect.close();
  const created=await app.inject({method:'POST',url:'/api/products/editor',payload:{product:{...product,name:'Novo legado via integração'},applyPrices:false}});assert.equal(created.statusCode,200,created.body);assert.equal(created.json().manufacturing.materials,undefined);
  const changed=await app.inject({method:'PUT',url:'/api/materials/4',payload:{...reference,purchasePrice:400,expectedRevision:1}});assert.equal(changed.statusCode,200,changed.body);
  await app.close();app=await createApp(options);const again=(await app.inject('/api/products')).json();assert.equal(again.find((p:any)=>p.id===1).manufacturing.materials[0].purchasePrice,200);assert.equal(again.find((p:any)=>p.id===created.json().id).manufacturing.materials,undefined);status=(await app.inject('/api/manufacturing/material-upgrade')).json();assert.equal(status.changed,2);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('migração pendente não inventa conversão e não captura novos produtos antes do primeiro material válido',async()=>{
 const {dir,db,options}=prepare();db.close();const app=await createApp(options);
 try{
  assert.equal((await app.inject('/api/manufacturing/material-upgrade')).json().complete,false);
  const modern=await app.inject({method:'POST',url:'/api/products/editor',payload:{product:{...product,name:'Novo sem materiais',manufacturing:{...emptyProduction(),machineSeconds:0,humanSeconds:0}},applyPrices:false}});assert.equal(modern.statusCode,200,modern.body);
  const first=await app.inject({method:'POST',url:'/api/materials',payload:{...reference,purchaseUnit:'m'}});assert.equal(first.statusCode,200,first.body);
  assert.equal((await app.inject('/api/manufacturing/material-upgrade')).json().complete,false);assert.equal((await app.inject('/api/products')).json().find((p:any)=>p.id===1).manufacturing.materials,undefined);
  const changed=await app.inject({method:'PUT',url:`/api/materials/${first.json().id}`,payload:{...reference,purchaseUnit:'g',purchaseQuantity:1000,expectedRevision:1}});assert.equal(changed.statusCode,200,changed.body);
  const result=(await app.inject('/api/products')).json();assert.equal(result.find((p:any)=>p.id===1).manufacturing.materials[0].purchaseUnit,'g');assert.deepEqual(result.find((p:any)=>p.id===modern.json().id).manufacturing.materials,[]);assert.equal((await app.inject('/api/manufacturing/material-upgrade')).json().changed,1);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('multiplicadores aceitam limites e décimos, rejeitam valores fora da faixa sem gravar; preço global não é exibido',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'markup-limits-'));const app=await createApp({dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local'});let revision=0;
 try{
  for(const [key,{min,max}] of Object.entries(markupRanges)){
   for(const value of [min,max,min+0.1]){const response=await app.inject({method:'PUT',url:'/api/settings/fabricacao',payload:{data:{...settings,filamentKgPrice:'100',[key]:value.toFixed(1)},expectedRevision:revision}});assert.equal(response.statusCode,200,response.body);revision++;}
   for(const value of [min-0.1,max+0.1,min+0.01]){const response=await app.inject({method:'PUT',url:'/api/settings/fabricacao',payload:{data:{...settings,[key]:String(value)},expectedRevision:revision}});assert.equal(response.statusCode,400,response.body);assert.equal((await app.inject('/api/settings/fabricacao')).json().revision,revision);assert.equal(calculateManufacturing({...emptyProduction(),machineSeconds:0,humanSeconds:0},{...settings,[key]:String(value)}).cost,null);}
  }
  const invalidImport=await app.inject({method:'POST',url:'/api/products/reconcile',payload:{records:[{key:'synthetic',product}],settings:{wholesaleMarkup:'2.1'},applyConfiguration:true,confirm:false}});assert.equal(invalidImport.statusCode,400,invalidImport.body);
  assert.equal((await app.inject('/api/settings/fabricacao')).json().data.filamentKgPrice,undefined);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
