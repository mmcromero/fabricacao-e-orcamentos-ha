import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server/app.js';
import {loadConfig} from '../server/config.js';
test('empresa ou contato e endereço completo persistem no cadastro e no snapshot',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'address-'));const options={dataDir:dir,staticDir:loadConfig({}).staticDir,mode:'local' as const};let app=await createApp(options);
 const create=(payload:object)=>app.inject({method:'POST',url:'/api/clients',payload});
 const base={name:'',contact:'',phone:'',email:'',taxDocument:'',postal:''};
 try{
  assert.equal((await create(base)).statusCode,400);
  assert.equal((await create({...base,name:'  ',contact:'\t'})).statusCode,400);
  assert.equal((await create({...base,name:'Empresa fictícia'})).statusCode,200);
  const full={...base,contact:'Pessoa fictícia',postal:'12345-678',street:'Rua de teste',number:'12 A',complement:'Sala de teste',district:'Bairro de teste',city:'Cidade de teste',state:'SP'};
  const response=await create(full);assert.equal(response.statusCode,200);const id=response.json().id;
  const quote=await app.inject({method:'POST',url:'/api/quotes',payload:{data:{client:{id,...full},items:[],notes:''},expectedRevision:0}});assert.equal(quote.statusCode,200);
  const qid=quote.json().id;
  await app.close();app=await createApp(options);
  let list=(await app.inject('/api/clients')).json();assert.equal(list[0].name,'');assert.equal(list[0].contact,full.contact);assert.equal(list[0].number,full.number);assert.equal(list[0].complement,full.complement);
  assert.equal(list[1].street,''); // Older records without address remain editable.
  const changed={...full,street:'Rua revisada'};
  assert.equal((await app.inject({method:'PUT',url:`/api/clients/${id}`,payload:changed})).statusCode,200);
  assert.equal((await app.inject(`/api/quotes/${qid}`)).json().data.client.street,full.street);
  const saved=(await app.inject(`/api/quotes/${qid}`)).json();
  assert.equal((await app.inject({method:'PUT',url:`/api/quotes/${qid}`,payload:{data:saved.data,expectedRevision:saved.revision}})).statusCode,200);
  assert.equal((await app.inject({method:'PUT',url:`/api/clients/${id}`,payload:{...full,contact:''}})).statusCode,400);
 }finally{await app.close();rmSync(dir,{recursive:true,force:true});}
});
