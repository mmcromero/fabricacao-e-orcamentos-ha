import {test} from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {registerVersionGuard} from '../server/pilot/version-guard.js';
import {digest} from '../server/pilot/store.js';
const prefix='/prefix/',token='synthetic-session',marker=(v:string)=>digest(v+':'+token);
function read(header:string|undefined,name:string){return header?.split('; ').find(c=>c.startsWith(name+'='))?.slice(name.length+1)??'';}
async function fixture(version='new'){
 const app=Fastify();let writes=0;const cookie=`__Secure-artesaos_session=${token}`;
 registerVersionGuard(app,prefix,version,read,h=>read(h,'__Secure-artesaos_session')?{context:'synthetic-account'}:null,(c,a)=>`<html>update ${c} ${a}</html>`);
 app.get(prefix,async()=>'<html>application</html>');app.post(prefix+'api/save',async()=>({writes:++writes}));
 app.post(prefix+'auth/logout',async(_req,reply)=>reply.header('set-cookie','__Secure-artesaos_session=; Path=/prefix/; Max-Age=0').send({ok:true}));
 app.get(prefix+'auth/google/callback',async(_req,reply)=>reply.header('set-cookie',['__Secure-artesaos_session='+token,'__Secure-artesaos_admin_session='+token]).send({ok:true}));
 await app.ready();return {app,cookie,writes:()=>writes};
}
test('version guard: public version and unchanged session do not force logout',async()=>{const f=await fixture();try{const r=await f.app.inject({url:prefix+'version',headers:{cookie:f.cookie+'; __Secure-artesaos_version='+marker('new')}});assert.deepEqual(r.json(),{version:'new',reauthenticate:false});assert.equal(r.headers['set-cookie'],undefined);}finally{await f.app.close();}});
test('version guard: stale operation rejected before handler; existing state untouched',async()=>{const f=await fixture();try{const r=await f.app.inject({url:prefix+'api/save',method:'POST',headers:{cookie:f.cookie,'x-artesao-version':'old'}});assert.equal(r.statusCode,409);assert.equal(r.json().code,'APP_UPDATED');assert.equal(f.writes(),0);}finally{await f.app.close();}});
test('version guard: same version operation proceeds normally',async()=>{const f=await fixture();try{const r=await f.app.inject({url:prefix+'api/save',method:'POST',headers:{cookie:f.cookie+'; __Secure-artesaos_version='+marker('new'),'x-artesao-version':'new'}});assert.equal(r.statusCode,200);assert.equal(f.writes(),1);}finally{await f.app.close();}});
test('version guard: reload with old session stamp returns message shell, not business HTML',async()=>{const f=await fixture();try{const cookie=f.cookie+'; __Secure-artesaos_version='+marker('old');const r=await f.app.inject({url:prefix,headers:{cookie}});assert.match(r.body,/update synthetic-account/);assert.equal(r.headers['set-cookie'],undefined);const v=await f.app.inject({url:prefix+'version',headers:{cookie}});assert.equal(v.json().reauthenticate,true);}finally{await f.app.close();}});
test('version guard: fresh interface cannot bypass required login with stale session stamp',async()=>{const f=await fixture();try{const r=await f.app.inject({url:prefix+'api/save',method:'POST',headers:{cookie:f.cookie+'; __Secure-artesaos_version='+marker('old'),'x-artesao-version':'new'}});assert.equal(r.statusCode,409);assert.equal(f.writes(),0);}finally{await f.app.close();}});
test('version guard: OIDC callback stamps user and admin sessions without replacing auth cookies',async()=>{const f=await fixture();try{const r=await f.app.inject({url:prefix+'auth/google/callback'});assert.equal(r.cookies.length,4);assert.equal(r.cookies.find(c=>c.name==='__Secure-artesaos_version')?.value,marker('new'));assert.equal(r.cookies.find(c=>c.name==='__Secure-artesaos_admin_version')?.value,marker('new'));assert.ok(r.cookies.filter(c=>c.name.includes('_version')).every(c=>c.httpOnly&&c.secure));}finally{await f.app.close();}});
test('version guard: stale version may use existing logout; marker cleared with session',async()=>{const f=await fixture();try{const r=await f.app.inject({url:prefix+'auth/logout',method:'POST',headers:{cookie:f.cookie+'; __Secure-artesaos_version='+marker('old'),'x-artesao-version':'old'}});assert.equal(r.statusCode,200);assert.equal(r.cookies.find(c=>c.name==='__Secure-artesaos_version')?.value,'');}finally{await f.app.close();}});
test('version guard: same user new session stamp is token-bound',async()=>{const f=await fixture();try{const r=await f.app.inject({url:prefix+'version',headers:{cookie:'__Secure-artesaos_session=other-token; __Secure-artesaos_version='+marker('new')}});assert.equal(r.json().reauthenticate,true);}finally{await f.app.close();}});
