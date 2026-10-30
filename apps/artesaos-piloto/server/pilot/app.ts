import Fastify from 'fastify';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {FastifyInstance,HTTPMethods} from 'fastify';
import {createApp} from '../app.js';
import type {PilotConfig} from './config.js';
import {googleProvider,type IdentityProvider} from './google.js';
import {PilotStore,token,digest,equal} from './store.js';
const SESSION='__Secure-artesaos_session',CSRF='__Secure-artesaos_csrf',FLOW='__Secure-artesaos_flow';
function cookie(header:string|undefined,name:string){try{const entries=(header??'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='));return entries.length===1?decodeURIComponent(entries[0].slice(name.length+1)):'';}catch{return '';}}
export async function createPilotApp(config:PilotConfig,provider:IdentityProvider=googleProvider(config)){
 const app=Fastify({logger:{redact:['req.headers.cookie','req.headers.authorization','res.headers.set-cookie']},disableRequestLogging:true,bodyLimit:2*1024*1024,trustProxy:false});
 const store=new PilotStore(config.dataDir);try{for(const invite of config.initialInvites??[])store.bootstrap(invite.email,invite.code);}catch(e){store.close();throw e;}const tenants=new Map<string,Promise<FastifyInstance>>();const prefix=config.prefix;
 const setCookie=(name:string,value:string,httpOnly=true,maxAge=28800)=>`${name}=${encodeURIComponent(value)}; Path=${prefix}; Secure; SameSite=Lax; Max-Age=${maxAge}${httpOnly?'; HttpOnly':''}`;
 function session(req:{headers:{cookie?:string}}){return store.getSession(cookie(req.headers.cookie,SESSION),config.idleMinutes);}
 app.addContentTypeParser('application/x-www-form-urlencoded',{parseAs:'string',bodyLimit:4096},(_req,body,done)=>{const entries=new URLSearchParams(String(body));if([...entries.keys()].some((k,i,all)=>all.indexOf(k)!==i)){done(Error('Formulário inválido.'));return;}done(null,Object.fromEntries(entries));});
 app.addHook('onRequest',async(req,reply)=>{
  reply.header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').header('Referrer-Policy','same-origin').header('X-Frame-Options','DENY').header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self' https://accounts.google.com; base-uri 'self'; object-src 'none'");
  if(req.headers.host!==config.publicUrl.host)return reply.code(421).send({message:'Endereço de acesso não autorizado.'});
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin!==config.publicUrl.origin)return reply.code(403).send({message:'Origem da alteração não autorizada.'});
 });
 app.get(prefix+'login',async(req,reply)=>{if(session(req))return reply.redirect(prefix);return reply.type('text/html').send(`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Artesãos — Piloto</title><link rel="stylesheet" href="${prefix}pilot.css"></head><body><main><h1>Artesãos — Piloto</h1><p>Entre com sua conta Google. No primeiro acesso, informe seu convite individual.</p><form method="post" action="${prefix}auth/google/start"><label for="invite">Código de convite (somente no primeiro acesso)</label><input id="invite" name="invite" type="password" maxlength="100" autocomplete="off"><button>Entrar com Google</button></form><p>Seus dados são separados das demais contas. Este ambiente é de testes; use dados fictícios.</p></main></body></html>`);});
 app.get(prefix+'pilot.css',(_req,reply)=>reply.type('text/css').send('body{font:17px system-ui;background:#f3f6f2;color:#20372e;margin:0}main{max-width:540px;margin:8vh auto;padding:24px}input,button{display:block;box-sizing:border-box;padding:12px;margin:12px 0;width:100%;font:inherit}button{background:#205e47;color:white;border:0;border-radius:6px}#pilot-account{padding:12px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}#pilot-account button{width:auto;margin:0}'));
 app.post<{Body:{invite?:string}}>(prefix+'auth/google/start',{bodyLimit:4096},async(req,reply)=>{
  if(store.limited('login-global',30)||store.limited('login:'+req.ip,15))return reply.code(429).send({message:'Muitas tentativas. Aguarde antes de tentar novamente.'});
  if(typeof req.body?.invite!=='undefined'&&typeof req.body.invite!=='string')return reply.code(400).send({message:'Convite inválido.'});
  const state=token(),browser=token(),nonce=token(),verifier=token();
  try{const url=await provider.start(state,nonce,verifier);store.flow(state,browser,verifier,nonce,req.body?.invite??'');reply.header('Set-Cookie',setCookie(FLOW,browser,true,600));return reply.redirect(url);}catch{return reply.code(503).send({message:'Não foi possível iniciar o login Google. Confira a configuração e tente novamente.'});}
 });
 app.get(prefix+'auth/google/callback',async(req,reply)=>{
  reply.header('Referrer-Policy','no-referrer');
  const url=new URL(req.raw.url!,config.publicUrl.origin);const states=url.searchParams.getAll('state');
  if(states.length!==1)return reply.code(400).send({message:'Retorno de login inválido.'});
  const flow=store.takeFlow(states[0],cookie(req.headers.cookie,FLOW));reply.header('Set-Cookie',setCookie(FLOW,'',true,0));
  if(!flow)return reply.code(400).send({message:'Login expirado ou não iniciado neste navegador. Inicie novamente.'});
  try{const identity=await provider.complete(url,states[0],flow.nonce,flow.verifier);const user=store.activate(identity,flow.inviteHash,config.maxUsers);const old=cookie(req.headers.cookie,SESSION);if(old)store.logout(old);const created=store.session(user,config.sessionHours);reply.header('Set-Cookie',[setCookie(FLOW,'',true,0),setCookie(SESSION,created.value,true,config.sessionHours*3600),setCookie(CSRF,created.csrf,false,config.sessionHours*3600)]);return reply.redirect(prefix);}catch{return reply.code(403).send({message:'Não foi possível autorizar esta conta. Confira o convite e a conta Google ou peça ao administrador para revisar seu acesso.'});}
 });
 app.get(prefix+'pilot-session.js',(_req,reply)=>reply.type('application/javascript').send(`(()=>{const original=window.fetch.bind(window);const context=document.querySelector('meta[name=pilot-context]')?.content;const item=document.cookie.split('; ').find(v=>v.startsWith('${CSRF}='));const csrf=item?decodeURIComponent(item.slice('${CSRF}='.length)):'';window.fetch=(input,init)=>{const request=new Request(input,init);const url=new URL(request.url);if(url.origin===location.origin&&url.pathname.startsWith(${JSON.stringify(prefix)})){const headers=new Headers(request.headers);if(context)headers.set('X-Pilot-Context',context);if(csrf&&!['GET','HEAD','OPTIONS'].includes(request.method))headers.set('X-Pilot-CSRF',csrf);return original(new Request(request,{headers}));}return original(request);};addEventListener('DOMContentLoaded',async()=>{const r=await fetch('${prefix}api/pilot/session');if(!r.ok){location.replace('${prefix}login');return;}const data=await r.json();const bar=document.createElement('nav');bar.id='pilot-account';bar.setAttribute('aria-label','Conta do piloto');const name=document.createElement('span');name.textContent='Artesãos — Piloto · '+data.email;const logout=document.createElement('button');logout.textContent='Sair';logout.onclick=async()=>{const result=await fetch('${prefix}auth/logout',{method:'POST'});if(result.ok)location.replace('${prefix}login');};bar.append(name,logout);document.body.prepend(bar);});})();`));
 app.post(prefix+'auth/logout',async(req,reply)=>{const current=session(req);if(!current||!equal(digest(String(req.headers['x-pilot-csrf']??'')),current.csrfHash))return reply.code(403).send({message:'Sessão ou confirmação inválida.'});store.logout(cookie(req.headers.cookie,SESSION));reply.header('Set-Cookie',[setCookie(SESSION,'',true,0),setCookie(CSRF,'',false,0)]);return {ok:true};});
 app.get(prefix+'api/pilot/session',async(req,reply)=>{const current=session(req);return current?{email:current.email,context:current.userId}:reply.code(401).send({message:'Entre na sua conta.'});});
 app.all(prefix+'*',async(req,reply)=>{
  const current=session(req);
  if(!current){if(req.method==='GET'&&!req.url.slice(prefix.length).startsWith('api/'))return reply.redirect(prefix+'login');return reply.code(401).send({message:'Entre na sua conta.'});}
  if(req.url.slice(prefix.length).startsWith('api/')&&req.headers['x-pilot-context']!==current.userId)return reply.code(409).send({message:'A conta desta janela mudou. Reabra a página antes de continuar.'});
  if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!equal(digest(String(req.headers['x-pilot-csrf']??'')),current.csrfHash))return reply.code(403).send({message:'Confirmação de segurança inválida. Reabra a página.'});
  let tenant=tenants.get(current.tenantId);if(!tenant){tenant=createApp({dataDir:join(config.dataDir,'tenants',current.tenantId),staticDir:config.staticDir,mode:'local',logRequests:false});tenants.set(current.tenantId,tenant);tenant.catch(()=>tenants.delete(current.tenantId));}
  const inner=await tenant;const path='/'+req.raw.url!.slice(prefix.length);
  const response=await inner.inject({method:req.method as HTTPMethods,url:path,headers:{...(req.headers['content-type']?{'content-type':req.headers['content-type']}:{}),...(typeof req.headers['x-expected-updated-at']==='string'?{'x-expected-updated-at':req.headers['x-expected-updated-at']}:{})},...(req.body===undefined?{}:{payload:typeof req.body==='string'?req.body:JSON.stringify(req.body)})});
  reply.code(response.statusCode);for(const header of ['content-type','content-disposition'])if(response.headers[header])reply.header(header,response.headers[header]);
  let body:Buffer|string=response.rawPayload;if((response.headers['content-type']??'').toString().startsWith('text/html'))body=response.body.replace('</head>',`<meta name="pilot-context" content="${current.userId}"><link rel="stylesheet" href="${prefix}pilot.css"><script src="${prefix}pilot-session.js"></script></head>`);
  return reply.send(body);
 });
 app.get('/artesaos-piloto',(_req,reply)=>reply.redirect(prefix));
 app.addHook('onClose',async()=>{await Promise.all([...tenants.values()].map(async t=>(await t).close()));store.close();});
 return app;
}
