import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {createPilotApp} from '../server/pilot/app.ts';
import {PilotStore,digest} from '../server/pilot/store.ts';
import {usersAdminHtml,usersAdminScript} from '../server/pilot/users-admin-ui.ts';
import {getModuleAccess} from '../server/pilot/module-grants.ts';
const modules=process.env.WELCOME_BROWSER_MODULES;
if(!modules)throw Error('Defina WELCOME_BROWSER_MODULES para a pasta node_modules contendo playwright. Execute com node --import tsx.');
const {chromium}=await import(pathToFileURL(resolve(modules,'playwright/index.mjs')).href);
const output=resolve(process.env.WELCOME_BROWSER_OUTPUT||join(tmpdir(),'module-evidence'));mkdirSync(output,{recursive:true});
const dir=mkdtempSync(join(tmpdir(),'module-browser-')),origin='https://modules.example.test',prefix='/artesaos-piloto/',base=prefix+'admin/';
const config={publicUrl:new URL(origin+prefix),prefix,dataDir:dir,staticDir:resolve('dist'),clientId:'fixture',clientSecret:'fixture',sessionHours:8,idleMinutes:30,maxUsers:null,adminEmails:['admin@example.test']};
const store=new PilotStore(dir),identity=name=>({issuer:'https://accounts.google.com',subject:name,email:name+'@example.test',verified:true});
const id=store.activate(identity('piloto'),digest(store.invite('piloto@example.test')),null),other=store.activate(identity('outro'),digest(store.invite('outro@example.test')),null),admin=store.adminSession(identity('admin')),context=store.getAdmin(admin.value,config.adminEmails).context;
const app=await createPilotApp(config),browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.context().addCookies([{name:'__Secure-artesaos_admin_session',value:admin.value,url:origin+base,secure:true},{name:'__Secure-artesaos_admin_csrf',value:admin.csrf,url:origin+base,secure:true}]);
 await page.route(origin+'/**',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname===base+'users'){await route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="pilot-admin-context" content="'+context+'"><link rel="stylesheet" href="'+prefix+'pilot.css"></head><body>'+usersAdminHtml(base)+'<script src="'+base+'test-users.js"></script></body></html>'});return;}
  if(url.pathname===base+'test-users.js'){await route.fulfill({contentType:'application/javascript',body:'window.pilotBrowserReady=Promise.resolve();'+usersAdminScript(base)});return;}
  const response=await app.inject({method:req.method(),url:url.pathname+url.search,headers:{...req.headers(),host:new URL(origin).host,...(req.method()!=='GET'?{origin}:{})},...(req.postData()?{payload:req.postData()}:{})});
  await route.fulfill({status:response.statusCode,headers:{'content-type':String(response.headers['content-type']||'application/json')},body:response.rawPayload});
 });
 await page.goto(origin+base+'users');const row=page.locator('tbody tr').filter({hasText:'piloto@example.test'});await row.getByRole('checkbox',{name:'Pedidos',exact:true}).waitFor();
 assert.equal(await row.getByRole('checkbox').count(),8);assert.equal(await row.getByRole('checkbox',{name:'Pedidos',exact:true}).isChecked(),false);
 await row.getByRole('checkbox',{name:'Pedidos',exact:true}).check();await row.getByRole('button',{name:'Salvar módulos de piloto@example.test',exact:true}).click();await row.getByRole('status').filter({hasText:'Módulos salvos.'}).waitFor();assert.ok(getModuleAccess(store.db,id).enabled.includes('pedidos'));assert.ok(!getModuleAccess(store.db,other).enabled.includes('pedidos'));
 await page.reload();const fresh=page.locator('tbody tr').filter({hasText:'piloto@example.test'});await fresh.getByRole('checkbox',{name:'Pedidos',exact:true}).waitFor();assert.ok(await fresh.getByRole('checkbox',{name:'Pedidos',exact:true}).isChecked());
 await page.screenshot({path:join(output,'module-admin-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(output,'module-admin-mobile.png'),fullPage:true});
 await fresh.getByRole('checkbox',{name:'Pedidos',exact:true}).uncheck();await fresh.getByRole('button',{name:'Salvar módulos de piloto@example.test',exact:true}).click();await fresh.getByRole('status').filter({hasText:'Módulos salvos.'}).waitFor();assert.ok(!getModuleAccess(store.db,id).enabled.includes('pedidos'));assert.deepEqual(errors,[]);
 console.log('PASS: checkboxes, salvar, reabrir, desativar, isolamento; desktop e celular.');
}finally{await browser.close();await app.close();store.close();rmSync(dir,{recursive:true,force:true});}
