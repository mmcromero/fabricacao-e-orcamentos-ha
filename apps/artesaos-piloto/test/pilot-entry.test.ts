import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createPilotApp} from '../server/pilot/app.js';
import {entryPage,entryScript} from '../server/pilot/entry.js';
import {interestForm} from '../server/pilot/community-ui.js';

test('entrada separa inscrição e autenticação sem duplicar formulários nem expor convite por padrão',()=>{
 const html=entryPage('/artesaos-piloto/',interestForm());
 assert.equal((html.match(/id="interest-form"/g)||[]).length,1);
 assert.equal((html.match(/id="entry-auth-form"/g)||[]).length,1);
 assert.match(html,/data-entry-panel="auth"[^>]* hidden/);
 assert.match(html,/id="entry-invite-field" hidden/);
 assert.match(html,/id="invite"[^>]*disabled/);
 assert.match(html,/name="consent"[^>]*required/);
 assert.match(html,/action="\/artesaos-piloto\/auth\/google\/start"/);
 assert.match(html,/Quero participar do piloto/);assert.match(html,/Solicitar participação/);
 assert.doesNotMatch(html,/name="(?:username|password)"/);
 assert.doesNotThrow(()=>new Function(entryScript()));
 const unavailable=entryPage('/artesaos-piloto/','<p>Lista temporariamente indisponível.</p>');assert.match(unavailable,/data-entry-panel="signup"/);assert.match(unavailable,/Já sou cadastrado/);assert.match(unavailable,/id="entry-auth-form"/);
});

test('rota pública serve estados e script sem sessão, mantendo proteção de origem e endpoints',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'entry-routes-')),origin='https://pilot.example.test',prefix='/artesaos-piloto/';
 const app=await createPilotApp({publicUrl:new URL(origin+prefix),prefix,dataDir:dir,staticDir:resolve('dist'),clientId:'fixture',clientSecret:'fixture',sessionHours:8,idleMinutes:30,maxUsers:5,adminEmails:['admin@example.test']},{async start(){return 'https://accounts.google.com/test';},async complete(){throw Error('unused');}},null);
 const request=(path:string,headers={},method='GET')=>app.inject({url:prefix+path,method:method as any,headers:{host:'pilot.example.test',...headers}});
 try{
  const page=await request('login');assert.equal(page.statusCode,200);assert.match(page.body,/entry.js/);assert.match(page.body,/data-entry-panel="signup"/);
  assert.match(page.headers['content-security-policy'] as string,/script-src 'self'/);
  const script=await request('entry.js');assert.equal(script.statusCode,200);assert.match(script.headers['content-type'] as string,/javascript/);
  assert.equal((await request('api/products')).statusCode,401);
  assert.equal((await request('auth/google/start',{origin:'https://evil.example'},'POST')).statusCode,403);
  assert.equal((await request('login',{host:'evil.example'})).statusCode,421);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
