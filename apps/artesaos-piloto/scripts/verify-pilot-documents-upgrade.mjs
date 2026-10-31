// Disposable data only. Exercises 0.1.14 -> current -> full data restore with 0.1.14.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,symlinkSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createApp as currentApp} from '../server/app.ts';
const temp=mkdtempSync(join(tmpdir(),'pilot-upgrade-')),root=resolve('../..'),legacy=join(temp,'legacy');mkdirSync(legacy);
let app;
try{
 const archive=execFileSync('git',['archive','22db072','apps/umdoislab'],{cwd:root,maxBuffer:40*1024*1024});execFileSync('tar',['-x','-C',legacy],{input:archive});
 const legacyRoot=join(legacy,'apps/umdoislab');symlinkSync(resolve('node_modules'),join(legacyRoot,'node_modules'),'dir');
 const {createApp:oldApp}=await import(pathToFileURL(join(legacyRoot,'server/app.ts')).href);
 const dataDir=join(temp,'data'),backup=join(temp,'backup'),options={dataDir,staticDir:resolve('dist'),mode:'local',pilotFeatures:true,logRequests:false};
 app=await oldApp(options);
 await app.inject({method:'PUT',url:'/api/company',payload:{data:{name:'Empresa anterior',responsible:'Teste',phone:'11999990000',email:'teste@example.test'},expectedRevision:0}});
 const db=new DatabaseSync(join(dataDir,'validation.sqlite'));db.prepare('INSERT INTO pilot_onboarding VALUES(1,?)').run(new Date().toISOString());db.close();
 const data={status:'finalized',client:{id:1,name:'Cliente antigo',contact:'',phone:'',email:'',taxDocument:'',postal:''},items:[{id:1,name:'Item antigo',productId:null,origin:'own',prices:{wholesale:null,factory:null,retail:1000},priceKey:'retail',quantity:'2',lengthCm:null,widthCm:null,heightCm:null,weightGrams:null,packaging:'none',packagingType:'',packagingAmount:'',packagingIncluded:false}],notes:'Preservar',delivery:{mode:'pickup',carrier:'',amount:'0',notes:''}};
 const made=await app.inject({method:'POST',url:'/api/quotes',payload:{data,expectedRevision:0}});assert.equal(made.statusCode,200,made.body);const id=made.json().id;
 const original=(await app.inject(`/api/quotes/${id}`)).json();await app.close();app=null;cpSync(dataDir,backup,{recursive:true});
 app=await currentApp(options);assert.deepEqual((await app.inject(`/api/quotes/${id}`)).json(),original);
 assert.deepEqual((await app.inject(`/api/quotes/${id}/documents`)).json(),[]);assert.equal((await app.inject(`/api/quotes/${id}/document`)).statusCode,404);
 assert.equal((await app.inject({method:'PUT',url:`/api/quotes/${id}`,payload:{data:{...original.data,status:'draft'},expectedRevision:1}})).statusCode,200);
 assert.equal((await app.inject({method:'PUT',url:`/api/quotes/${id}`,payload:{data:original.data,expectedRevision:2}})).statusCode,200);
 assert.equal((await app.inject(`/api/quotes/${id}/documents`)).json().length,1);
 await app.close();app=null;
 rmSync(dataDir,{recursive:true});cpSync(backup,dataDir,{recursive:true});app=await oldApp(options);
 assert.deepEqual((await app.inject(`/api/quotes/${id}`)).json(),original);
 assert.equal((await app.inject('/api/company')).json().data.name,'Empresa anterior');
 console.log('PASS: upgrade from published 0.1.14 preserves existing quote; no invented snapshot; new finalization captures document; full stopped-data restore works with original 0.1.14 code. Disposable SQLite fixture only, not real HA volume.');
}finally{if(app)await app.close();rmSync(temp,{recursive:true,force:true});}
