import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.js';
import {loadConfig} from '../server/config.js';
import {importPayload} from '../src/ProductSettings.js';
const product={name:'Peça fictícia',origin:'own',publicAllowed:false,prices:{wholesale:1000,factory:null,retail:null},lengthCm:null,widthCm:null,heightCm:null,weightGrams:null,colors:[],sourceKeys:[],family:'',description:'Preservar',category:'Linha > Peças'};
test('categorias: migra valores, renomeia hierarquia, preserva preços, reserva cliente e importa sem duplicar',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'categories-'));const options={dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local' as const};
 const old=new DatabaseSync(join(dir,'validation.sqlite'));old.exec('CREATE TABLE products(id INTEGER PRIMARY KEY,data TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL)');old.prepare('INSERT INTO products(data,updated_at) VALUES (?,?)').run(JSON.stringify(product),'2026-01-01');old.close();
 let app=await createApp(options);const send=(url:string,payload:object,method:'POST'|'PUT'='POST')=>app.inject({method,url,payload});
 try{
  const list=()=>app.inject('/api/categories');const categories=(await list()).json();assert.equal(categories.length,3);
  const reserved=categories.find((c:{reserved:number})=>c.reserved);assert.equal((await send(`/api/categories/${reserved.id}`,{path:'Alterada',expectedRevision:1},'PUT')).statusCode,400);
  const parent=categories.find((c:{path:string})=>c.path==='Linha');assert.equal((await send(`/api/categories/${parent.id}`,{path:'Coleção',expectedRevision:1},'PUT')).statusCode,200);
  const saved=(await app.inject('/api/products')).json()[0];assert.equal(saved.category,'Coleção > Peças');assert.equal(saved.prices.wholesale,1000);assert.equal(saved.description,'Preservar');
  assert.equal((await send(`/api/categories/${parent.id}`,{path:'Outra',expectedRevision:1},'PUT')).statusCode,409);
  const batch={categories:['Headshop > Capas','headshop > capas','Headshop > Outras'],confirm:false};
  assert.equal((await send('/api/categories/import',batch)).json().toCreate,3);assert.equal((await list()).json().length,3);
  assert.equal((await send('/api/categories/import',{...batch,confirm:true})).json().created,3);assert.equal((await send('/api/categories/import',{...batch,confirm:true})).json().created,0);
  assert.equal((await send('/api/categories/import',{categories:['Nova','Produtos de cliente'],confirm:true})).statusCode,400);assert.ok(!(await list()).json().some((c:{path:string})=>c.path==='Nova'));
  assert.equal((await send('/api/products/import',{products:[{...product,name:'Importado',sourceKeys:['fake:1']}],confirm:true})).statusCode,200);
  assert.equal((await send('/api/products/import',{products:[{...product,name:'Importado',sourceKeys:['fake:2']}],confirm:true})).statusCode,409);
  await app.close();app=await createApp(options);assert.equal((await app.inject('/api/products')).json().find((p:{id:number})=>p.id===1).category,'Coleção > Peças');assert.ok((await list()).json().some((c:{path:string})=>c.path==='Headshop > Outras'));
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('identifica conteúdo e rejeita formatos desconhecidos ou CSV inválido',()=>{
 const csv='ID,Tipo,Nome,Categorias,Publicado\r\n1,simple,"Nome, com vírgula","Headshop > Capas, Headshop",1\r\n2,simple,"Com\nquebra",Headshop,0';
 const data=importPayload(csv);assert.equal(data.type,'categories');assert.ok('categories' in data&&data.categories.includes('Headshop > Capas'));
 assert.equal(importPayload('ID,Tipo,Nome,Categorias,Publicado,Atributo opcional\n1,simple,Peça,Categoria,1').type,'categories');
 assert.equal(importPayload('{"products":[{}]}').type,'products');assert.equal(importPayload('{"type":"categories","categories":["A > B"]}').type,'categories');
 assert.throws(()=>importPayload('{"clients":[]}'),/não reconhecido/);assert.throws(()=>importPayload('ID,Nome\n1,Teste'),/não reconhecido/);assert.throws(()=>importPayload('ID,Tipo,Nome,Categorias,Publicado\n1,simple,"incompleto'),/aspas/);
});
