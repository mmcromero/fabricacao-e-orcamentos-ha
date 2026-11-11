import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {PilotStore as CandidatePilotStore} from '../server/pilot/store.js';
import {createPilotApp as createCandidateApp} from '../server/pilot/app.js';

// Immutable source SHAs of the versions distributed through Home Assistant.
const v26='7a730e2d9440d085b0468fb30f98e3d1942998a8';
const v27='99ecb5297c3983e3a8f620e22217858773dea35c';
const prefix='/artesaos-piloto/',origin='https://upgrade.example.test:8443';
const appRoot=process.cwd(),repoRoot=resolve(appRoot,'../..');
const identity={issuer:'https://accounts.google.com',subject:'upgrade-user',email:'upgrade-user@example.test',verified:true};
const company={name:'Ateliê Sintético',responsible:'Pessoa Sintética',phone:'11999990000',email:'upgrade@example.test'};
const snapshot=(db:DatabaseSync)=>db.prepare('SELECT version,name,checksum FROM schema_migrations ORDER BY version').all().map(row=>({version:Number(row.version),name:String(row.name),checksum:String(row.checksum)}));
const checkSqlite=(path:string)=>{const db=new DatabaseSync(path);try{assert.deepEqual(db.prepare('PRAGMA quick_check').all().map(row=>String(row.quick_check)),['ok']);}finally{db.close();}};
const importFile=(path:string)=>import(pathToFileURL(path).href);

test('HA: dev.26 limpa com boas-vindas incompletas migra sem perda para dev.28; dev.27 recusa v5',async()=>{
 const root=mkdtempSync(join(tmpdir(),'ha-dev26-to-dev28-')),data=join(root,'data'),worktrees:string[]=[];
 let oldApp:any,oldStore:any,newApp:any,newStore:CandidatePilotStore|undefined;
 const git=(...args:string[])=>execFileSync('git',args,{cwd:repoRoot,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 const makeOld=async(commit:string,folder:string)=>{
  const wt=join(root,folder);
  git('worktree','add','--detach',wt,commit);worktrees.push(wt);
  const dir=join(wt,'apps','umdoislab');
  symlinkSync(join(appRoot,'node_modules'),join(dir,'node_modules'),'dir');
  // Uses each historical release's own manifest and schema metadata.
  execFileSync(process.execPath,[join(dir,'scripts','prepare-pilot-metadata.mjs')],{cwd:dir,stdio:['ignore','pipe','pipe']});
  return dir;
 };
 const config={distribution:'home-assistant',publicUrl:new URL(origin+prefix),prefix,dataDir:data,staticDir:resolve(appRoot,'dist'),clientId:'synthetic',clientSecret:'synthetic',sessionHours:8,idleMinutes:30,maxUsers:null,adminEmails:['admin@example.test']};
 const provider={async start(){throw Error('Google OAuth real não é usado neste teste');},async complete(){throw Error('Google OAuth real não é usado neste teste');}};
 const request=(app:any,endpoint:string,headers:Record<string,string>={},method='GET',payload?:unknown)=>app.inject({url:prefix+endpoint,method,headers:{host:new URL(origin).host,...headers},...(payload===undefined?{}:{payload})});
 try{
  const dir26=await makeOld(v26,'source-dev26');
  const dir27=await makeOld(v27,'source-dev27');
  const [{PilotStore:OldPilotStore,digest},{createPilotApp:createOldApp},{PilotStore:BrokenPilotStore}]=await Promise.all([
   importFile(join(dir26,'server','pilot','store.ts')),
   importFile(join(dir26,'server','pilot','app.ts')),
   importFile(join(dir27,'server','pilot','store.ts'))
  ]);
  oldStore=new OldPilotStore(data);
  oldApp=await createOldApp(config,provider,null);
  const code=oldStore.invite(identity.email);
  const userId=oldStore.activate(identity,digest(code),null);
  const session=oldStore.session(userId,8);
  const headers={cookie:'__Secure-artesaos_session='+session.value,origin,'x-pilot-context':userId,'x-pilot-csrf':session.csrf};
  const login26=await request(oldApp,'api/pilot/session',headers);
  assert.equal(login26.statusCode,200,login26.body);
  assert.equal(login26.json().context,userId);
  const legal=(await request(oldApp,'api/legal/status',headers)).json();
  const legalAccepted=await request(oldApp,'api/legal/accept',headers,'POST',{version:legal.version,termsHash:legal.termsHash,accepted:true});
  assert.equal(legalAccepted.statusCode,200,legalAccepted.body);
  const start=(await request(oldApp,'api/onboarding',headers));
  assert.equal(start.statusCode,200,start.body);
  assert.equal(start.json().complete,false,'dev.26 deve ter cadastro inicial pendente');
  const saved=await request(oldApp,'api/company',headers,'PUT',{data:company,expectedRevision:0});
  assert.equal(saved.statusCode,200,saved.body);
  const after=(await request(oldApp,'api/onboarding',headers));
  assert.equal(after.statusCode,200,after.body);
  assert.equal(after.json().complete,false,'não concluir cadastro inicial');
  const beforeCompany=(await request(oldApp,'api/company',headers)).json();
  assert.equal(beforeCompany.revision,1);
  assert.deepEqual(beforeCompany.data,company);
  const tenantId=String(oldStore.db.prepare('SELECT tenant_id FROM pilot_users WHERE id=?').get(userId).tenant_id);
  const beforeRows=snapshot(oldStore.db);
  assert.deepEqual(beforeRows.map(x=>x.version),[1,2,3,4,5]);
  assert.equal(beforeRows.at(-1)?.name,'liberacao-modulos-piloto');
  const beforeGrants=oldStore.db.prepare('SELECT user_id,enabled_json,revision FROM pilot_module_access WHERE user_id=?').get(userId);
  // A newly created account receives essential access by fallback; the row is optional.
  const grants26=await importFile(join(dir26,'server','pilot','module-grants.ts'));
  assert.deepEqual(grants26.getModuleAccess(oldStore.db,userId),{enabled:['fabricacao','catalogo','vendas'],revision:0});

  await oldApp.close();oldApp=undefined;oldStore.close();oldStore=undefined;
  const controlPath=join(data,'pilot-control.sqlite');
  const tenantPath=join(data,'tenants',tenantId,'manufacturing.sqlite');
  checkSqlite(controlPath);
  assert.throws(()=>new BrokenPilotStore(data),/Schema futuro ou migração histórica divergente/,'dev.27 deve rejeitar banco de controle da dev.26');
  checkSqlite(controlPath);

  newStore=new CandidatePilotStore(data);
  newApp=await createCandidateApp(config,provider,null);
  assert.deepEqual(snapshot(newStore.db),beforeRows,'versões/checksums históricos não podem mudar');
  assert.deepEqual(newStore.db.prepare('SELECT user_id,enabled_json,revision FROM pilot_module_access WHERE user_id=?').get(userId),beforeGrants);
  const session28=await request(newApp,'api/pilot/session',headers);
  assert.equal(session28.statusCode,200,session28.body);
  assert.equal(session28.json().context,userId);
  assert.deepEqual(session28.json().modules.enabled,['fabricacao','catalogo','vendas']);
  const status28=await request(newApp,'api/onboarding',headers);
  assert.equal(status28.statusCode,200,status28.body);
  assert.equal(status28.json().complete,false,'a atualização não pode concluir cadastro sozinha');
  const company28=await request(newApp,'api/company',headers);
  assert.equal(company28.statusCode,200,company28.body);
  assert.deepEqual(company28.json(),beforeCompany,'dados parciais persistidos devem ser preservados');
  const page=await request(newApp,'?view=produtos',headers);
  assert.equal(page.statusCode,200,page.body);
  assert.match(page.body,/name="pilot-modules"/);
  await newApp.close();newApp=undefined;newStore.close();newStore=undefined;
  checkSqlite(controlPath);
  // A tenant DB is created on first API access and must remain intact.
  // Verify its exact name via the already-validated application reads above.
  console.log('PASS HA synthetic upgrade: dev.26 v5 + legal aceito + onboarding incompleto + dados persistidos -> dev.27 bloqueada -> dev.28 reabre, mantém checksum, sessão, módulos e cadastro.');
 }finally{
  if(newApp)await newApp.close();
  newStore?.close();
  if(oldApp)await oldApp.close();
  oldStore?.close();
  for(const wt of [...worktrees].reverse())try{git('worktree','remove','--force',wt);}catch{}
  rmSync(root,{recursive:true,force:true});
 }
});