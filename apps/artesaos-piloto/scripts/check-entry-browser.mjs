/** Local HTTPS fixture: real pilot adapter/APIs, synthetic Google provider, no external services. */
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
import {mkdtemp,rm,readFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:https';
import assert from 'node:assert/strict';
import {createPilotApp} from '../dist-server/pilot/app.js';
import {PilotStore} from '../dist-server/pilot/store.js';
const modules=process.env.WELCOME_BROWSER_MODULES;if(!modules)throw Error('Defina WELCOME_BROWSER_MODULES com playwright e axe-core.');
const {chromium}=await import(pathToFileURL(resolve(modules,'playwright/index.mjs')).href);
const root=fileURLToPath(new URL('..',import.meta.url)),output=resolve(process.env.WELCOME_BROWSER_OUTPUT||join(tmpdir(),'entry-evidence'));
const data=await mkdtemp(join(tmpdir(),'entry-browser-'));await mkdir(output,{recursive:true});
const openssl=process.env.ENTRY_OPENSSL||(process.platform==='win32'&&existsSync('C:/Program Files/Git/usr/bin/openssl.exe')?'C:/Program Files/Git/usr/bin/openssl.exe':'openssl');
let app,browser,store,server,failInterest=false;
try{
 execFileSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1','-keyout',join(data,'key.pem'),'-out',join(data,'cert.pem'),'-days','1'],{stdio:'ignore'});
 server=createServer({key:await readFile(join(data,'key.pem')),cert:await readFile(join(data,'cert.pem'))},async(req,res)=>{
  try{if(failInterest&&req.method==='POST'&&req.url.endsWith('/api/interest')){res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({message:'Falha simulada. Tente novamente.'}));return;}const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const response=await app.inject({method:req.method,url:req.url,headers:req.headers,...(body.length?{payload:body}:{})});res.writeHead(response.statusCode,response.headers);res.end(response.rawPayload);}catch{res.writeHead(500);res.end('Fixture error');}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`https://127.0.0.1:${server.address().port}`,prefix='/artesaos-piloto/',base=origin+prefix;
 const identity={issuer:'https://accounts.google.com',subject:'entry-fixture',email:'artisan@example.test',verified:true};
 const provider={async start(state){return `${base}auth/google/callback?state=${encodeURIComponent(state)}&code=synthetic`;},async complete(){return identity;}};
 app=await createPilotApp({publicUrl:new URL(base),prefix,dataDir:data,staticDir:join(root,'dist'),clientId:'fixture',clientSecret:'fixture',sessionHours:8,idleMinutes:30,maxUsers:5,adminEmails:['admin@example.test']},provider,null);
 store=new PilotStore(data);const invite=store.invite(identity.email);
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--ignore-certificate-errors']});
 const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const screenshot=async name=>{
  await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  for(const [mode,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
   await page.setViewportSize({width,height});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name}/${mode}: sem overflow`);
   await accessibility();
   await page.screenshot({path:join(output,`${name}-${mode}.png`),fullPage:true});
  }
  await page.setViewportSize({width:900,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,name+': tablet sem overflow');
  await page.setViewportSize({width:1440,height:1000});
 };
 // Axe is injected by Playwright, without adding a production endpoint or weakening CSP.
 const accessibility=async()=>{await page.evaluate(await readFile(resolve(modules,'axe-core/axe.min.js'),'utf8'));const result=await page.evaluate(async()=>await axe.run(document.querySelector('main'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.deepEqual(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);};
 await page.goto(base+'login');await page.getByRole('button',{name:'Solicitar participação',exact:true}).waitFor();await page.waitForFunction(()=>!document.getElementById('interest-submit').disabled);
 assert.equal(await page.getByRole('textbox',{name:'Código do convite'}).count(),0);assert.equal(await page.getByRole('button',{name:'Entrar com Google',exact:true}).isVisible(),false);
 await screenshot('inscricao');await accessibility();
 // Required fields/consent remain native and the API stores only successful submissions.
 await page.getByRole('button',{name:'Solicitar participação',exact:true}).click();assert.equal(await page.locator('#interest-name').evaluate(el=>el===document.activeElement),true);
 await page.locator('#interest-name').fill('Pessoa de teste');await page.locator('#interest-email').fill('person@example.test');await page.locator('[name=consent]').check();
 failInterest=true;
 await page.getByRole('button',{name:'Solicitar participação',exact:true}).click();await page.getByRole('status').filter({hasText:'Falha simulada'}).waitFor();assert.equal(await page.locator('#interest-name').inputValue(),'Pessoa de teste');failInterest=false;
 await page.getByRole('button',{name:'Solicitar participação',exact:true}).click();await page.getByRole('status').filter({hasText:'Interesse registrado'}).waitFor();
 await page.getByRole('link',{name:'Já sou cadastrado',exact:true}).click();await page.getByRole('heading',{name:'Bem-vindo de volta!'}).waitFor();assert.equal(await page.locator('#entry-auth-title').evaluate(el=>el===document.activeElement),true);
 assert.equal(await page.locator('#entry-invite-field').isVisible(),false);assert.equal(await page.locator('#invite').isDisabled(),true);await screenshot('login');await accessibility();
 await page.getByRole('button',{name:'Tenho um convite',exact:true}).click();await page.getByRole('heading',{name:'Tenho um convite',exact:true}).waitFor();await screenshot('convite');await accessibility();await page.getByRole('button',{name:'Continuar com Google',exact:true}).click();assert.equal(await page.locator('#invite').evaluate(el=>el===document.activeElement),true);
 await page.getByRole('link',{name:'Voltar para o login',exact:true}).click();await page.getByRole('link',{name:'Quero participar do piloto',exact:true}).click();await page.getByRole('heading',{name:'Quero participar do piloto',exact:true}).waitFor();
 await page.goBack();await page.getByRole('heading',{name:'Bem-vindo de volta!'}).waitFor();await page.getByRole('button',{name:'Tenho um convite',exact:true}).click();
 await page.locator('#invite').fill(invite);await page.getByRole('button',{name:'Continuar com Google',exact:true}).click();await page.getByRole('heading',{name:'Termos de Uso',exact:true}).waitFor({timeout:30000});await page.getByRole('checkbox',{name:'Li e aceito os Termos de Uso.'}).check();await page.getByRole('button',{name:'Confirmar e continuar',exact:true}).click();await page.getByRole('heading',{name:'Que bom ter você aqui!',exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('input[name=responsible]').matches(':disabled'));
 await screenshot('boas-vindas');await accessibility();
 await page.getByRole('textbox',{name:'Seu nome',exact:true}).fill('Artesã de teste');await page.getByRole('textbox',{name:'Telefone',exact:true}).fill('11999990000');
 await page.getByRole('button',{name:'Cadastrar meus produtos'}).click();await page.getByRole('heading',{name:'Produtos',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'Produtos',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Que bom ter você aqui!'}).count(),0);
 await page.getByRole('button',{name:'Sair',exact:true}).click();await page.getByRole('link',{name:'Já sou cadastrado',exact:true}).click();assert.equal(await page.locator('#invite').isDisabled(),true);
 await page.getByRole('button',{name:'Entrar com Google',exact:true}).click();await page.getByRole('heading',{name:'Produtos',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'Que bom ter você aqui!'}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: 4 telas × desktop/celular; inscrição/validações/erro/retry; alternância/foco/histórico; convite e retorno Google sintético; onboarding persistido; segundo login sem convite; Axe A/AA sem violações; sem overflow/erros JS.');
 await context.close();
}finally{await browser?.close();await app?.close();store?.close();if(server)await new Promise(r=>server.close(r));await rm(data,{recursive:true,force:true});}
