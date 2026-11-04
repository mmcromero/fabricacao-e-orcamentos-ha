import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {offlineKey,offlineIdentity,offlineShell,offlineWorker} from '../server/pilot/offline.js';
import {createPilotApp} from '../server/pilot/app.js';
import {PilotStore,digest} from '../server/pilot/store.js';
import type {PilotConfig} from '../server/pilot/config.js';
const origin='https://offline.example.test',prefix='/artesaos-piloto/';
test('offline identity: stable persisted key; origin/account/tenant isolation; private files and no arbitrary paths',()=>{
 const dir=mkdtempSync(join(tmpdir(),'offline-key-'));try{const key=offlineKey(dir),config={prefix,publicUrl:new URL(origin+prefix)},a={userId:'account-a',tenantId:'tenant-a',email:'a@example.test'};assert.equal(statSync(join(dir,'.offline-key')).mode&0o777,0o600);assert.equal(key.length,32);assert.deepEqual(offlineKey(dir),key);const first=offlineIdentity(key,config,a,'21'),second=offlineIdentity(offlineKey(dir),config,a,'22');assert.equal(first.key,second.key);assert.equal(first.namespace,second.namespace);for(const changed of [{...a,userId:'b'},{...a,tenantId:'b'}]){const identity=offlineIdentity(key,config,changed,'21');assert.notEqual(identity.key,first.key);assert.notEqual(identity.namespace,first.namespace);}assert.notEqual(offlineIdentity(key,{...config,publicUrl:new URL('https://other.example.test'+prefix)},a,'21').namespace,first.namespace);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('offline shell/worker: anonymous build assets, scoped fallback only, no deletion or cached authenticated APIs',()=>{
 const config={prefix,staticDir:resolve('dist')},result=offlineShell(config,'test');assert.match(result.html,/data-offline-shell="true"/);assert.match(result.html,/<base href="\/artesaos-piloto\/">/);assert.doesNotMatch(result.html,/pilot-context|csrf|userId|tenantId/);assert.ok(result.descriptor.assets.length>5);
 const shell=result.descriptor.assets.find(a=>a.url===prefix+'offline')!;assert.equal(shell.sha256,createHash('sha256').update(result.html).digest('hex'));assert.ok(result.descriptor.assets.every(a=>a.url.startsWith(prefix)&&!a.url.startsWith(prefix+'api/')));
 const worker=offlineWorker(prefix);assert.doesNotMatch(worker,/caches\.delete|cache\.delete|\.clear\(/);assert.match(worker,/ownCaches/);assert.match(worker,/request.mode==='navigate'/);assert.match(worker,/cache:'no-store'/);assert.doesNotMatch(worker,/\.put\(/);
});
test('offline identity endpoint: existing session/context required; no business data or authorization from binding hint',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'offline-auth-'));const store=new PilotStore(dir);const account=(name:string)=>{const invite=store.invite(name+'@example.test'),id=store.activate({issuer:'https://accounts.google.com',subject:name,email:name+'@example.test',verified:true},digest(invite),5),s=store.session(id,8);return {id,headers:{host:'offline.example.test',origin,cookie:'__Secure-artesaos_session='+s.value,'x-pilot-context':id,'x-pilot-csrf':s.csrf}};};const a=account('a'),b=account('b');const config:PilotConfig={publicUrl:new URL(origin+prefix),prefix,dataDir:dir,staticDir:resolve('dist'),clientId:'test',clientSecret:'test',sessionHours:8,idleMinutes:30,maxUsers:5,adminEmails:[]};let app=await createPilotApp(config);
 const request=(who= a)=>app.inject({url:prefix+'api/offline/identity',headers:who.headers});
 try{assert.equal((await app.inject({url:prefix+'api/offline/identity',headers:{host:'offline.example.test',cookie:'__Secure-artesaos_offline_binding=forged'}})).statusCode,401);assert.equal((await request({...a,headers:{...a.headers,'x-pilot-context':b.id}})).statusCode,409);const first=await request(),other=await request(b);assert.equal(first.statusCode,200,first.body);assert.notEqual(first.json().key,other.json().key);assert.equal(first.headers['set-cookie'],undefined);assert.equal(first.headers['cache-control'],'no-store');await app.close();app=await createPilotApp(config);assert.equal((await request()).json().key,first.json().key);
 const out=await app.inject({method:'POST',url:prefix+'auth/logout',headers:a.headers});assert.equal(out.statusCode,200);assert.match(String(out.headers['set-cookie']),/__Secure-artesaos_offline_binding=;[^,]*Max-Age=0/);assert.equal((await request()).statusCode,401);const page=await app.inject({url:prefix+'offline',headers:{host:'offline.example.test'}});assert.equal(page.statusCode,200);assert.doesNotMatch(page.body,new RegExp(a.id+'|'+b.id));
 }finally{await app.close();store.close();rmSync(dir,{recursive:true,force:true});}
});
