import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {migrate} from '../server/foundation/migrations.js';
import {AttentionCorrection} from '../server/attention-correction.js';
import {AttentionCenter} from '../server/attention-center.js';
import {Distribution} from '../server/distribution.js';
import {Sales} from '../server/sales.js';
import {Orders} from '../server/orders.js';
import {emptyProduction} from '../server/manufacturing-model.js';
function fixture(){const db=new DatabaseSync(':memory:');migrate(db,'tenant');for(const origin of ['own','client'])db.prepare('INSERT INTO products(data,updated_at) VALUES(?,?)').run(JSON.stringify({name:'Peça '+origin,origin,prices:{retail:1000,wholesale:null,factory:null},manufacturing:{...emptyProduction(),machineSeconds:0,humanSeconds:0}}),'now');db.prepare('INSERT INTO clients(data,updated_at) VALUES(?,?)').run('{"name":"Cliente"}','now');return {db,center:new AttentionCenter(db,'tenant:fixture'),correction:new AttentionCorrection(db,'tenant:fixture'),d:new Distribution(db,'tenant:fixture')};}
test('correção de déficit mantém custo, compras e histórico; rejeita destino ou ação forjados',()=>{const {db,center,correction,d}=fixture();try{
 db.prepare('INSERT INTO materials(material_key,data,updated_at) VALUES(?,?,?)').run('material',JSON.stringify({name:'Material',mode:'quantity',purchaseQuantity:1,purchasePrice:1,purchaseUnit:'g',customUnit:''}),'now');
 d.stock.materials.consume(1,{requestKey:'consume',sourceId:'manufacturing',quantity:'0.125',allocations:[],allowDeficit:true});const row=center.list({kind:'material-deficit'}).items[0];
 assert.equal((correction.read(row.id) as any).material.deficit,'-0.125000');
 assert.throws(()=>correction.correct(row.id,{action:'stock',requestKey:'wrong',expectedBalance:0,newBalance:0,reason:'Wrong'}),/não autorizada/);
 assert.throws(()=>correction.correct(row.id,{action:'material',requestKey:'foreign',materialId:99,expectedBalance:'-0.125000',newBalance:'0',reason:'Forjado'}),/Campos/);
 const fix={action:'material',requestKey:'fix',expectedBalance:'-0.125000',newBalance:'0',reason:'Conciliação física justificada'};const result=correction.correct(row.id,fix);assert.deepEqual(correction.correct(row.id,fix),result);assert.equal(center.get(row.id).state,'resolved');
 assert.equal(db.prepare('SELECT COUNT(*) n FROM material_purchases').get()!.n,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM finance_entries').get()!.n,0);
 assert.throws(()=>correction.correct(row.id,{...fix,requestKey:'after'}),/já resolvida/);assert.equal(db.prepare("SELECT COUNT(*) n FROM operation_audit WHERE scope='attention-correction'").get()!.n,1);
}finally{db.close();}});
test('correção financeira vincula pagamento ao título, conserva estoque e não permite excesso novo',()=>{const {db,center,correction,d}=fixture();try{
 const title=d.finance.createTitle({requestKey:'late',direction:'in',amountCents:1000,dueOn:'2020-01-01',clientId:1,description:'Recebimento vencido'});center.scan();const row=center.list({kind:'financial-overdue'}).items[0];
 assert.equal((correction.read(row.id) as any).title.id,title.id);
 assert.throws(()=>correction.correct(row.id,{action:'pay',requestKey:'too-much',expectedRevision:1,parts:[{amountCents:1100,accountId:'general',methodId:'cash',settleNow:true}]}),/excede/);
 const pay={action:'pay',requestKey:'pay',expectedRevision:1,parts:[{amountCents:1000,accountId:'general',methodId:'cash',settleNow:true}]};assert.deepEqual(correction.correct(row.id,pay),correction.correct(row.id,pay));assert.equal(center.get(row.id).state,'resolved');
 const excess=d.finance.createTitle({requestKey:'excess',direction:'in',amountCents:500,dueOn:'',clientId:1,description:'Recebimento com excedente'});d.finance.pay(excess.id,{requestKey:'over',expectedRevision:1,allowExcess:true,parts:[{amountCents:1000,accountId:'general',methodId:'cash',settleNow:true}]});const erow=center.list({kind:'financial-excess'}).items[0],epayment=(correction.read(erow.id) as any).payments[0].id;
 const foreignPayment=String(db.prepare('SELECT id FROM finance_payments WHERE title_id=?').get(title.id)!.id);
 const refund={action:'refund',requestKey:'refund',paymentId:epayment,amountCents:500,feeRefundCents:0,accountId:'general',reason:'Reembolso autorizado do excedente'};
 assert.throws(()=>correction.correct(erow.id,{...refund,paymentId:foreignPayment}),/não pertence/);assert.throws(()=>correction.correct(erow.id,{...refund,amountCents:501}),/supera/);
 correction.correct(erow.id,refund);assert.equal(center.get(erow.id).state,'resolved');assert.equal(d.finance.title(excess.id).remaining,0);assert.equal(db.prepare('SELECT COUNT(*) n FROM product_stock_movements').get()!.n,0);
}finally{db.close();}});
test('crédito de excedente preserva vínculo com o cliente e resolve somente o título correspondente',()=>{const {db,center,correction,d}=fixture();try{
 const title=d.finance.createTitle({requestKey:'credit-title',direction:'in',amountCents:500,dueOn:'',clientId:1,description:'Crédito autorizado'});d.finance.pay(title.id,{requestKey:'credit-pay',expectedRevision:1,allowExcess:true,parts:[{amountCents:1000,accountId:'general',methodId:'cash',settleNow:true}]});const row=center.list({kind:'financial-excess'}).items[0];
 correction.correct(row.id,{action:'credit',requestKey:'issue',amountCents:500,reason:'Cliente escolheu crédito'});assert.equal(center.get(row.id).state,'resolved');assert.equal(db.prepare('SELECT client_id FROM finance_credits').get()!.client_id,1);
}finally{db.close();}});
test('agendamento existente pode ser cancelado ou liquidado apenas na origem da pendência',()=>{const {db,center,correction,d}=fixture();try{
 const titles=['primeiro','segundo'].map(name=>{const title=d.finance.createTitle({requestKey:name,direction:'in',amountCents:500,dueOn:'2020-01-01',clientId:1,description:name});d.finance.pay(title.id,{requestKey:'scheduled-'+name,expectedRevision:1,allowExcess:false,parts:[{amountCents:500,accountId:'general',methodId:'credit',settleNow:false}]});return title;});
 center.scan();const rows=center.list({kind:'financial-overdue'}).items,first=rows.find(r=>r.source_id===titles[0].id)!,second=rows.find(r=>r.source_id===titles[1].id)!,firstPayment=(correction.read(first.id) as any).payments[0].id,secondPayment=(correction.read(second.id) as any).payments[0].id;
 const input={action:'scheduled',requestKey:'settle',paymentId:firstPayment,settlement:'settle',reason:'Recebimento efetivo confirmado'};assert.throws(()=>correction.correct(first.id,{...input,paymentId:secondPayment}),/não pertence/);
 correction.correct(first.id,input);assert.equal(center.get(first.id).state,'resolved');assert.equal(center.get(second.id).state,'open');
 correction.correct(second.id,{action:'scheduled',requestKey:'cancel',paymentId:secondPayment,settlement:'cancel',reason:'Agendamento cancelado sem recebimento'});assert.equal(center.get(second.id).state,'open');assert.equal(d.finance.title(titles[1].id).scheduled,0);assert.equal(d.finance.title(titles[1].id).remaining,500);
}finally{db.close();}});
test('conferência contextual de sessão reutiliza fechamento e devolução existentes',()=>{const {db,center,correction,d}=fixture();try{
 const place=d.placeSave({requestKey:'place',name:'Feira',address:'',notes:'',active:true}),session=d.openSession({requestKey:'session',placeId:place.id,dateOn:'2026-11-10',tier:'retail',stockControl:true});d.closeSession(session.id,{requestKey:'close',expectedRevision:1,physical:'pending',reason:'Conferir depois'});const row=center.list({kind:'session-count'}).items[0];
 const snapshot=correction.read(row.id) as any;assert.equal(snapshot.session.id,session.id);correction.correct(row.id,{action:'session',requestKey:'count',expectedRevision:snapshot.session.revision,reason:'Conferência física concluída'});assert.equal(center.get(row.id).state,'resolved');
}finally{db.close();}});
test('destinação privada contextual reutiliza confirmação de privacidade e reservas',()=>{const {db,center,correction,d}=fixture();try{
 const orders=new Orders(db,'tenant:fixture'),order=orders.create({requestKey:'order',clientId:1,items:[{productId:2,quantity:1,unitPrice:1000}],extraCents:0,dueOn:'',notes:''}),preview=d.stock.preview(2,2,order.id);d.stock.manufacture({requestKey:'made',productId:2,orderId:order.id,quantity:2,previewToken:preview.previewToken,materials:[],allowDeficit:false});const row=center.list({kind:'client-excess'}).items[0];
 const snapshot=correction.read(row.id) as any;assert.equal(snapshot.row.inHand-snapshot.row.reserved,1);assert.deepEqual(snapshot.products.map((p:any)=>p.origin),['own']);
 const input={action:'destination',requestKey:'dest',kind:'convert',quantity:1,targetProductId:1,confirmPrivacy:false,reason:'Destinação autorizada'};
 assert.throws(()=>correction.correct(row.id,input),/privacidade/);correction.correct(row.id,{...input,confirmPrivacy:true});assert.equal(center.get(row.id).state,'resolved');assert.equal(d.stock.balance(row.item_ref!,'central'),1);assert.equal(db.prepare('SELECT COUNT(*) n FROM completed_manufacturing').get()!.n,1);
}finally{db.close();}});
test('correção de consignado preserva remessas e repasses existentes',()=>{const {db,center,correction,d}=fixture();try{
 const item=d.consigned.save({requestKey:'vendor',name:'Consignado',supplier:'Fornecedor',salePrice:1000,repass:500,imageUrl:'',active:true}),sales=new Sales(db,'tenant:fixture'),cart={clientId:null,items:[{kind:'consigned' as const,ref:item.id,quantity:1,priceKey:'retail' as const,customPriceCents:null,discount:null}],discount:null,couponCode:'',discountChoice:'manual' as const};sales.confirm({...cart,requestKey:'sale',previewToken:sales.preview(cart).previewToken,payments:[]});const row=center.list({kind:'stock-divergence'}).items[0];
 assert.equal((correction.read(row.id) as any).balance,-1);correction.correct(row.id,{action:'stock',requestKey:'fix-consigned',expectedBalance:-1,newBalance:0,reason:'Contagem do consignado conferida'});assert.equal(center.get(row.id).state,'resolved');assert.equal(d.consigned.balance(item.id,'central'),0);assert.equal(db.prepare('SELECT COUNT(*) n FROM sales').get()!.n,1);
}finally{db.close();}});
