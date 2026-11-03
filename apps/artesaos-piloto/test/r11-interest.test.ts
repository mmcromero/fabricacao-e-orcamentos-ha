import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {interestScript} from '../server/pilot/community-ui.js';
function fixture(){
 let ready:()=>Promise<void>,submit:(e:unknown)=>Promise<void>,serial=0,posts=0,fail=false,invalid=false,block:Promise<void>|undefined;
 const tokens=new Set<string>(),fields={name:'Pessoa teste',email:'first@example.test',consent:'on'},button={disabled:true},status={textContent:''};
 const form={reportValidity:()=>true,reset(){fields.name='';fields.email='';},addEventListener(_name:string,fn:typeof submit){submit=fn;}};
 const fetch=async(path:string,options:any={})=>{if(path.endsWith('/form')){const token='token-'+(++serial);tokens.add(token);return {ok:true,json:async()=>({token})};}posts++;if(block)await block;if(fail){fail=false;return {ok:false,json:async()=>({message:'Falha controlada'})};}const payload=JSON.parse(options.body);if(!tokens.delete(payload.token))return {ok:false,json:async()=>({message:'Token inválido'})};return {ok:true,json:async()=>invalid?{}:{ok:true}};};
 runInNewContext(interestScript('/artesaos-piloto/'),{addEventListener:(_n:string,fn:typeof ready)=>{ready=fn;},document:{getElementById:(id:string)=>id==='interest-form'?form:id==='interest-submit'?button:status},window:{pilotBrowserReady:Promise.resolve()},fetch,FormData:class {get(key:string){return (fields as any)[key]??'';}},AbortSignal,Error});
 return {start:()=>ready!(),send:()=>submit!({preventDefault(){}}),fields,button,status,count:()=>posts,fail:()=>{fail=true;},invalid:()=>{invalid=true;},hold:(p:Promise<void>)=>{block=p;}};
}
test('R1.1 interessados: três envios consecutivos renovam token e liberam formulário',async()=>{const f=fixture();await f.start();for(let i=0;i<3;i++){f.fields.name='Pessoa '+i;f.fields.email=i+'@example.test';await f.send();assert.match(f.status.textContent,/Interesse registrado/);assert.equal(f.fields.email,'');assert.equal(f.button.disabled,false);}assert.equal(f.count(),3);});
test('R1.1 interessados: erro preserva campos e permite nova tentativa; resposta sem confirmação não limpa',async()=>{const f=fixture();await f.start();f.fail();await f.send();assert.equal(f.fields.email,'first@example.test');assert.match(f.status.textContent,/Falha controlada/);await f.send();assert.equal(f.fields.email,'');f.fields.email='next@example.test';f.invalid();await f.send();assert.equal(f.fields.email,'next@example.test');assert.match(f.status.textContent,/confirmar/);});
test('R1.1 interessados: submissão repetida durante envio não duplica solicitação',async()=>{const f=fixture();await f.start();let release!:()=>void;f.hold(new Promise<void>(r=>{release=r;}));const first=f.send();await f.send();assert.equal(f.count(),1);release();await first;assert.equal(f.button.disabled,false);});
