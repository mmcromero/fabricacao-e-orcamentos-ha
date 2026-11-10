import {test} from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerMercadoPagoPix,amountText,centsFrom,statusOf} from '../server/pilot/mercadopago-pix.ts';
import {judgeCharge,nextPollDelay} from '../src/pix-poll.ts';
import {pendingPixKey,readPendingPix} from '../src/pix-pending.ts';
import {pilotConfig} from '../server/pilot/config.ts';

const TOKEN='APP_USR-0123456789-abcdef-0123456789abcdef-123456789';
const ID='ORD01JQ4S4KY8HWQ6NA5PXB65B3D3';
type Call={url:string;init:any};
function setup(opts:{email?:string;token?:string|undefined;admins?:string[];reply?:(url:string,init:any)=>Response;limited?:boolean;now?:()=>number}={}){
 const calls:Call[]=[];
 const fetchImpl=(async(url:string,init:any)=>{calls.push({url:String(url),init});return opts.reply?opts.reply(String(url),init):new Response('{}',{status:500});}) as unknown as typeof fetch;
 const app=Fastify();
 registerMercadoPagoPix(app,{prefix:'/p/',token:'token' in opts?opts.token:TOKEN,adminEmails:opts.admins??['marco@example.com'],auth:()=>({userId:'u1',email:opts.email??'marco@example.com'}),createLimited:()=>!!opts.limited,fetchImpl,now:opts.now,retryDelayMs:0});
 return {app,calls};
}
/** Resposta de ordem Pix no formato da API de Orders. */
const order=(over:any={},payment:any={})=>({id:ID,status:'action_required',total_amount:'45.90',external_reference:'',transactions:{payments:[{status:'action_required',payment_method:{id:'pix',type:'bank_transfer',qr_code:'00020126PIXCODE6304ABCD',qr_code_base64:'AAAA',ticket_url:'https://example.com/t'},...payment}]},...over});
const created=(over:any={},payment:any={})=>new Response(JSON.stringify(order(over,payment)),{status:201});

test('valores: centavos inteiros viram texto com 2 casas, sem erro de ponto flutuante',()=>{
 assert.equal(amountText(4590),'45.90');assert.equal(amountText(29),'0.29');assert.equal(amountText(1),'0.01');assert.equal(amountText(100000),'1000.00');
 assert.equal(centsFrom('45.90'),4590);assert.equal(centsFrom('0.29'),29);assert.equal(centsFrom(45.9),4590);assert.ok(Number.isNaN(centsFrom('x')));
});

test('status da ordem: processed = pago; em andamento = aguardando; o resto encerra',()=>{
 assert.equal(statusOf({status:'processed',transactions:{payments:[{status:'processed'}]}}),'approved');
 assert.equal(statusOf({status:'processed'}),'approved');
 assert.equal(statusOf({status:'processed',transactions:{payments:[{status:'action_required'}]}}),'pending');
 for(const s of ['created','processing','action_required'])assert.equal(statusOf({status:s}),'pending',s);
 for(const s of ['canceled','expired','failed','refunded','partially_refunded',undefined,'outra'])assert.equal(statusOf({status:s}),'closed',String(s));
});

test('status: só liberado para e-mail administrador e com token configurado',async()=>{
 const a=setup();const active=(await a.app.inject({url:'/p/api/pix-mp/status'})).json();assert.equal(active.enabled,true);assert.match(active.scope,/^ad:[0-9a-f]{16}:$/);assert.ok(!JSON.stringify(active).includes(TOKEN));
 const b=setup({email:'outro@example.com'});assert.deepEqual((await b.app.inject({url:'/p/api/pix-mp/status'})).json(),{enabled:false});
 const c=setup({token:undefined});assert.deepEqual((await c.app.inject({url:'/p/api/pix-mp/status'})).json(),{enabled:false});
 const d=setup({email:'MARCO@Example.com'});const allowed=(await d.app.inject({url:'/p/api/pix-mp/status'})).json();assert.equal(allowed.enabled,true);assert.match(allowed.scope,/^ad:[0-9a-f]{16}:$/);
});

test('criar cobrança: chama a API de Orders com token, valor em texto, Pix e e-mail do administrador',async()=>{
 const {app,calls}=setup({reply:()=>created()});
 const r=await app.inject({method:'POST',url:'/p/api/pix-mp/charges',payload:{amountCents:4590}});
 assert.equal(r.statusCode,200);
 assert.deepEqual({...r.json(),expiresAt:undefined},{id:ID,status:'pending',amountCents:4590,qrCode:'00020126PIXCODE6304ABCD',expiresAt:undefined});
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.mercadopago.com/v1/orders');
 assert.equal(calls[0].init.method,'POST');assert.equal(calls[0].init.headers.Authorization,'Bearer '+TOKEN);
 assert.ok(calls[0].init.headers['X-Idempotency-Key']);
 const body=JSON.parse(calls[0].init.body);
 assert.equal(body.type,'online');assert.equal(body.processing_mode,'automatic');assert.equal(body.total_amount,'45.90');
 assert.deepEqual(body.transactions.payments,[{amount:'45.90',payment_method:{id:'pix',type:'bank_transfer'},expiration_time:'PT40M'}]);
 assert.equal(body.payer.email,'marco@example.com');
 assert.match(body.external_reference,/^ad:[0-9a-f]{16}:[0-9a-f]{32}$/);
});

test('criar cobrança: cada tentativa usa uma chave de idempotência nova',async()=>{
 const {app,calls}=setup({reply:()=>created()});
 await app.inject({method:'POST',url:'/p/api/pix-mp/charges',payload:{amountCents:100}});
 await app.inject({method:'POST',url:'/p/api/pix-mp/charges',payload:{amountCents:100}});
 assert.notEqual(calls[0].init.headers['X-Idempotency-Key'],calls[1].init.headers['X-Idempotency-Key']);
});

test('criar cobrança: o token nunca aparece na resposta ao navegador',async()=>{
 const {app}=setup({reply:()=>created()});
 const r=await app.inject({method:'POST',url:'/p/api/pix-mp/charges',payload:{amountCents:4590}});
 assert.ok(!r.body.includes(TOKEN));
});

test('criar cobrança: recusas (não administrador, sem token, valor inválido, limite)',async()=>{
 for(const [label,s] of [['outro e-mail',setup({email:'x@example.com'})],['sem token',setup({token:undefined})]] as const){
  const r=await s.app.inject({method:'POST',url:'/p/api/pix-mp/charges',payload:{amountCents:100}});
  assert.equal(r.statusCode,403,label);assert.equal(s.calls.length,0,label+': não chama o Mercado Pago');
 }
 const {app,calls}=setup({reply:()=>created()});
 for(const payload of [{amountCents:0},{amountCents:-5},{amountCents:10.5},{amountCents:'abc'},{amountCents:null},{},{amountCents:100000000}])
  assert.equal((await app.inject({method:'POST',url:'/p/api/pix-mp/charges',payload})).statusCode,400,JSON.stringify(payload));
 assert.equal(calls.length,0);
 const l=setup({limited:true,reply:()=>created()});
 assert.equal((await l.app.inject({method:'POST',url:'/p/api/pix-mp/charges',payload:{amountCents:100}})).statusCode,429);assert.equal(l.calls.length,0);
});

test('criar cobrança: resposta estranha do Mercado Pago não gera QR',async()=>{
 for(const reply of [()=>created({total_amount:'99.00'}),()=>created({},{payment_method:{id:'pix'}}),()=>created({id:undefined}),()=>created({id:'../x'}),()=>created({transactions:{}})]){
  const {app}=setup({reply});const r=await app.inject({method:'POST',url:'/p/api/pix-mp/charges',payload:{amountCents:4590}});
  assert.equal(r.statusCode,502);assert.ok(!('qrCode' in r.json()));
 }
});

test('criar cobrança: criação assíncrona — consulta de novo até o código Pix aparecer',async()=>{
 let gets=0;
 const {app,calls}=setup({reply:(url,init)=>{
  if(init.method==='POST')return created({status:'processing'},{status:'processing',payment_method:{id:'pix'}});
  gets++;return gets<2?created({status:'processing'},{status:'processing',payment_method:{id:'pix'}}):created();
 }});
 const r=await app.inject({method:'POST',url:'/p/api/pix-mp/charges',payload:{amountCents:4590}});
 assert.equal(r.statusCode,200);assert.equal(r.json().qrCode,'00020126PIXCODE6304ABCD');assert.equal(calls.length,3);
 assert.equal(calls[1].url,'https://api.mercadopago.com/v1/orders/'+ID);
 // e desiste depois de poucas tentativas, sem laço infinito
 const never=setup({reply:()=>created({status:'processing'},{status:'processing',payment_method:{id:'pix'}})});
 const r2=await never.app.inject({method:'POST',url:'/p/api/pix-mp/charges',payload:{amountCents:4590}});
 assert.equal(r2.statusCode,502);assert.equal(never.calls.length,4);
});

test('criar cobrança: falhas do Mercado Pago viram mensagens claras',async()=>{
 const denied=setup({reply:()=>new Response('{"message":"invalid token"}',{status:401})});
 const r1=await denied.app.inject({method:'POST',url:'/p/api/pix-mp/charges',payload:{amountCents:100}});
 assert.equal(r1.statusCode,502);assert.match(r1.json().message,/token/i);
 const down=setup({reply:()=>{throw new Error('rede');}});
 const r2=await down.app.inject({method:'POST',url:'/p/api/pix-mp/charges',payload:{amountCents:100}});
 assert.equal(r2.statusCode,502);assert.match(r2.json().message,/QR comum/);
 const bad=setup({reply:()=>new Response('{"errors":[{"message":"valor minimo"}]}',{status:400})});
 const r3=await bad.app.inject({method:'POST',url:'/p/api/pix-mp/charges',payload:{amountCents:100}});
 assert.equal(r3.statusCode,400);assert.match(r3.json().message,/valor minimo/);
});

test('consultar: devolve o status e só de cobranças criadas por este app e esta conta',async()=>{
 for(const [mp,expected] of [['processed','approved'],['action_required','pending'],['processing','pending'],['canceled','closed'],['expired','closed'],['failed','closed']] as const){
  let reference='',mpStatus='action_required';
  const {app,calls}=setup({reply:(url,init)=>{
   if(init.method==='POST'){reference=JSON.parse(init.body).external_reference;return created({external_reference:reference});}
   return new Response(JSON.stringify(order({status:mpStatus,external_reference:reference},{status:mpStatus})),{status:200});
  }});
  await app.inject({method:'POST',url:'/p/api/pix-mp/charges',payload:{amountCents:4590}});
  mpStatus=mp;
  const r=await app.inject({url:'/p/api/pix-mp/charges/'+ID});
  assert.equal(r.statusCode,200,mp);assert.deepEqual(r.json(),{id:ID,status:expected,amountCents:4590,...(expected==='pending'?{qrCode:'00020126PIXCODE6304ABCD'}:{})},mp);
  assert.equal(calls.at(-1)!.url,'https://api.mercadopago.com/v1/orders/'+ID);assert.equal(calls.at(-1)!.init.method,'GET');
 }
});

test('consultar: ordem de outra conta, de outro método ou id inválido não vaza',async()=>{
 const other=setup({reply:()=>new Response(JSON.stringify(order({status:'processed',external_reference:'ad:0000000000000000:abc'})),{status:200})});
 assert.equal((await other.app.inject({url:'/p/api/pix-mp/charges/'+ID})).statusCode,404);
 const foreign=setup({reply:()=>new Response(JSON.stringify(order({status:'processed',external_reference:null},{payment_method:{id:'visa'}})),{status:200})});
 assert.equal((await foreign.app.inject({url:'/p/api/pix-mp/charges/'+ID})).statusCode,404);
 const s=setup({reply:()=>new Response('{}',{status:200})});
 for(const id of ['abc','1;2','../x','a'.repeat(65),'ORD 0123456789'])assert.equal((await s.app.inject({url:'/p/api/pix-mp/charges/'+encodeURIComponent(id)})).statusCode,404,id);
 assert.equal(s.calls.length,0);
 const nonAdmin=setup({email:'x@example.com',reply:()=>new Response('{}',{status:200})});
 assert.equal((await nonAdmin.app.inject({url:'/p/api/pix-mp/charges/'+ID})).statusCode,403);assert.equal(nonAdmin.calls.length,0);
});

test('consultar: limita consultas muito seguidas à mesma cobrança',async()=>{
 let t=1000;
 const {app,calls}=setup({now:()=>t,reply:()=>new Response('{"message":"x"}',{status:404})});
 assert.equal((await app.inject({url:'/p/api/pix-mp/charges/'+ID})).statusCode,404);
 assert.equal((await app.inject({url:'/p/api/pix-mp/charges/'+ID})).statusCode,429);assert.equal(calls.length,1);
 t+=3000;assert.equal((await app.inject({url:'/p/api/pix-mp/charges/'+ID})).statusCode,404);assert.equal(calls.length,2);
});

test('cliente: decisão de cada consulta e intervalos',()=>{
 assert.equal(judgeCharge({id:'1',status:'approved',amountCents:100},100),'paid');
 assert.equal(judgeCharge({id:'1',status:'pending',amountCents:100},100),'waiting');
 assert.equal(judgeCharge({id:'1',status:'closed',amountCents:100},100),'closed');
 assert.equal(judgeCharge({id:'1',status:'approved',amountCents:101},100),'mismatch');
 assert.equal(nextPollDelay(0),3000);assert.equal(nextPollDelay(19),3000);assert.equal(nextPollDelay(20),10000);assert.equal(nextPollDelay(500),10000);
});

test('configuração: token opcional, validado e vindo só do ambiente/opções do servidor',()=>{
 const base={PILOT_PUBLIC_URL:'https://example.com/artesaos-piloto/',GOOGLE_CLIENT_ID:'a',GOOGLE_CLIENT_SECRET:'b',DATA_DIR:'/tmp/x'} as NodeJS.ProcessEnv;
 assert.equal(pilotConfig(base).mercadopagoToken,undefined);
 assert.equal(pilotConfig({...base,MERCADOPAGO_ACCESS_TOKEN:' '+TOKEN+' '}).mercadopagoToken,TOKEN);
 assert.throws(()=>pilotConfig({...base,MERCADOPAGO_ACCESS_TOKEN:'curto'}),/token do Mercado Pago/);
 assert.throws(()=>pilotConfig({...base,MERCADOPAGO_ACCESS_TOKEN:'x'.repeat(30)+' injetado'}),/token do Mercado Pago/);
});

test('retomar Pix: chave isolada por conta, referência validada e sem token no navegador',()=>{
 const scope='ad:0123456789abcdef:';
 const key=pendingPixKey(scope);assert.equal(key,'artesao.pix.mp.pending.v1.'+scope);
 assert.equal(pendingPixKey('outro'),null);
 const record={id:ID,amountCents:4590,qrCode:'00020126PIXCODE6304ABCD',savedAt:1000};
 assert.deepEqual(readPendingPix(JSON.stringify(record)),record);
 for(const bad of [null,'{','{}',JSON.stringify({...record,id:'../MP'}),JSON.stringify({...record,amountCents:0}),JSON.stringify({...record,savedAt:0}),JSON.stringify({...record,qrCode:'x'})])
  assert.equal(readPendingPix(bad),null,String(bad));
 assert.ok(!JSON.stringify(record).includes(TOKEN));
});
