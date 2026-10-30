import type {FastifyInstance,FastifyReply} from 'fastify';
import type {PilotConfig} from './config.js';
import type {IdentityProvider} from './google.js';
import {PilotStore,token,digest,equal,type Identity} from './store.js';
import {InterestStore,parseInterest} from './interest.js';
import {interestForm,interestScript,adminScript} from './community-ui.js';
const ADMIN='__Secure-artesaos_admin_session',CSRF='__Secure-artesaos_admin_csrf',INTEREST='__Secure-artesaos_interest',FLOW='__Secure-artesaos_flow';
type Cookies=(header:string|undefined,name:string)=>string;
export function registerCommunity(app:FastifyInstance,config:PilotConfig,store:PilotStore,provider:IdentityProvider,readCookie:Cookies,browserTag:string,footer:string){
 const prefix=config.prefix,base=prefix+'admin/',allowed=(config.adminEmails??[]),interests=new InterestStore(config.dataDir);
 const adminCookie=(name:string,value:string,httpOnly=true,age=3600)=>`${name}=${encodeURIComponent(value)}; Path=${base}; Secure; SameSite=Lax; Max-Age=${age}${httpOnly?'; HttpOnly':''}`;
 const current=(req:{headers:{cookie?:string}})=>store.getAdmin(readCookie(req.headers.cookie,ADMIN),allowed);
 const page=(title:string,body:string,extra='')=>`<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Artesão Digital</title><link rel="stylesheet" href="${prefix}pilot.css">${browserTag}${extra}</head><body>${body}${footer}</body></html>`;
 const finishPage=()=>page('Concluindo administração',`<main class="pilot-auth"><h1>Concluindo acesso administrativo</h1><p id="finish-status" role="status">Confirmando acesso…</p><a id="finish-login" hidden href="${base}login">Entrar novamente</a></main>`,`<script defer src="${base}finish.js"></script>`);
 const available=()=>allowed.length>0;
 const cleanup=setInterval(()=>{try{interests.prune();}catch{app.log.error('Não foi possível executar a retenção da lista de interesse.');}},3600000);cleanup.unref();
 app.addHook('onClose',async()=>{clearInterval(cleanup);interests.close();});
 app.get(prefix+'interest.js',(_req,reply)=>reply.type('application/javascript').send(interestScript(prefix)));
 app.get(prefix+'api/interest/form',async(req,reply)=>{
  if(!available())return reply.code(503).send({message:'Lista temporariamente indisponível.'});
  if(req.headers['sec-fetch-site']==='cross-site'||(req.headers.origin&&req.headers.origin!==config.publicUrl.origin))return reply.code(403).send({message:'Origem não autorizada.'});
  if(store.limited('interest-form:'+req.ip,60))return reply.code(429).send({message:'Aguarde antes de tentar novamente.'});
  const browser=token(),nonce=token();interests.issue(browser,nonce);reply.header('Set-Cookie',`${INTEREST}=${browser}; Path=${prefix}api/interest; Secure; HttpOnly; SameSite=Strict; Max-Age=900`);return {token:nonce};
 });
 app.post(prefix+'api/interest',{bodyLimit:4096},async(req,reply)=>{
  if(!available())return reply.code(503).send({message:'Lista temporariamente indisponível.'});
  if(store.limited('interest-send:'+req.ip,20))return reply.code(429).send({message:'Muitas tentativas. Aguarde antes de tentar novamente.'});
  let data;try{data=parseInterest(req.body);}catch(e){return reply.code(400).send({message:(e as Error).message});}
  const body=req.body as Record<string,unknown>;
  if(typeof body.token!=='string'||body.token.length>100||!interests.consume(readCookie(req.headers.cookie,INTEREST),body.token))return reply.code(403).send({message:'O formulário expirou. Prepare-o novamente antes de enviar.'});
  if(body.website!==undefined&&(typeof body.website!=='string'||body.website))return reply.code(202).send({ok:true});
  try{interests.add(data);}catch{return reply.code(503).send({message:'Lista temporariamente indisponível. Tente novamente mais tarde.'});}
  return reply.code(202).send({ok:true});
 });
 app.get(base+'login',async(req,reply)=>{if(current(req))return reply.redirect(base);return reply.type('text/html').send(page('Acesso administrativo',`<main class="pilot-auth"><h1>Acesso administrativo</h1><p>Entrada exclusiva para contas autorizadas nas configurações do aplicativo.</p><form method="post" action="${base}auth/google/start"><button data-pilot-login disabled>Entrar na administração com Google</button></form><p>O login de usuário não concede acesso administrativo.</p><a href="${prefix}login">Voltar ao login de usuários</a></main>`));});
 app.post(base+'auth/google/start',{bodyLimit:4096},async(req,reply)=>{
  if(!available())return reply.code(403).send({message:'Acesso administrativo indisponível.'});
  if(store.limited('admin-login:'+req.ip,10))return reply.code(429).send({message:'Aguarde antes de tentar novamente.'});
  const state=token(),browser=token(),nonce=token(),verifier=token();
  try{const url=await provider.start(state,nonce,verifier);store.flow(state,browser,verifier,nonce,'','admin');reply.header('Set-Cookie',`${FLOW}=${browser}; Path=${prefix}; Secure; HttpOnly; SameSite=Lax; Max-Age=600`);return reply.redirect(url);}catch{return reply.code(503).send({message:'Não foi possível iniciar o login Google.'});}
 });
 app.get(base+'auth/finish',(_req,reply)=>reply.type('text/html').send(finishPage()));
 app.get(base+'finish.js',(_req,reply)=>reply.type('application/javascript').send(`(async()=>{history.replaceState(null,'',${JSON.stringify(base+'auth/finish')});const status=document.getElementById('finish-status');try{await window.pilotBrowserReady;const r=await fetch(${JSON.stringify(base+'api/session')},{cache:'no-store'});if(r.ok){location.replace(${JSON.stringify(base)});return;}}catch{}status.textContent='Não foi possível confirmar o acesso administrativo.';document.getElementById('finish-login').hidden=false;})();`));
 app.get(base+'session.js',(_req,reply)=>reply.type('application/javascript').send(adminScript(prefix)));
 app.get(base+'api/session',async(req,reply)=>{const admin=current(req);return admin?{email:admin.email,context:admin.context}:reply.code(401).send({message:'Entre com uma conta administrativa autorizada.'});});
 app.get(base+'api/interests',async(req,reply)=>{
  const admin=current(req);if(!admin)return reply.code(401).send({message:'Acesso administrativo necessário.'});
  if(req.headers['x-pilot-admin-context']!==admin.context)return reply.code(409).send({message:'A conta desta aba mudou. Reabra a administração.'});
  const query=req.query as Record<string,unknown>,n=query.page===undefined?1:Number(query.page);if(!Number.isSafeInteger(n)||n<1||n>100000)return reply.code(400).send({message:'Página inválida.'});
  return interests.list(n);
 });
 app.post(base+'auth/logout',async(req,reply)=>{
  const admin=current(req);if(admin&&(!equal(digest(String(req.headers['x-pilot-admin-csrf']??'')),admin.csrfHash)||req.headers['x-pilot-admin-context']!==admin.context))return reply.code(403).send({message:'Confirmação de segurança inválida.'});
  if(admin)store.adminLogout(readCookie(req.headers.cookie,ADMIN));reply.header('Set-Cookie',[adminCookie(ADMIN,'',true,0),adminCookie(CSRF,'',false,0)]);return {ok:true};
 });
 const adminPage=async(req:{headers:{cookie?:string}},reply:FastifyReply)=>{
  const admin=current(req);if(!admin)return reply.redirect(base+'login');
  return reply.type('text/html').send(page('Interessados no piloto',`<main class="pilot-admin"><h1>Interessados no piloto</h1><p>Lista restrita à administração. O registro de interesse não cria conta nem libera acesso.</p><p id="admin-total"></p><p id="admin-status" role="status" aria-live="polite"></p><div class="pilot-table"><table><thead><tr><th>Nome</th><th>E-mail</th><th>WhatsApp</th><th>Recebido em</th></tr></thead><tbody id="interest-rows"></tbody></table></div><nav id="admin-pagination" aria-label="Paginação de interessados" hidden><button id="admin-previous">Anterior</button><span id="admin-page"></span><button id="admin-next">Próxima</button></nav></main>`,`<meta name="pilot-admin-context" content="${admin.context}"><script defer src="${base}session.js"></script>`));
 };
 app.get(base,adminPage);app.get(prefix+'admin',(_req,reply)=>reply.redirect(base));
 app.all(base+'*',(_req,reply)=>reply.code(404).send({message:'Página administrativa não encontrada.'}));
 return {interestForm:()=>available()?interestForm():'<p>A lista de interesse está temporariamente indisponível.</p>',async completeAdmin(identity:Identity,req:{headers:{cookie?:string}},reply:FastifyReply){
  if(identity.issuer!=='https://accounts.google.com'||!identity.verified||!identity.subject||!allowed.includes(identity.email.toLowerCase()))return reply.code(403).send({message:'Esta conta não tem autorização administrativa.'});
  store.adminLogout(readCookie(req.headers.cookie,ADMIN));const created=store.adminSession(identity);reply.header('Set-Cookie',[`${FLOW}=; Path=${prefix}; Secure; HttpOnly; SameSite=Lax; Max-Age=0`,adminCookie(ADMIN,created.value),adminCookie(CSRF,created.csrf,false)]);return reply.type('text/html').send(finishPage());
 }};
}
