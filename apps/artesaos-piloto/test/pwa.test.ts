import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {PNG} from 'pngjs';
import {runInNewContext} from 'node:vm';
import {createPilotApp} from '../server/pilot/app.js';
import {browserScripts} from '../server/pilot/browser.js';
import type {PilotConfig} from '../server/pilot/config.js';
for(const distribution of ['debian','home-assistant'] as const)for(const prefix of ['/artesaos-piloto/','/evento/artesao/'])test(`PWA manifest/icons public and scoped: ${distribution} ${prefix}`,async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pwa-')),origin='https://pwa.example.test:8443';
 const config:PilotConfig={distribution,publicUrl:new URL(origin+prefix),prefix,dataDir:dir,staticDir:resolve('dist'),clientId:'synthetic',clientSecret:'synthetic',sessionHours:8,idleMinutes:30,maxUsers:null};
 const app=await createPilotApp(config,{async start(){return 'https://accounts.google.com/synthetic';},async complete(){throw Error('unused');}});
 try{
  const get=(path:string,host=new URL(origin).host)=>app.inject({url:prefix+path,headers:{host}});
  const r=await get('manifest.webmanifest');assert.equal(r.statusCode,200);assert.match(String(r.headers['content-type']),/application\/manifest\+json/);assert.equal(r.headers['cache-control'],'no-store');assert.equal(r.headers['set-cookie'],undefined);
  const m=r.json();assert.equal(m.id,prefix);assert.equal(m.start_url,prefix);assert.equal(m.scope,prefix);assert.equal(m.name,'Artesão Digital');assert.equal(m.display,'standalone');assert.equal(m.icons.length,2);
  for(const size of [192,512]){const icon=await get('pwa/icon-'+size+'.png');assert.equal(icon.statusCode,200);assert.equal(icon.headers['cache-control'],'no-store');const png=PNG.sync.read(icon.rawPayload);assert.equal(png.width,size);assert.equal(png.height,size);assert.equal(m.icons.find((i:any)=>i.sizes===size+'x'+size).src,prefix+'pwa/icon-'+size+'.png');}
  assert.equal((await get('pwa/icon-999.png')).statusCode,404);
  for(const path of ['login','legal','auth/finish',...(distribution==='debian'?['admin/setup','admin/recover']:['admin/login'])]){
   const page=await get(path);if(page.statusCode===302||path==='admin/recover'&&page.statusCode===404)continue;assert.equal(page.statusCode,200);assert.ok(page.body.includes(`rel="manifest" href="${prefix}manifest.webmanifest"`),path);assert.ok(page.body.includes(`rel="apple-touch-icon" href="${prefix}pwa/icon-192.png"`));
  }
  assert.equal((await get('api/products')).statusCode,401);assert.equal((await get('manifest.webmanifest','wrong.test')).statusCode,421);
  const worker=await get('service-worker.js');assert.equal(worker.headers['service-worker-allowed'],prefix);assert.equal(worker.headers['cache-control'],'no-store');
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('PWA keeps worker network-only and deletes only own URL entries, never HA entries',async()=>{
 const handlers:Record<string,any>={},deleted:string[]=[],fetched:any[]=[];let claimed=false;
 const urls=['https://host/artesaos-piloto/private','https://host/lovelace','https://host/other-app/','https://elsewhere/artesaos-piloto/private'];
 const self={location:new URL('https://host/artesaos-piloto/service-worker.js'),registration:{navigationPreload:{async disable(){}}},clients:{async claim(){claimed=true;}},async skipWaiting(){},addEventListener:(name:string,fn:any)=>{handlers[name]=fn;}};
 runInNewContext(browserScripts('/artesaos-piloto/','new').serviceWorker,{self,URL,caches:{async keys(){return ['ha-cache'];},async open(){return {async keys(){return urls.map(url=>({url}));},async delete(req:any){deleted.push(req.url);}};}},fetch:async(req:any,opts:any)=>{fetched.push({req,opts});return 'network';}});
 await new Promise<void>((resolve,reject)=>handlers.activate({waitUntil:(p:Promise<void>)=>p.then(resolve,reject)}));assert.deepEqual(deleted,[urls[0]]);assert.equal(claimed,true);
 let response:any;handlers.fetch({request:{url:urls[0]},respondWith:(p:any)=>{response=p;}});assert.equal(await response,'network');assert.equal(fetched[0].opts.cache,'no-store');
 handlers.fetch({request:{url:urls[1]},respondWith:()=>assert.fail('Must not intercept HA')});assert.equal(fetched.length,1);
});
test('HA presentation preserves technical identity and operating policy',()=>{
 const config=readFileSync('pilot/config.yaml','utf8');assert.match(config,/name: "Artesão Digital — Contingência"/);assert.match(config,/slug: artesaos_piloto/);assert.match(config,/8099\/tcp: null/);assert.match(config,/DATA_DIR: \/data/);assert.match(config,/boot: manual/);
});
