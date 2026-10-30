// Rehearses the actual previous pilot source, not a hand-written approximation of its schema.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,rmSync,symlinkSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createPilotApp} from '../server/pilot/app.ts';
import {PilotStore} from '../server/pilot/store.ts';
import {calculateManufacturing} from '../server/manufacturing-model.ts';
const previous='6bbb964f8927e378e224dbfc8a422517a5baa5de';
const temp=mkdtempSync(join(tmpdir(),'pilot-upgrade-rehearsal-')),oldRoot=join(temp,'old-source'),dataDir=join(temp,'data'),backupDir=join(temp,'backup'),restored=join(temp,'restored'),output=join(temp,'fixture.json');
let app;
try{
 mkdirSync(oldRoot);const archive=execFileSync('git',['archive',previous,'apps/umdoislab'],{cwd:resolve('../..'),maxBuffer:16*1024*1024});execFileSync('tar',['-x','-C',oldRoot],{input:archive});
 const oldApp=join(oldRoot,'apps/umdoislab');symlinkSync(resolve('node_modules'),join(oldApp,'node_modules'),'dir');
 execFileSync(process.execPath,['scripts/prepare-pilot-metadata.mjs'],{cwd:oldApp});
 const helper=resolve('scripts/pilot-upgrade-fixture.mjs'),env={...process.env,PILOT_UPGRADE_FIXTURE:'1',PILOT_UPGRADE_STATIC:resolve('dist')};
 const oldRun=(data,phase)=>execFileSync(process.execPath,['--import','tsx',helper,oldApp,data,output,phase],{cwd:oldApp,env,encoding:'utf8',maxBuffer:1024*1024});
 process.stdout.write(oldRun(dataDir,'seed'));cpSync(dataDir,backupDir,{recursive:true});
 const migratedView=records=>records.map(record=>({catalogVisible:false,...record}));
 const manifest=JSON.parse(readFileSync(output,'utf8')),origin='https://upgrade.example.test',prefix='/artesaos-piloto/';
 const config={publicUrl:new URL(origin+prefix),prefix,dataDir,staticDir:resolve('dist'),clientId:'fixture',clientSecret:'fixture',sessionHours:8,idleMinutes:30,maxUsers:5,adminEmails:['admin@example.test']};
 app=await createPilotApp(config,{async start(){throw Error('Not used');},async complete(){throw Error('Not used');}});
 const request=(path,headers={},method='GET',payload)=>app.inject({url:prefix+path,method,headers:{host:'upgrade.example.test',...headers},...(payload===undefined?{}:{payload})});
 const json=async(path,headers,method,payload)=>{const r=await request(path,headers,method,payload);assert.equal(r.statusCode,200,r.body);return r.json();};
 for(const account of manifest.accounts){
  assert.deepEqual(await json('api/products',account.headers),migratedView(account.products),'new catalog flag defaults to false; existing fields must be preserved');
  assert.deepEqual(await json('api/records/products/archived',account.headers),account.archivedProducts);
  assert.deepEqual(await json('api/clients',account.headers),[account.client]);
  assert.deepEqual((await json('api/quotes/'+account.quote.id,account.headers)).data,account.quote.data);
  assert.equal((await json('api/manufacturing/material-upgrade',account.headers)).complete,false);
  assert.equal((await json('api/materials',account.headers)).length,0);
 }
 const material=account=>({name:'Material '+account.name,mode:'quantity',purchaseQuantity:1,purchasePrice:Number(account.settings.filamentKgPrice),purchaseUnit:'kg',customUnit:''});
 const [a,b]=manifest.accounts;
 await json('api/materials',a.headers,'POST',material(a));
 assert.equal((await json('api/manufacturing/material-upgrade',a.headers)).complete,true);
 assert.equal((await json('api/manufacturing/material-upgrade',b.headers)).complete,false);
 const invalidReference=await json('api/materials',b.headers,'POST',{...material(b),purchaseUnit:'m'});
 assert.equal((await json('api/manufacturing/material-upgrade',b.headers)).complete,false);
 assert.deepEqual(await json('api/products',b.headers),migratedView(b.products));
 await json('api/materials/'+invalidReference.id,b.headers,'PUT',{...material(b),expectedRevision:invalidReference.revision});
 const updated=[];
 for(const account of manifest.accounts){
  const products=await json('api/products',account.headers),p=products[0],old=account.products[0];
  assert.equal(p.name,old.name);assert.equal(p.sku,old.sku);assert.equal(p.description,old.description);assert.deepEqual(p.prices,old.prices,'stored prices are never replaced by the migration');
  const calculation=calculateManufacturing(p.manufacturing,account.settings);assert.equal(calculation.cost,account.beforeCost);assert.deepEqual(calculation.prices,account.beforePrices);
  assert.equal(p.manufacturing.materials[0].purchasePrice,Number(account.settings.filamentKgPrice));
  const status=await json('api/manufacturing/material-upgrade',account.headers);assert.equal(status.changed,2);assert.equal(status.complete,true);
  assert.equal((await json('api/materials',account.headers)).length,1);
  const control=new PilotStore(dataDir),tenant=control.db.prepare('SELECT tenant_id FROM pilot_users WHERE id=?').get(account.headers['x-pilot-context']);control.close();
  const db=new DatabaseSync(join(dataDir,'tenants',String(tenant.tenant_id),'validation.sqlite'));
  try{const saved=JSON.parse(String(db.prepare('SELECT data FROM manufacturing_material_backup WHERE product_id=?').get(old.id).data));for(const key of ['name','sku','prices','manufacturing','description'])assert.deepEqual(saved[key],old[key]);}finally{db.close();}
  const forbidden=await request('api/materials',{...account.headers,'x-pilot-context':account===a?b.headers['x-pilot-context']:a.headers['x-pilot-context']});assert.equal(forbidden.statusCode,409);
  updated.push(products);
 }
 assert.equal((await json('admin/api/interests',manifest.admin)).records[0].email,'previous@example.test','interest encryption/key and admin session survive');
 assert.equal((await request('admin/api/interests',a.headers)).statusCode,401);
 await app.close();app=await createPilotApp(config,{async start(){throw Error();},async complete(){throw Error();}});
 for(const [index,account] of manifest.accounts.entries()){assert.deepEqual(await json('api/products',account.headers),updated[index]);assert.equal((await json('api/manufacturing/material-upgrade',account.headers)).changed,2);}
 await app.close();app=undefined;
 cpSync(backupDir,restored,{recursive:true});process.stdout.write(oldRun(restored,'inspect'));
 process.stdout.write('PASS: atualização real da base 0.1.19→0.1.23 em duas contas, cópia anterior/restore, cálculos, preços salvos, arquivados, clientes/orçamentos, materiais isolados, referência inválida, reinício idempotente, administração e contatos preservados.\n');
}finally{await app?.close();rmSync(temp,{recursive:true,force:true});}
