import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.js';
import {loadConfig} from '../server/config.js';
import {searchProducts,searchText} from '../src/ListPagination.js';

test('busca combinada por nome/SKU prioriza código exato e preserva a ordem dos demais',()=>{
 const products=[{name:'Capa ação',sku:'ABC-12'},{name:'ABC de teste',sku:'outro'},{name:'Código exato',sku:'abc'}];
 assert.deepEqual(searchProducts(products,' ABC ').map(p=>p.name),['Código exato','Capa ação','ABC de teste']);
 assert.equal(searchProducts(products,'ACAO')[0].name,'Capa ação');
 assert.equal(searchProducts(products,'inexistente').length,0);
 assert.equal(searchText('  Contáto '),'contato');
});
test('preferências por área persistem isoladamente, preservam dados anteriores e validam tamanhos',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'interface-settings-'));
 const options={dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local' as const};
 let app=await createApp(options);
 try{
  for(const [area,key,value] of [['clientes','clientsPerPage','30'],['produtos','productsPerPage','all'],['orcamentos','quotesPerPage','50']]){
   assert.equal((await app.inject({method:'PUT',url:`/api/settings/${area}`,payload:{data:{[key]:value},expectedRevision:0}})).statusCode,200);
  }
  assert.equal((await app.inject({method:'PUT',url:'/api/settings/clientes',payload:{data:{productsPerPage:'20'},expectedRevision:1}})).statusCode,400);
  assert.equal((await app.inject({method:'PUT',url:'/api/settings/produtos',payload:{data:{productsPerPage:'15'},expectedRevision:1}})).statusCode,400);
  assert.equal((await app.inject({method:'PUT',url:'/api/settings/clientes',payload:{data:{clientsPerPage:'20'},expectedRevision:0}})).statusCode,409);
  await app.close();app=await createApp(options);
  assert.equal((await app.inject('/api/settings/clientes')).json().data.clientsPerPage,'30');
  assert.equal((await app.inject('/api/settings/produtos')).json().data.productsPerPage,'all');
  assert.equal((await app.inject('/api/settings/orcamentos')).json().data.quotesPerPage,'50');
  for(const size of ['10','20','30','40','50','all'])assert.equal((await app.inject(`/api/quotes?pageSize=${size}`)).statusCode,200);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
