import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.js';
import {loadConfig} from '../server/config.js';
const product={name:'Produto fictício',origin:'client',publicAllowed:false,prices:{wholesale:1000,factory:null,retail:null},lengthCm:null,widthCm:null,heightCm:null,weightGrams:null,colors:[],sourceKeys:[],family:'',description:'',category:'Categoria anterior'};
test('migração sem perda, paginação no servidor, busca e categoria fixa por origem',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'round-'));
 const old=new DatabaseSync(join(dir,'validation.sqlite'));
 old.exec('CREATE TABLE quotes(id INTEGER PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0);CREATE TABLE products(id INTEGER PRIMARY KEY,data TEXT NOT NULL,archived INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL)');
 old.prepare('INSERT INTO quotes(data,updated_at) VALUES (?,?)').run(JSON.stringify({title:'AÇÃO antiga',client:null,items:[],notes:'Preservar'}),'2026-01-01');
 old.prepare('INSERT INTO products(data,updated_at) VALUES (?,?)').run(JSON.stringify(product),'2026-01-01');old.close();
 const options={dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local' as const};let app=await createApp(options);
 try{
  let list=(await app.inject('/api/products')).json();assert.equal(list[0].category,'Produtos de cliente');assert.equal(list[0].prices.wholesale,1000);
  assert.equal((await app.inject('/api/quotes?pageSize=10&search=acao')).json().total,1);
  for(let i=0;i<22;i++)assert.equal((await app.inject({method:'POST',url:'/api/quotes',payload:{data:{title:`Pedido fictício ${i}`,client:null,items:[],notes:''},expectedRevision:0}})).statusCode,200);
  const first=(await app.inject('/api/quotes?pageSize=10&page=1')).json();assert.equal(first.total,23);assert.equal(first.items.length,10);assert.equal(first.pages,3);assert.equal(first.items[0].id,23);assert.equal(first.items[0].data,undefined);
  const last=(await app.inject('/api/quotes?pageSize=10&page=999')).json();assert.equal(last.page,3);assert.equal(last.items.length,3);
  assert.equal((await app.inject('/api/quotes?pageSize=15')).json().items.length,15);
  assert.equal((await app.inject('/api/quotes?pageSize=20')).json().items.length,20);
  assert.equal((await app.inject('/api/quotes?pageSize=all')).json().items.length,23);
  assert.equal((await app.inject('/api/quotes?pageSize=11')).statusCode,400);
  assert.equal((await app.inject('/api/quotes')).json().length,23);
  const data=(await app.inject('/api/quotes/1')).json().data;assert.equal(data.notes,'Preservar');
  assert.equal((await app.inject({method:'PUT',url:'/api/quotes/1',payload:{data:{...data,title:'Renomeado 100%'},expectedRevision:1}})).statusCode,200);
  assert.equal((await app.inject('/api/quotes?pageSize=10&search=acao')).json().total,0);
  assert.equal((await app.inject('/api/quotes?pageSize=10&search=%25')).json().total,1);
  const config={data:{quotesPerPage:'20'},expectedRevision:0};assert.equal((await app.inject({method:'PUT',url:'/api/settings/orcamentos',payload:config})).statusCode,200);
  assert.equal((await app.inject({method:'POST',url:'/api/products',payload:{...product,origin:'own',category:''}})).statusCode,200);
  assert.equal((await app.inject({method:'PUT',url:'/api/products/1',payload:{...product,category:'Não usar'}})).statusCode,200);
  await app.close();app=await createApp(options);
  assert.equal((await app.inject('/api/settings/orcamentos')).json().data.quotesPerPage,'20');
  list=(await app.inject('/api/products')).json();assert.equal(list[0].category,'');assert.equal(list[1].category,'Produtos de cliente');
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
