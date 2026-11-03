import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {loadingScript} from '../server/pilot/loading.js';
function fixture(){
 const listeners:Record<string,Function>={},docListeners:Record<string,Function>={};let status:any=null;let fetcher:Function=()=>Promise.resolve({ok:true});
 class Form{method='post';action='https://example.test/prefix/admin/auth/login';button={disabled:false};attrs:Record<string,string>={};querySelectorAll(){return [this.button];}getAttribute(name:string){return this.attrs[name]??null;}setAttribute(k:string,v:string){this.attrs[k]=v;}removeAttribute(k:string){delete this.attrs[k];}}
 const document={body:{append:(s:any)=>{status=s;}},baseURI:'https://example.test/prefix/',readyState:'complete',getElementById:()=>status,createElement:()=>({style:{},hidden:false,textContent:'',setAttribute(){}}),addEventListener:(name:string,fn:Function)=>{docListeners[name]=fn;}};
 const window:any={fetch:(...args:any[])=>fetcher(...args)};
 runInNewContext(loadingScript('/prefix/'),{window,document,location:new URL('https://example.test/prefix/admin/users'),URL,HTMLFormElement:Form,addEventListener:(name:string,fn:Function)=>{listeners[name]=fn;}});
 return {window,Form,listeners,docListeners,status:()=>status,fetcher:(f:Function)=>{fetcher=f;}};
}
test('loading: concurrent requests remain visible until all settle, including rejection',async()=>{
 const f=fixture();let finish!:Function,fail!:Function;let n=0;f.fetcher(()=>new Promise((resolve,reject)=>{if(++n===1)finish=resolve;else fail=reject;}));
 const a=f.window.fetch('https://example.test/prefix/admin/api/users'),b=f.window.fetch('https://example.test/prefix/admin/api/interests');assert.equal(f.status().hidden,false);
 finish({ok:true});await a;assert.equal(f.status().hidden,false);fail(Error('synthetic'));await assert.rejects(b);assert.equal(f.status().hidden,true);
});
test('loading: ignores other origins and unrelated business requests',async()=>{
 const f=fixture();await f.window.fetch('https://other.test/prefix/admin/api/users');await f.window.fetch('https://example.test/prefix/api/sales');assert.equal(f.status().hidden,true);
});
test('loading: native login preserves request and restores buttons on BFCache return',()=>{
 const f=fixture(),form=new f.Form();let prevented=false;const e={target:form,defaultPrevented:false,preventDefault(){prevented=true;}};
 f.docListeners.submit(e);assert.equal(prevented,false);assert.equal(form.button.disabled,true);assert.equal(form.attrs['aria-busy'],'true');assert.equal(f.status().hidden,false);
 f.listeners.pageshow({persisted:false});assert.equal(f.status().hidden,false);
 f.docListeners.submit(e);assert.equal(prevented,true);f.listeners.pageshow({persisted:true});assert.equal(form.button.disabled,false);assert.equal(form.attrs['aria-busy'],undefined);assert.equal(f.status().hidden,true);
});
test('loading: completion token is idempotent and old completion cannot hide a new job',()=>{
 const f=fixture();const done=f.window.pilotLoading.begin('old');f.listeners.pageshow({persisted:true});const newer=f.window.pilotLoading.begin('new');done();done();assert.equal(f.status().hidden,false);assert.equal(f.status().textContent,'new');newer();assert.equal(f.status().hidden,true);
});
test('loading: modified and same-page navigation do not start indicators',()=>{
 const f=fixture();const link={href:'https://example.test/prefix/admin/users',target:'',hasAttribute:()=>false};const e:any={defaultPrevented:false,button:0,target:{closest:()=>link}};
 f.docListeners.click(e);assert.equal(f.status().hidden,true);link.href='https://example.test/prefix/admin/support';f.docListeners.click({...e,ctrlKey:true});assert.equal(f.status().hidden,true);f.docListeners.click(e);assert.equal(f.status().hidden,false);f.listeners.keydown({key:'Escape'});assert.equal(f.status().hidden,true);
});

test('loading: Escape releases native login state without changing form data',()=>{
 const f=fixture(),form=new f.Form();f.docListeners.submit({target:form,defaultPrevented:false});assert.equal(form.button.disabled,true);f.listeners.keydown({key:'Escape'});assert.equal(form.button.disabled,false);assert.equal(f.status().hidden,true);
});
test('loading: common and HA-admin Google forms share feedback without changing action',()=>{
 for(const action of ['https://example.test/prefix/auth/google/start','https://example.test/prefix/admin/auth/google/start']){
  const f=fixture(),form=new f.Form();form.action=action;f.docListeners.submit({target:form,defaultPrevented:false});assert.equal(f.status().textContent,'Abrindo acesso Google…');assert.equal(form.action,action);assert.equal(form.method,'post');
 }
});
