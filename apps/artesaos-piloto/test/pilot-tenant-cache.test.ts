import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {TenantCache,TenantCapacityError} from '../server/pilot/tenant-cache.js';
import {createApp} from '../server/app.js';
test('cache limita bancos abertos, reabre conta preservada e não limita o cadastro de contas',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'tenant-cache-'));let created=0,closed=0;
 const cache=new TenantCache(async id=>{created++;const app=await createApp({dataDir:join(dir,id),staticDir:resolve('dist'),mode:'local',pilotFeatures:true,logRequests:false});app.addHook('onClose',async()=>{closed++;});return app;},2);
 try{
  await cache.use('a',app=>app.inject({method:'PUT',url:'/api/company',payload:{data:{name:'Empresa A',responsible:'Pessoa A',phone:'11999990000',email:'a@example.test'},expectedRevision:0}}));
  for(const id of ['b','c','d','e','f','g'])await cache.use(id,app=>app.inject('/api/company'));
  const result=await cache.use('a',app=>app.inject('/api/company'));assert.equal(result.json().data.name,'Empresa A');assert.equal(result.json().revision,1);assert.equal(created-closed,2);assert.equal(created,8);
 }finally{await cache.close();assert.equal(created,closed);rmSync(dir,{recursive:true,force:true});}
});
test('cache não encerra conta em uso; lotação é temporária e falha de inicialização permite nova tentativa',async()=>{
 let release!:()=>void,entered!:()=>void;const enteredPromise=new Promise<void>(r=>entered=r),gate=new Promise<void>(r=>release=r),closed:string[]=[];let failures=1;
 const cache=new TenantCache(async id=>{if(id==='bad'&&failures-->0)throw Error('Synthetic failure');return {close:async()=>{closed.push(id);}} as any;},1);
 try{
  const running=cache.use('a',async()=>{entered();await gate;return 'done';});await enteredPromise;await assert.rejects(()=>cache.use('b',async()=>''),TenantCapacityError);assert.equal(closed.length,0);release();assert.equal(await running,'done');
  await assert.rejects(()=>cache.use('bad',async()=>''),/Synthetic/);assert.deepEqual(closed,['a']);assert.equal(await cache.use('bad',async()=>42),42);
 }finally{release();await cache.close();}
 await assert.rejects(()=>cache.use('after-close',async()=>''),TenantCapacityError);
});
