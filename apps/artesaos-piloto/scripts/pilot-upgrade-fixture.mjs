// Disposable fixture only: reads an archived, pinned pilot source and creates fake data.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const [oldApp,dataDir,output,phase='seed']=process.argv.slice(2);
if(process.env.PILOT_UPGRADE_FIXTURE!=='1')throw Error('Disposable fixture flag required');
const {createPilotApp}=await import(pathToFileURL(join(oldApp,'server/pilot/app.ts')).href);
const {calculateManufacturing}=await import(pathToFileURL(join(oldApp,'server/manufacturing-model.ts')).href);
const origin='https://upgrade.example.test',prefix='/artesaos-piloto/';
const config={publicUrl:new URL(origin+prefix),prefix,dataDir,staticDir:process.env.PILOT_UPGRADE_STATIC,clientId:'fixture',clientSecret:'fixture',sessionHours:8,idleMinutes:30,maxUsers:5,adminEmails:['admin@example.test'],initialInvites:['a','b'].map(n=>({email:n+'@example.test',code:'synthetic-invite-'+n+'-01234567890123456789'}))};
let identity;const provider={async start(state){return 'https://accounts.google.com/fixture?state='+state;},async complete(){return identity;}};
const app=await createPilotApp(config,provider);
const request=(path,headers={},method='GET',payload)=>app.inject({url:prefix+path,method,headers:{host:'upgrade.example.test',...headers},...(payload===undefined?{}:{payload})});
async function json(path,headers,method,payload){const r=await request(path,headers,method,payload);assert.equal(r.statusCode,200,r.body);return r.json();}
async function login(n,admin=false){identity={issuer:'https://accounts.google.com',subject:n,email:n+'@example.test',verified:true};const start=await request(admin?'admin/auth/google/start':'auth/google/start',{origin},'POST',admin?{}:{invite:config.initialInvites.find(i=>i.email===identity.email).code});assert.equal(start.statusCode,302);const state=new URL(start.headers.location).searchParams.get('state');const flow=start.cookies.find(c=>c.name==='__Secure-artesaos_flow');const response=await request('auth/google/callback?state='+state+'&code=fixture',{cookie:flow.name+'='+flow.value});assert.equal(response.statusCode,200,response.body);return response;}
try{
 if(phase==='inspect'){
  const manifest=JSON.parse(readFileSync(output,'utf8'));
  for(const account of manifest.accounts){const products=await json('api/products',account.headers);assert.deepEqual(products,account.products);assert.equal(calculateManufacturing(products[0].manufacturing,account.settings).cost,account.beforeCost);}
  process.stdout.write('PASS: backup anterior restaurado e aberto pela versão antiga.\n');
 }else{
  const manifest={accounts:[]};
  for(const n of ['a','b']){
   const response=await login(n);const headers={origin,cookie:response.cookies.filter(c=>c.name!=='__Secure-artesaos_flow').map(c=>c.name+'='+c.value).join('; '),'x-pilot-csrf':response.cookies.find(c=>c.name==='__Secure-artesaos_csrf').value};headers['x-pilot-context']=(await json('api/pilot/session',headers)).context;
   const settings={filamentKgPrice:n==='a'?'100':'250',energyHour:'2',wearHour:'1',humanHour:'20',productiveHours:'160',wholesaleMarkup:'2',factoryMarkup:'2.5',retailMarkup:'4',internetCost:'40'};
   await json('api/settings/fabricacao',headers,'PUT',{data:settings,expectedRevision:0});
   const client=await json('api/clients',headers,'POST',{name:'Cliente '+n,contact:'Contato '+n,phone:'',email:'',taxDocument:'',postal:''});
   const quote=await json('api/quotes',headers,'POST',{data:{title:'Orçamento '+n,client:null,items:[],notes:'Preservar histórico'},expectedRevision:0});
   const step={machineSeconds:3600,humanSeconds:1800,materialGrams:100,extras:2,packaging:3,label:1};
   const product={name:'Produto '+n,sku:'SKU-'+n,origin:'own',publicAllowed:false,prices:{wholesale:1111,factory:2222,retail:3333},weightGrams:100,lengthCm:null,widthCm:null,heightCm:null,colors:[],sourceKeys:[],family:'Família '+n,description:'Descrição '+n,category:'',manufacturing:{...step,base:{...step,machineSeconds:1800,humanSeconds:900,materialGrams:50,extras:1,packaging:0,label:0}}};
   await json('api/products/editor',headers,'POST',{product,applyPrices:false});
   const archived=await json('api/products/editor',headers,'POST',{product:{...product,name:'Arquivado '+n},applyPrices:false});
   await json('api/records/products/actions',headers,'POST',{action:'archive',records:[{id:archived.id,updatedAt:archived.updatedAt}],confirm:true});
   const products=await json('api/products',headers),archivedProducts=await json('api/records/products/archived',headers);
   manifest.accounts.push({name:n,headers,settings,client:(await json('api/clients',headers)).find(c=>c.id===client.id),quote:await json('api/quotes/'+quote.id,headers),products,archivedProducts,beforeCost:calculateManufacturing(products[0].manufacturing,settings).cost,beforePrices:calculateManufacturing(products[0].manufacturing,settings).prices});
  }
  const tokenResponse=await request('api/interest/form');
  const sent=await request('api/interest',{origin,cookie:tokenResponse.cookies.map(c=>c.name+'='+c.value).join('; ')},'POST',{name:'Interessado anterior',email:'previous@example.test',whatsapp:'',consent:true,website:'',token:tokenResponse.json().token});assert.equal(sent.statusCode,202);
  const adminLogin=await login('admin',true);manifest.admin={cookie:adminLogin.cookies.filter(c=>c.name!=='__Secure-artesaos_flow').map(c=>c.name+'='+c.value).join('; '),origin,'x-pilot-admin-csrf':adminLogin.cookies.find(c=>c.name==='__Secure-artesaos_admin_csrf').value};manifest.admin['x-pilot-admin-context']=(await json('admin/api/session',manifest.admin)).context;
  writeFileSync(output,JSON.stringify(manifest),{mode:0o600});process.stdout.write('Fixture antiga criada com dados fictícios de duas contas.\n');
 }
}finally{await app.close();}
