import {setModuleAccess} from '../server/pilot/module-grants.js';
import {moduleKeys} from '../server/module-access.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {migrate} from '../server/foundation/migrations.js';
import {MaterialLedger} from '../server/material-ledger.js';
import {currentProduction} from '../server/material-current-cost.js';
import {calculateManufacturing,emptyProduction} from '../server/manufacturing-model.js';
import {createApp} from '../server/app.js';
import {mkdtempSync,rmSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
function fixture(){const db=new DatabaseSync(':memory:');migrate(db,'tenant');const material={name:'PLA teste',mode:'quantity',purchaseQuantity:1,purchasePrice:20,purchaseUnit:'kg',customUnit:''};db.prepare('INSERT INTO materials(material_key,data,updated_at) VALUES(?,?,?)').run('pla teste',JSON.stringify(material),'2026-01-01');return {db,ledger:new MaterialLedger(db,'tenant:sintetico'),material};}
const purchase=(key='compra-1',cost='90.00',day='2026-10-01')=>({requestKey:key,purchasedOn:day,supplier:'Fornecedor teste',notes:'',lines:[{materialId:1,unit:'kg' as const,totalCost:cost,lots:[{quantity:'1',label:'Rolo A'},{quantity:'1',label:'Rolo B'},{quantity:'1',label:'Rolo C'}]}]});

test('compra de três rolos gera três IDs, um título pendente e retentativa não duplica',()=>{
 const {db,ledger}=fixture();try{
  const input={...purchase(),notes:'Linha 1\nLinha 2'},first=ledger.purchase(input),second=ledger.purchase(input);
  assert.deepEqual(first,second);assert.equal(new Set(first.lotIds).size,3);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM material_purchases').get()!.n,1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM financial_obligations').get()!.n,1);
  assert.equal(db.prepare('SELECT amount_cents FROM financial_obligations').get()!.amount_cents,9000);
  assert.equal(first.paymentStatus,'pending');assert.equal(ledger.list()[0].balance,'3000.000000');
  assert.throws(()=>ledger.purchase({...input,notes:'outro conteúdo'}));
  assert.equal(ledger.lots(1)[0].exhausted,false);
 }finally{db.close();}
});
test('última compra REGISTRADA com data retroativa define custo, sem média nem alteração de preço/snapshot',()=>{
 const {db,ledger,material}=fixture();try{
  const production={...emptyProduction(),machineSeconds:0,humanSeconds:0,materials:[{...material,materialId:1,materialRevision:1,quantity:100,unit:'g'}]};
  const product={name:'Produto teste',origin:'own',prices:{wholesale:1000,factory:2000,retail:3000},manufacturing:production};
  db.prepare('INSERT INTO products(data,updated_at) VALUES(?,?)').run(JSON.stringify(product),'2026-01-01');
  db.prepare("UPDATE area_settings SET data=? WHERE area='fabricacao'").run(JSON.stringify({energyHour:'0',wearHour:'0',humanHour:'0',productiveHours:'100',wholesaleMarkup:'1.5',factoryMarkup:'2.0',retailMarkup:'3.0'}));
  ledger.purchase(purchase('recente','90.00','2026-10-01'));
  const oldRef=db.prepare('SELECT unit_cost8 FROM material_cost_reference').get()!.unit_cost8;
  ledger.purchase(purchase('retroativa','150.00','2026-01-01'));
  const ref=db.prepare('SELECT * FROM material_cost_reference').get()!;assert.equal(ref.purchase_id,2);assert.equal(ref.unit_cost8,'5000000');assert.notEqual(ref.unit_cost8,oldRef);
  const saved=JSON.parse(String(db.prepare('SELECT data FROM products').get()!.data));assert.deepEqual(saved,product);
  const calc=calculateManufacturing(currentProduction(db,production as any),{energyHour:'0',wearHour:'0',humanHour:'0',productiveHours:'100',wholesaleMarkup:'1.5',factoryMarkup:'2.0',retailMarkup:'3.0'},true);assert.equal(calc.cost,5);
  assert.equal(JSON.parse(String(db.prepare('SELECT data FROM product_current_costs').get()!.data)).cost,5);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM material_purchases').get()!.n,2);
  assert.throws(()=>db.exec('UPDATE material_purchases SET total_cents=0'),/imutável/);
 }finally{db.close();}
});
test('correção, perda e encerrar sobra preservam referência e não geram outra obrigação financeira',()=>{
 const {db,ledger}=fixture();try{
  const p=ledger.purchase(purchase()),lotId=p.lotIds[0],ref=db.prepare('SELECT unit_cost8 FROM material_cost_reference').get()!.unit_cost8;
  ledger.adjust(1,{requestKey:'corr',lotId,expectedBalance:'1000',newBalance:'900',kind:'correction',reason:'Contagem corrigida'});
  ledger.adjust(1,{requestKey:'perda',lotId,expectedBalance:'900',newBalance:'800',kind:'loss',reason:'Material danificado'});
  ledger.adjust(1,{requestKey:'fim',lotId,expectedBalance:'800',newBalance:'0',kind:'close',reason:'Rolo acabado com sobra não registrada'});
  assert.equal(db.prepare('SELECT unit_cost8 FROM material_cost_reference').get()!.unit_cost8,ref);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM financial_obligations').get()!.n,1);
  const movements=db.prepare("SELECT kind,analytical_cents FROM material_movements WHERE kind!='purchase' ORDER BY id").all();assert.deepEqual(movements.map(m=>[m.kind,m.analytical_cents]),[['correction',0],['loss',300],['close',2400]]);
  assert.ok(ledger.lots(1).find(l=>l.id===lotId)!.exhausted);
  assert.throws(()=>ledger.adjust(1,{requestKey:'stale',lotId,expectedBalance:'800',newBalance:'100',kind:'correction',reason:'x'}),/Saldo mudou/);
  assert.throws(()=>db.exec('DELETE FROM material_movements'),/imutável/);
 }finally{db.close();}
});
test('inventário cria unidade física sem compra/custo inventado; modo direto não recebe estoque',()=>{
 const {db,ledger}=fixture();try{
  const opened=ledger.opening(1,{requestKey:'inicial',quantity:'10',label:'Rolo encontrado',reason:'Inventário inicial contado'});
  assert.equal(ledger.balance(1),10000000);assert.equal(db.prepare('SELECT COUNT(*) n FROM material_purchases').get()!.n,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM financial_obligations').get()!.n,0);
  assert.equal(db.prepare('SELECT * FROM material_cost_reference').get(),undefined);
  ledger.adjust(1,{requestKey:'perda-sem-custo',lotId:opened.lotId,expectedBalance:'10',newBalance:'9',kind:'loss',reason:'Perda observada'});
  assert.equal(db.prepare("SELECT analytical_cents FROM material_movements WHERE kind='loss'").get()!.analytical_cents,null);
  const direct={name:'Serviço',mode:'direct',purchaseQuantity:null,purchasePrice:null,purchaseUnit:'un',customUnit:''};db.prepare('INSERT INTO materials(material_key,data,updated_at) VALUES(?,?,?)').run('servico',JSON.stringify(direct),'now');
  assert.equal(ledger.profile(2).tracked,false);assert.throws(()=>ledger.opening(2,{requestKey:'nao-fisico',quantity:'1',label:'',reason:'x'}),/sem controle/);
 }finally{db.close();}
});
test('sugestão prioriza lote único capaz, depois combinação; consumo é exato e idempotente',()=>{
 const {db,ledger}=fixture();try{
  const p=ledger.purchase({...purchase(),lines:[{materialId:1,unit:'g',totalCost:'10.00',lots:[{quantity:'20',label:'Mais antigo'},{quantity:'100',label:'Maior'}]}]});
  const suggestion=ledger.suggest(1,'50');assert.equal(suggestion.length,1);assert.equal(suggestion[0].lotId,p.lotIds[1]);
  const consume={requestKey:'consumo',sourceId:'Consumo teste',quantity:'110',allocations:ledger.suggest(1,'110'),allowDeficit:false};assert.equal(consume.allocations.length,2);
  ledger.consume(1,consume);ledger.consume(1,consume);assert.throws(()=>ledger.consume(1,{...consume,requestKey:'outra-chave'}),/já foi registrada/);assert.equal(ledger.list()[0].balance,'10.000000');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM material_movements WHERE kind='consume'").get()!.n,2);
  assert.ok(ledger.lots(1).find(l=>l.id===p.lotIds[0])!.exhausted);
 }finally{db.close();}
});
test('insuficiência reverte consumo parcial; déficit autorizado fica separado e exige conciliação',()=>{
 const {db,ledger}=fixture();try{
  ledger.opening(1,{requestKey:'inventario',quantity:'5',label:'',reason:'Contagem inicial'});
  const input={requestKey:'insuficiente',sourceId:'Consumo manual',quantity:'8',allocations:ledger.suggest(1,'8'),allowDeficit:false};
  assert.throws(()=>ledger.consume(1,input),/insuficiente/);assert.equal(ledger.list()[0].balance,'5.000000');
  ledger.consume(1,{...input,requestKey:'autorizado',allowDeficit:true});assert.equal(ledger.list()[0].balance,'-3.000000');assert.equal(ledger.list()[0].deficit,'-3.000000');
  ledger.purchase(purchase());assert.equal(ledger.list()[0].deficit,'-3.000000');
  ledger.adjust(1,{requestKey:'conciliacao',lotId:null,expectedBalance:'-3',newBalance:'0',kind:'correction',reason:'Consumo reconciliado com contagem'});
  assert.equal(ledger.list()[0].deficit,'0.000000');assert.equal(db.prepare("SELECT COUNT(*) n FROM material_movements WHERE kind='deficit'").get()!.n,1);
 }finally{db.close();}
});
test('compra multi-material tem obrigação única e validação inválida não grava efeito parcial',()=>{
 const {db,ledger,material}=fixture();try{
  db.prepare('INSERT INTO materials(material_key,data,updated_at) VALUES(?,?,?)').run('outro',JSON.stringify({...material,name:'Outro'}),'now');
  const one=purchase();ledger.purchase({...one,lines:[...one.lines,{...one.lines[0],materialId:2,totalCost:'60.00'}]});
  assert.equal(db.prepare('SELECT amount_cents FROM financial_obligations').get()!.amount_cents,15000);assert.equal(db.prepare('SELECT COUNT(*) n FROM material_lots').get()!.n,6);
  assert.throws(()=>ledger.purchase({...purchase('invalid'),lines:[...one.lines,{...one.lines[0],materialId:999}]}),/não encontrado/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM material_purchases').get()!.n,1);
  assert.throws(()=>ledger.purchase({...purchase('unit'),lines:[{...one.lines[0],unit:'l' as any}]}),/incompatíveis/);
  assert.throws(()=>ledger.purchase(purchase('date','10.00','2026-02-30')),/Data inválida/);
  assert.throws(()=>ledger.purchase(purchase('precision','1.001')),/inválido/);
 }finally{db.close();}
});
test('classificações múltiplas, acondicionamento, categoria e medidas não duplicam material',()=>{
 const {db,ledger}=fixture();try{
  db.prepare('INSERT INTO material_categories VALUES(1,?,?)').run('Filamentos','filamentos');
  const profile={...ledger.profile(1),container:'carretel',defaultQuantity:'1000',categoryId:1,classifications:['manufacturing','product_packaging'] as any,internalCm:['10','20','30'],weightGrams:'50',expectedRevision:0,requestKey:'perfil'};
  ledger.saveProfile(1,profile);assert.equal(ledger.profile(1).container,'carretel');assert.equal(ledger.profile(1).classifications.length,2);
  ledger.purchase(purchase());assert.throws(()=>ledger.saveProfile(1,{...profile,unit:'kg',expectedRevision:1,requestKey:'mudar-unidade'}),/não podem mudar/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM materials').get()!.n,1);
 }finally{db.close();}
});
test('API usa banco de tenant, mostra compra pendente e não aceita efetuar pagamento ou editar compra',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'materials-api-'));
 const app=await createApp({dataDir:dir,staticDir:resolve('dist'),mode:'local',pilotFeatures:true,actorId:'tenant:teste',logRequests:false});
 try{
  const db=new DatabaseSync(join(dir,'validation.sqlite'));db.prepare('INSERT INTO pilot_onboarding VALUES(1,?)').run('now');db.close();
  const material={name:'PLA teste',mode:'quantity',purchaseQuantity:1,purchasePrice:20,purchaseUnit:'kg',customUnit:''};assert.equal((await app.inject({method:'POST',url:'/api/materials',payload:material})).statusCode,200);
  const created=await app.inject({method:'POST',url:'/api/inventory/material-purchases',payload:purchase()});assert.equal(created.statusCode,200,created.body);
  assert.equal((await app.inject('/api/inventory/material-payables')).json()[0].payment_status,'pending');
  assert.equal((await app.inject({method:'PUT',url:'/api/inventory/material-purchases/1',payload:{totalCost:'0'}})).statusCode,404);
  assert.equal((await app.inject({method:'POST',url:'/api/inventory/material-payables/1/pay',payload:{}})).statusCode,404);
  const refs=(await app.inject('/api/materials')).json();assert.equal(refs[0].purchaseUnit,'g');assert.equal(refs[0].purchaseQuantity,3000);assert.equal(refs[0].purchasePrice,90);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('erro ao criar obrigação financeira reverte compra, lotes, referência e auditoria',()=>{
 const {db,ledger}=fixture();try{
  db.exec("CREATE TRIGGER fail_payable BEFORE INSERT ON financial_obligations BEGIN SELECT RAISE(ABORT,'falha simulada'); END;");
  assert.throws(()=>ledger.purchase(purchase()),/falha simulada/);
  for(const table of ['material_purchases','material_purchase_lines','material_lots','material_movements','material_cost_reference','operation_records','operation_audit'])assert.equal(db.prepare(`SELECT COUNT(*) n FROM ${table}`).get()!.n,0);
  db.exec('DROP TRIGGER fail_payable');ledger.purchase(purchase());assert.equal(db.prepare('SELECT COUNT(*) n FROM financial_obligations').get()!.n,1);
 }finally{db.close();}
});
test('consumo histórico mantém custo após nova compra e ajuste exige justificativa',()=>{
 const {db,ledger}=fixture();try{
  const bought=ledger.purchase(purchase()),lotId=bought.lotIds[0];
  ledger.consume(1,{requestKey:'consume-history',sourceId:'teste-historico',quantity:'100',allocations:[{lotId,quantity:'100'}],allowDeficit:false});
  const snapshot=db.prepare("SELECT * FROM material_movements WHERE kind='consume'").get();
  ledger.purchase(purchase('novo-custo','150.00'));
  assert.deepEqual(db.prepare("SELECT * FROM material_movements WHERE kind='consume'").get(),snapshot);
  assert.throws(()=>ledger.adjust(1,{requestKey:'sem-motivo',lotId,expectedBalance:'900',newBalance:'800',kind:'correction',reason:''}),/texto/);
 }finally{db.close();}
});
test('duas compras concorrentes repetidas criam uma compra e referência por ordem de registro',async()=>{
 const {spawn}=await import('node:child_process');const dir=mkdtempSync(join(tmpdir(),'purchase-race-')),path=join(dir,'tenant.sqlite');
 try{
  const seed=new DatabaseSync(path);migrate(seed,'tenant');seed.prepare('INSERT INTO materials(material_key,data,updated_at) VALUES(?,?,?)').run('teste',JSON.stringify({name:'Teste',mode:'quantity',purchaseQuantity:1,purchasePrice:1,purchaseUnit:'kg',customUnit:''}),'now');seed.close();
  const url=new URL('../server/material-ledger.ts',import.meta.url).href;
  const script=`import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';import {MaterialLedger} from ${JSON.stringify(url)};const v=JSON.parse(readFileSync(0,'utf8')),db=new DatabaseSync(v.path);db.exec('PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');try{process.stdout.write(JSON.stringify(new MaterialLedger(db,'tenant:race').purchase(v.input)));}finally{db.close();}`;
  const run=(input:ReturnType<typeof purchase>)=>new Promise<any>((resolve,reject)=>{const child=spawn(process.execPath,['--import','tsx','--input-type=module','-e',script],{stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>err+=c);child.on('error',reject);child.on('exit',code=>code===0?resolve(JSON.parse(out)):reject(Error(err)));child.stdin.end(JSON.stringify({path,input}));});
  const repeated=await Promise.all([run(purchase()),run(purchase())]);assert.deepEqual(repeated[0],repeated[1]);
  await Promise.all([run(purchase('new-a','120.00','2026-10-01')),run(purchase('new-b','180.00','2020-01-01'))]);
  const db=new DatabaseSync(path);try{
   assert.equal(db.prepare('SELECT COUNT(*) n FROM material_purchases').get()!.n,3);assert.equal(db.prepare('SELECT COUNT(*) n FROM financial_obligations').get()!.n,3);
   const last=db.prepare('SELECT * FROM material_purchases ORDER BY id DESC LIMIT 1').get()!,ref=db.prepare('SELECT * FROM material_cost_reference').get()!;assert.equal(ref.purchase_id,last.id);assert.equal(ref.total_cents,last.total_cents);
  }finally{db.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('aplicar sugestão com custo desatualizado é recusado; compra não altera preço comercial',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'material-price-version-')),app=await createApp({dataDir:dir,staticDir:resolve('dist'),mode:'local',pilotFeatures:true,logRequests:false});
 try{
  const db=new DatabaseSync(join(dir,'validation.sqlite'));db.prepare('INSERT INTO pilot_onboarding VALUES(1,?)').run('now');
  const material={name:'Teste',mode:'quantity',purchaseQuantity:1,purchasePrice:20,purchaseUnit:'kg',customUnit:''};db.prepare('INSERT INTO materials(material_key,data,updated_at) VALUES(?,?,?)').run('teste',JSON.stringify(material),'now');
  const settings={energyHour:'0',wearHour:'0',humanHour:'0',productiveHours:'100',wholesaleMarkup:'1.5',factoryMarkup:'2.0',retailMarkup:'3.0'};db.prepare("UPDATE area_settings SET data=? WHERE area='fabricacao'").run(JSON.stringify(settings));
  const revision=Number(db.prepare("SELECT revision FROM area_settings WHERE area='fabricacao'").get()!.revision);
  new MaterialLedger(db,'tenant:test').purchase(purchase());db.close();
  const product={name:'Produto',origin:'own',category:'',publicAllowed:false,catalogVisible:false,prices:{wholesale:1000,factory:2000,retail:3000},weightGrams:null,lengthCm:null,widthCm:null,heightCm:null,colors:[],sourceKeys:[],family:'',description:'',manufacturing:{...emptyProduction(),machineSeconds:0,humanSeconds:0,materials:[{...material,materialId:1,quantity:100,unit:'g'}]}};
  const body={product,applyPrices:true,expectedSettingsRevision:revision,expectedMaterialPurchaseId:0};
  assert.equal((await app.inject({method:'POST',url:'/api/products/editor',payload:body})).statusCode,409);
  const saved=await app.inject({method:'POST',url:'/api/products/editor',payload:{...body,expectedMaterialPurchaseId:1}});assert.equal(saved.statusCode,200,saved.body);assert.equal(saved.json().prices.retail,900);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('API pagina materiais e histórico e filtra classificações/categorias no servidor',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'material-pages-')),app=await createApp({dataDir:dir,staticDir:resolve('dist'),mode:'local',pilotFeatures:true,logRequests:false});
 try{
  const db=new DatabaseSync(join(dir,'validation.sqlite'));db.prepare('INSERT INTO pilot_onboarding VALUES(1,?)').run('now');
  for(let i=0;i<25;i++)db.prepare('INSERT INTO materials(material_key,data,updated_at) VALUES(?,?,?)').run('material '+String(i).padStart(2,'0'),JSON.stringify({name:'Material '+i,mode:'quantity',purchaseQuantity:1,purchasePrice:1,purchaseUnit:'un',customUnit:''}),'now');
  db.prepare('INSERT INTO material_categories VALUES(1,?,?)').run('Envio','envio');
  const ledger=new MaterialLedger(db,'tenant:test');ledger.saveProfile(1,{...ledger.profile(1),expectedRevision:0,requestKey:'classif',classifications:['shipping'],categoryId:1});
  for(let i=0;i<25;i++)ledger.opening(1,{requestKey:'opening-'+i,quantity:'1',label:'Unidade '+i,reason:'Contagem inicial'});db.close();
  const first=(await app.inject('/api/inventory/materials?page=1')).json();assert.equal(first.total,25);assert.equal(first.items.length,20);assert.equal(first.pages,2);
  assert.equal((await app.inject('/api/inventory/materials?page=2')).json().items.length,5);
  assert.equal((await app.inject('/api/inventory/materials?page=1&classification=shipping&category=1')).json().total,1);
  assert.equal((await app.inject('/api/inventory/materials?page=1&search=material%2024')).json().total,1);
  const history=(await app.inject('/api/inventory/materials/1/history?page=2')).json();assert.equal(history.total,25);assert.equal(history.items.length,5);
  assert.equal((await app.inject('/api/inventory/materials?page=-1')).statusCode,400);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
test('saldos totais fora de inteiro seguro são recusados sem gravar efeito parcial',()=>{
 const {db,ledger}=fixture();try{
  for(let i=0;i<9;i++)ledger.opening(1,{requestKey:'large-'+i,quantity:'1000000000',label:'',reason:'Inventário sintético de limite'});
  assert.throws(()=>ledger.opening(1,{requestKey:'overflow',quantity:'1000000000',label:'',reason:'Limite'}),/limite seguro/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM material_lots').get()!.n,9);
 }finally{db.close();}
});

test('APIs de materiais mantêm isolamento e atribuem operador do servidor, não do corpo',async()=>{
 const {createPilotApp}=await import('../server/pilot/app.js');const {PilotStore}=await import('../server/pilot/store.js');
 const dir=mkdtempSync(join(tmpdir(),'materials-tenant-security-')),origin='https://materials.example.test',prefix='/artesaos-piloto/';
 let identity={issuer:'https://accounts.google.com',subject:'a',email:'a@example.test',verified:true};
 const app=await createPilotApp({publicUrl:new URL(origin+prefix),prefix,dataDir:dir,staticDir:resolve('dist'),clientId:'fixture',clientSecret:'fixture',sessionHours:8,idleMinutes:30,maxUsers:null},{async start(state){return 'https://accounts.google.com/test?state='+state;},async complete(){return identity;}});
 const store=new PilotStore(dir);
 const request=(path:string,headers:Record<string,string>={},method='GET',payload?:unknown)=>app.inject({url:prefix+path,method:method as any,headers:{host:new URL(origin).host,origin,...headers},...(payload===undefined?{}:{payload:payload as any})});
 try{
  const login=async(subject:string)=>{identity={...identity,subject,email:subject+'@example.test'};const invite=store.invite(identity.email),start=await request('auth/google/start',{},'POST',{invite});const state=new URL(String(start.headers.location)).searchParams.get('state'),flow=start.cookies.find(c=>c.name==='__Secure-artesaos_flow')!;const done=await request('auth/google/callback?state='+state+'&code=fixture',{cookie:flow.name+'='+flow.value});assert.equal(done.statusCode,200);const cookie=done.cookies.map(c=>c.name+'='+c.value).join('; '),session=(await request('api/pilot/session',{cookie})).json();const headers={cookie,'x-pilot-context':session.context,'x-pilot-csrf':done.cookies.find(c=>c.name==='__Secure-artesaos_csrf')!.value};setModuleAccess(store.db,session.context,moduleKeys,0,'fixture');const legal=(await request('api/legal/status',headers)).json();await request('api/legal/accept',headers,'POST',{version:legal.version,termsHash:legal.termsHash,accepted:true});await request('api/company',headers);const tenant=String(store.db.prepare('SELECT tenant_id FROM pilot_users WHERE id=?').get(session.context)!.tenant_id),db=new DatabaseSync(join(dir,'tenants',tenant,'validation.sqlite'));db.prepare('INSERT INTO pilot_onboarding VALUES(1,?)').run('now');db.close();return {headers,tenant};};
  const a=await login('a'),b=await login('b');
  assert.equal((await request('api/inventory/materials')).statusCode,401);
  assert.equal((await request('api/orders')).statusCode,401);
  assert.equal((await request('api/finance/titles')).statusCode,401);
  assert.equal((await request('api/sales')).statusCode,401);
  assert.equal((await request('api/sales-sessions')).statusCode,401);
  assert.equal((await request('api/attention')).statusCode,401);
  assert.equal((await request('api/shipping/materials')).statusCode,401);
  assert.equal((await request('api/shipping/prepare',{...a.headers,'x-pilot-csrf':'forjado'},'POST',{})).statusCode,403);
  assert.equal((await request('api/shipping/preview',{...a.headers,'x-pilot-context':'forjado'},'POST',{})).statusCode,409);
  assert.equal((await request('api/orders/foreign-order/shipment',b.headers)).statusCode,404);
  assert.equal((await request('api/attention/forjado/treat',{...a.headers,'x-pilot-csrf':'forjado'},'POST',{})).statusCode,403);
  assert.equal((await request('api/inventory/partners')).statusCode,401);
  assert.equal((await request('api/inventory/consigned')).statusCode,401);
  assert.equal((await request('api/sales-places',{...a.headers,'x-pilot-csrf':'forjado'},'POST',{})).statusCode,403);
  assert.equal((await request('api/sales',{...a.headers,'x-pilot-csrf':'forjado'},'POST',{})).statusCode,403);
  assert.equal((await request('api/finance/titles',{...a.headers,'x-pilot-csrf':'forjado'},'POST',{})).statusCode,403);
  const financial=await request('api/finance/titles',a.headers,'POST',{requestKey:'private-title',direction:'in',amountCents:100,dueOn:'',clientId:null,description:'Privado A',actor:'forjado'});assert.equal(financial.statusCode,200,financial.body);
  assert.equal((await request('api/finance/titles/'+financial.json().id,b.headers)).statusCode,404);
  assert.equal((await request('api/orders',{...a.headers,'x-pilot-csrf':'forjado'},'POST',{})).statusCode,403);
  const material={name:'Privado do usuário A',mode:'quantity',purchaseQuantity:1,purchasePrice:20,purchaseUnit:'kg',customUnit:''};assert.equal((await request('api/materials',a.headers,'POST',material)).statusCode,200);
  const bought=await request('api/inventory/material-purchases',a.headers,'POST',{...purchase(),actor:'forjado'});assert.equal(bought.statusCode,200,bought.body);
  assert.equal((await request('api/inventory/materials',b.headers)).json().total,0);
  assert.equal((await request('api/inventory/material-purchases',b.headers,'POST',purchase())).statusCode,404);
  const lotId=bought.json().lotIds[0];assert.equal((await request('api/inventory/lots/'+lotId+'/label',b.headers,'PATCH',{requestKey:'foreign-lot',label:'Inválido',expectedRevision:1})).statusCode,409);
  assert.equal((await request('api/inventory/materials',{...a.headers,'x-pilot-context':'forjado'})).statusCode,409);
  const db=new DatabaseSync(join(dir,'tenants',a.tenant,'validation.sqlite'));try{assert.equal(db.prepare('SELECT actor FROM material_purchases').get()!.actor,'tenant:'+a.tenant);assert.equal(db.prepare('SELECT COUNT(*) n FROM financial_obligations').get()!.n,1);}finally{db.close();}
 }finally{store.close();await app.close();rmSync(dir,{recursive:true,force:true});}
});

test('restauração fria de compras, lotes, consumos e obrigação mantém idempotência e integridade',()=>{
 const dir=mkdtempSync(join(tmpdir(),'material-restore-')),original=join(dir,'original.sqlite'),restored=join(dir,'restored.sqlite');
 try{
  let db=new DatabaseSync(original);migrate(db,'tenant');db.prepare('INSERT INTO materials(material_key,data,updated_at) VALUES(?,?,?)').run('teste',JSON.stringify({name:'Teste',mode:'quantity',purchaseQuantity:1,purchasePrice:20,purchaseUnit:'kg',customUnit:''}),'now');
  let ledger=new MaterialLedger(db,'tenant:test');const input=purchase(),bought=ledger.purchase(input);const consumed={requestKey:'backup-consumo',sourceId:'evento-backup',quantity:'100',allocations:[{lotId:bought.lotIds[0],quantity:'100'}],allowDeficit:false};ledger.consume(1,consumed);
  const tables=['material_purchases','material_purchase_lines','material_lots','material_movements','material_consumption_events','material_cost_reference','financial_obligations','operation_records','operation_audit'];
  const snapshot=Object.fromEntries(tables.map(t=>[t,db.prepare(`SELECT * FROM ${t}`).all()]));db.close();cpSync(original,restored);
  db=new DatabaseSync(restored);try{
   migrate(db,'tenant');ledger=new MaterialLedger(db,'tenant:test');assert.deepEqual(ledger.purchase(input),bought);ledger.consume(1,consumed);
   assert.deepEqual(Object.fromEntries(tables.map(t=>[t,db.prepare(`SELECT * FROM ${t}`).all()])),snapshot);
   assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check,'ok');assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
  }finally{db.close();}
 }finally{rmSync(dir,{recursive:true,force:true});}
});
