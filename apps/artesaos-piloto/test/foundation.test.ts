import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {migrate,migrations,schemaVersions} from '../server/foundation/migrations.js';
import {transaction} from '../server/foundation/transaction.js';
import {executeOperation,OperationConflict} from '../server/foundation/operations.js';
import {parseDecimal,formatDecimal,rescale,divideRounded,safeInteger} from '../server/foundation/decimal.js';

test('migrações preservam legado, repetem sem efeito e recusam futuro, divergência e escopo incorreto',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec("CREATE TABLE legacy(value TEXT); INSERT INTO legacy VALUES('preservado')");migrate(db,'tenant');migrate(db,'tenant');
  assert.equal(db.prepare('SELECT COUNT(*) n FROM schema_migrations').get()!.n,schemaVersions.tenant);
  assert.equal(db.prepare('SELECT value FROM legacy').get()!.value,'preservado');
  assert.throws(()=>migrate(db,'control'),/Tipo/);
  assert.throws(()=>migrate(db,'tenant',[{...migrations.tenant[0],sql:'SELECT 1;'}]),/divergente/);
  db.prepare('INSERT INTO schema_migrations VALUES(?,?,?,?)').run(99,'futuro','x','agora');
  assert.throws(()=>migrate(db,'tenant'),/futuro/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM legacy').get()!.n,1);
 }finally{db.close();}
});
test('migração quebrada reverte DDL e versão; sequência inválida não é aplicada',()=>{
 const db=new DatabaseSync(':memory:');try{
  migrate(db,'tenant');
  assert.throws(()=>migrate(db,'tenant',[...migrations.tenant,{version:migrations.tenant.length+1,name:'falha',sql:'CREATE TABLE partial(id INTEGER); SELECT * FROM inexistente;'}]));
  assert.equal(db.prepare("SELECT 1 FROM sqlite_master WHERE name='partial'").get(),undefined);
  assert.equal(db.prepare('SELECT MAX(version) n FROM schema_migrations').get()!.n,schemaVersions.tenant);
  assert.throws(()=>migrate(db,'tenant',[{version:2,name:'pulo',sql:'SELECT 1;'}]),/Sequência/);
 }finally{db.close();}
});
test('transações e savepoints revertem falhas e rejeitam trabalho assíncrono antes de executá-lo',()=>{
 const db=new DatabaseSync(':memory:');try{
  db.exec('CREATE TABLE values_test(value INTEGER)');
  transaction(db,()=>{db.exec('INSERT INTO values_test VALUES(1)');assert.throws(()=>transaction(db,()=>{db.exec('INSERT INTO values_test VALUES(2)');throw Error('falha');}));db.exec('INSERT INTO values_test VALUES(3)');});
  assert.deepEqual(db.prepare('SELECT value FROM values_test').all().map(r=>r.value),[1,3]);
  assert.throws(()=>transaction(db,()=>{db.exec('INSERT INTO values_test VALUES(4)');throw Error();}));
  let ran=false;assert.throws(()=>transaction(db,async()=>{ran=true;}),/síncrona/);assert.equal(ran,false);
  assert.equal(db.isTransaction,false);
 }finally{db.close();}
});
test('operação é atômica, idempotente, auditada e rejeita troca de conteúdo ou ator',()=>{
 const db=new DatabaseSync(':memory:');try{
  migrate(db,'tenant');db.exec('CREATE TABLE balance(value INTEGER); INSERT INTO balance VALUES(0)');
  const input={scope:'venda',key:'teste-1',actor:'usuario-1',action:'confirmar',sourceId:'1',request:{quantity:1,price:'12.34'}};
  const work=()=>{db.exec('UPDATE balance SET value=value-1');return {id:1};};
  assert.deepEqual(executeOperation(db,input,work),{replayed:false,result:{id:1}});
  assert.equal(executeOperation(db,{...input,request:{price:'12.34',quantity:1}},work).replayed,true);
  assert.equal(db.prepare('SELECT value FROM balance').get()!.value,-1);
  assert.throws(()=>executeOperation(db,{...input,request:{quantity:2}},work),OperationConflict);
  assert.throws(()=>executeOperation(db,{...input,actor:'outro'},work),OperationConflict);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM operation_audit').get()!.n,1);
  assert.throws(()=>db.exec('DELETE FROM operation_audit'),/imutável/);
  assert.throws(()=>db.exec("UPDATE operation_audit SET actor='outro'"),/imutável/);
  assert.throws(()=>executeOperation(db,{...input,key:'falha'},()=>{work();throw Error('falha');}));
  assert.equal(db.prepare('SELECT value FROM balance').get()!.value,-1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM operation_records').get()!.n,1);
  assert.throws(()=>executeOperation(db,{...input,key:'invalid'},()=>{work();return {bad:Infinity};}));
  assert.equal(db.prepare('SELECT value FROM balance').get()!.value,-1);
 }finally{db.close();}
});
test('operação persiste entre conexões e não atravessa arquivos de tenants',()=>{
 const dir=mkdtempSync(join(tmpdir(),'foundation-'));try{
  const input={scope:'x',key:'key',actor:'a',action:'confirmar',sourceId:'1',request:null};
  let db=new DatabaseSync(join(dir,'a.sqlite'));migrate(db,'tenant');executeOperation(db,input,()=>({id:1}));db.close();
  db=new DatabaseSync(join(dir,'a.sqlite'));migrate(db,'tenant');assert.equal(executeOperation(db,input,()=>{throw Error('não repetir');}).replayed,true);db.close();
  db=new DatabaseSync(join(dir,'b.sqlite'));migrate(db,'tenant');assert.equal(executeOperation(db,input,()=>({id:2})).replayed,false);db.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('precisão exata, centavos, custos fracionários, negativos e limites',()=>{
 assert.equal(parseDecimal('0,1',6)+parseDecimal('0.2',6),300000n);
 assert.equal(formatDecimal(parseDecimal('-12.30',2),2),'-12.30');
 assert.equal(rescale(parseDecimal('0.005',8),8,2),1n);
 assert.equal(rescale(parseDecimal('-0.005',8),8,2),-1n);
 assert.equal(divideRounded(5n,2n),3n);assert.equal(divideRounded(5n,-2n),-3n);
 assert.throws(()=>parseDecimal('1.001',2),/Precisão/);
 for(const raw of ['NaN','Infinity','1e2','', '1.2.3'])assert.throws(()=>parseDecimal(raw,6));
 assert.throws(()=>safeInteger(9007199254740992n));assert.throws(()=>divideRounded(1n,0n));
});
test('manifesto comum representa exatamente os schemas executáveis nas duas distribuições',()=>{
 const release=JSON.parse(readFileSync('artesao-release.json','utf8'));
 assert.deepEqual(release.schemaVersions,schemaVersions);
 assert.deepEqual(release.distributions,['home-assistant','debian']);
 for(const scope of Object.keys(migrations) as (keyof typeof migrations)[]){const db=new DatabaseSync(':memory:');try{migrate(db,scope);assert.equal(db.prepare('SELECT MAX(version) n FROM schema_migrations').get()!.n,release.schemaVersions[scope]);}finally{db.close();}}
});

test('falha na auditoria reverte efeito e idempotência; FK da fundação é efetiva',()=>{
 const db=new DatabaseSync(':memory:');try{
  migrate(db,'tenant');db.exec('CREATE TABLE counter(value INTEGER); INSERT INTO counter VALUES(0)');
  assert.throws(()=>db.prepare('INSERT INTO operation_audit(scope,operation_key,actor,action,source_id,details_json,created_at) VALUES(?,?,?,?,?,?,?)').run('x','ausente','a','x','1','{}','agora'),/FOREIGN KEY/);
  db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON operation_audit BEGIN SELECT RAISE(ABORT,'falha de auditoria'); END;");
  const input={scope:'x',key:'key',actor:'a',action:'confirmar',sourceId:'1',request:null};
  assert.throws(()=>executeOperation(db,input,()=>{db.exec('UPDATE counter SET value=1');return 1;}),/falha de auditoria/);
  assert.equal(db.prepare('SELECT value FROM counter').get()!.value,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM operation_records').get()!.n,0);
 }finally{db.close();}
});

test('duas confirmações concorrentes em processos distintos executam uma única alteração',async()=>{
 const {spawn}=await import('node:child_process');
 const dir=mkdtempSync(join(tmpdir(),'foundation-concurrency-')),path=join(dir,'tenant.sqlite');
 try{
  const db=new DatabaseSync(path);migrate(db,'tenant');db.exec('CREATE TABLE counter(value INTEGER); INSERT INTO counter VALUES(0)');db.close();
  const moduleUrl=new URL('../server/foundation/operations.ts',import.meta.url).href;
  const code=`import {DatabaseSync} from 'node:sqlite';import {executeOperation} from ${JSON.stringify(moduleUrl)};const db=new DatabaseSync(process.argv[1]);db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON');executeOperation(db,{scope:'sale',key:'same',actor:'user',action:'confirm',sourceId:'1',request:{quantity:1}},()=>{db.exec('UPDATE counter SET value=value+1');return {id:1};});db.close();`;
  const run=()=>new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',code,path],{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',chunk=>error+=chunk);child.on('error',reject);child.on('exit',exit=>exit===0?resolve():reject(Error(error)));});
  await Promise.all([run(),run()]);
  const check=new DatabaseSync(path);try{assert.equal(check.prepare('SELECT value FROM counter').get()!.value,1);assert.equal(check.prepare('SELECT COUNT(*) n FROM operation_audit').get()!.n,1);}finally{check.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('banco legado sintético preserva cadastros e chega ao mesmo schema de instalação vazia',async()=>{
 const {createApp}=await import('../server/app.js');
 const {resolve}=await import('node:path');
 const dir=mkdtempSync(join(tmpdir(),'foundation-upgrade-'));
 const staticDir=resolve('dist'),legacyDir=join(dir,'legacy'),freshDir=join(dir,'fresh');
 let legacy:Awaited<ReturnType<typeof createApp>>|undefined,fresh:Awaited<ReturnType<typeof createApp>>|undefined;
 try{
  legacy=await createApp({dataDir:legacyDir,staticDir,mode:'local',logRequests:false});
  const created=await legacy.inject({method:'POST',url:'/api/clients',payload:{name:'Cliente sintético',contact:'',phone:'',email:'',taxDocument:'',postal:''}});assert.equal(created.statusCode,200);
  await legacy.close();legacy=undefined;
  legacy=await createApp({dataDir:legacyDir,staticDir,mode:'local',logRequests:false,pilotFeatures:true});
  fresh=await createApp({dataDir:freshDir,staticDir,mode:'local',logRequests:false,pilotFeatures:true});
  const previous=new DatabaseSync(join(legacyDir,'validation.sqlite'));
  const current=new DatabaseSync(join(freshDir,'validation.sqlite'));
  try{
   assert.equal(previous.prepare('SELECT COUNT(*) n FROM clients').get()!.n,1);
   assert.equal(current.prepare('SELECT COUNT(*) n FROM clients').get()!.n,0);
   const schema=(db:DatabaseSync)=>db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
   assert.deepEqual(schema(previous),schema(current));
   assert.deepEqual(previous.prepare('PRAGMA foreign_key_check').all(),[]);
   assert.equal(previous.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');
  }finally{previous.close();current.close();}
 }finally{await legacy?.close();await fresh?.close();rmSync(dir,{recursive:true,force:true});}
});
