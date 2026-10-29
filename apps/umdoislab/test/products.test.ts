import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.js';
import {loadConfig} from '../server/config.js';
const product=(name='Peça')=>({name,origin:'own',publicAllowed:false,prices:{wholesale:null,factory:null,retail:3250},weightGrams:null,lengthCm:null,widthCm:null,heightCm:null,colors:[],sourceKeys:[] as string[],family:'',description:''});
test('catálogo: validação, persistência, importação atômica, repetição e preservação de edições',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'catalog-'));
 let app=await createApp({dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local'});
 const send=(body:unknown)=>app.inject({method:'POST',url:'/api/products',payload:body as object});
 const batch=(products:unknown[],confirm=false)=>app.inject({method:'POST',url:'/api/products/import',payload:{products,confirm}});
 try{
  for(const body of [{...product(),name:'  '},{...product(),origin:''},{...product(),prices:{wholesale:null,factory:null,retail:null}},{...product(),prices:{wholesale:null,factory:null,retail:1.5}},{...product(),origin:'client',publicAllowed:true}])assert.equal((await send(body)).statusCode,400);
  assert.equal((await send({...product(),prices:{wholesale:1200,factory:null,retail:null}})).statusCode,200);
  const a={...product('Importado'),category:'Capas para Isqueiros',sourceKeys:['site:1','site:2']};
  assert.equal((await batch([a])).json().toCreate,1);
  assert.equal((await app.inject('/api/products')).json().length,1);
  assert.equal((await batch([a,{...product(),sourceKeys:['site:3'],name:''}],true)).statusCode,400);
  assert.equal((await app.inject('/api/products')).json().length,1);
  assert.equal((await batch([a],true)).json().created,1);
  assert.equal((await batch([{...a,sourceKeys:['site:1','site:4']}],true)).statusCode,409);
  const saved=(await app.inject('/api/products')).json()[0];
  const {id,updatedAt,...body}=saved;
  assert.equal((await app.inject({method:'PUT',url:`/api/products/${id}`,payload:{...body,prices:{...body.prices,retail:9999}}})).statusCode,200);
  assert.equal((await app.inject('/api/products')).json()[0].category,'Capas para Isqueiros');
  assert.equal((await batch([a],true)).json().skipped,1);
  assert.equal((await app.inject('/api/products')).json()[0].prices.retail,9999);
  await app.close();app=await createApp({dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local'});
  assert.equal((await app.inject('/api/products')).json().length,2);
  assert.equal((await app.inject({method:'DELETE',url:`/api/products/${id}`})).statusCode,200);
  assert.equal((await batch([a],true)).json().created,0);
  assert.equal((await app.inject('/api/products')).json().length,1);
  assert.equal((await batch([a,a],true)).statusCode,400);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
