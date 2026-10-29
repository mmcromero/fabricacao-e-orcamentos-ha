import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyPackage,estimatePackage} from '../src/package-estimate.js';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.js';
import {loadConfig} from '../server/config.js';
const physical={quantity:'2',weightGrams:100,lengthCm:2,widthCm:3,heightCm:4,packaging:'with',packagingWeightGrams:5,packagingLengthCm:3,packagingWidthCm:4,packagingHeightCm:5};
test('soma pesos e volumes conhecidos, não inventa dimensões, distingue medidas reais e pendências',()=>{
 const result=estimatePackage([physical],{...emptyPackage(),boxWeightGrams:'20',protectionWeightGrams:'10',weightGrams:'250',lengthCm:'10',widthCm:'8',heightCm:'6'});
 assert.equal(result.productGrams,200);assert.equal(result.productVolumeCm3,48);assert.equal(result.occupiedVolumeCm3,120);assert.equal(result.estimatedGrams,240);assert.equal(result.actualWeight,250);assert.deepEqual(result.actualDimensions,[10,8,6]);assert.equal(result.pending.length,0);
 const incomplete=estimatePackage([{...physical,weightGrams:null,heightCm:null,packagingWeightGrams:null}],emptyPackage());assert.equal(incomplete.productGrams,0);assert.equal(incomplete.productVolumeCm3,0);assert.equal(incomplete.actualDimensions,null);assert.ok(incomplete.pending.includes('Peso de produto pendente'));assert.ok(incomplete.pending.includes('Peso da embalagem individual pendente'));
 assert.ok(estimatePackage([{...physical,quantity:'1.5'}],emptyPackage()).pending.includes('Quantidade de produto pendente'));
});
test('pacote opcional persiste, dados inválidos são rejeitados e finalizados antigos podem reabrir',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'package-'));const options={dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local' as const};let app=await createApp(options);
 const client={id:1,name:'Cliente fictício',contact:'',phone:'',email:'',taxDocument:'',postal:''};
 const item={...physical,id:1,name:'Peça',origin:'own',productId:null,prices:{wholesale:1000,factory:null,retail:null},priceKey:'wholesale',packaging:'none',packagingType:'',packagingAmount:'',packagingIncluded:false};
 const data={client,items:[item],notes:'Preservar',status:'finalized',delivery:{mode:'pickup',carrier:'',amount:'0',notes:''}};
 try{
  const response=await app.inject({method:'POST',url:'/api/quotes',payload:{data,expectedRevision:0}});assert.equal(response.statusCode,200);const id=response.json().id;
  let saved=(await app.inject(`/api/quotes/${id}`)).json();
  assert.equal((await app.inject({method:'PUT',url:`/api/quotes/${id}`,payload:{data:{...saved.data,status:'draft'},expectedRevision:1}})).statusCode,200);
  saved=(await app.inject(`/api/quotes/${id}`)).json();const pack={...emptyPackage(),weightGrams:'250',lengthCm:'10'};
  assert.equal((await app.inject({method:'PUT',url:`/api/quotes/${id}`,payload:{data:{...saved.data,package:pack},expectedRevision:2}})).statusCode,200);
  assert.equal((await app.inject({method:'PUT',url:`/api/quotes/${id}`,payload:{data:{...saved.data,package:{weightGrams:'-1'}},expectedRevision:3}})).statusCode,400);
  await app.close();app=await createApp(options);saved=(await app.inject(`/api/quotes/${id}`)).json();assert.deepEqual(saved.data.package,pack);assert.equal(saved.data.notes,'Preservar');assert.equal(saved.data.items[0].prices.wholesale,1000);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
