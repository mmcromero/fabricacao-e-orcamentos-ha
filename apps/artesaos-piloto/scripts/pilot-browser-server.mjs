import {LocalAdmin,bindDistribution} from '../server/pilot/local-admin.ts';
import {PilotStore} from '../server/pilot/store.ts';
import http from 'node:http';
import https from 'node:https';
// Test harness only. Never used by the production entrypoint or copied into its runtime image.
import {readFileSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createPilotApp} from '../server/pilot/app.ts';
if(process.env.PILOT_BROWSER_TEST!=='1')throw Error('Explicit disposable test mode required');
const dir=mkdtempSync(join(tmpdir(),'pilot-browser-'));
if(process.env.PILOT_TEST_CONTROL_FILE)writeFileSync(process.env.PILOT_TEST_CONTROL_FILE,dir,{mode:0o600});
const testPort=Number(process.env.PILOT_TEST_PORT??8298);if(!Number.isInteger(testPort)||testPort<1024||testPort>65535)throw Error('Invalid test port');
const origin='https://127.0.0.1:'+testPort;
const config={publicUrl:new URL(origin+'/artesaos-piloto/'),prefix:'/artesaos-piloto/',dataDir:dir,staticDir:resolve('dist'),clientId:'synthetic',clientSecret:'synthetic',sessionHours:8,idleMinutes:30,maxUsers:null,adminEmails:['admin@example.test']};
if(process.env.PILOT_TEST_PUBLIC_ORIGIN==='1')config.publicUrl=new URL('https://artesaodigital.com.br:'+testPort+config.prefix);
const distribution=process.env.PILOT_TEST_DISTRIBUTION??'home-assistant';if(!['home-assistant','debian'].includes(distribution))throw Error('Invalid test distribution');config.distribution=distribution;
const seeds=new PilotStore(dir);bindDistribution(seeds,distribution);
if(distribution==='debian'){const local=new LocalAdmin(seeds);let code;local.issueCode('setup',value=>{code=value;});await local.setPassword('setup','admin@example.test','Synthetic admin pass 123!','Synthetic admin pass 123!',code);}
for(const account of ['a','b'])seeds.bootstrap(account+'@example.test','synthetic-invite-'+account+'-01234567890123456789');seeds.close();
const provider={async start(state){return 'https://accounts.google.com/test?state='+state;},async complete(url){const subject=url.searchParams.get('code');if(!['a','b','c','admin'].includes(subject))throw Error('Unknown fixture');return {issuer:'https://accounts.google.com',subject,email:subject+'@example.test',verified:true};}};
if(process.env.PILOT_TEST_LEGAL==='1'){const doc={version:'fixture-1',effectiveAt:'2026-01-01',text:'Documento fictício de teste. Não é texto jurídico publicado.'};writeFileSync(join(dir,'legal-config.json'),JSON.stringify({enabled:true,reviewed:true,terms:doc,privacy:doc,cookies:doc}));}
const app=await createPilotApp(config,provider);
const handle=async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const response=await app.inject({method:req.method,url:req.url,headers:req.headers,...(body.length?{payload:body}:{})});res.writeHead(response.statusCode,response.headers);res.end(response.rawPayload);}catch{res.writeHead(500);res.end();}};
const backend=process.env.PILOT_TEST_HTTP_BACKEND==='1';const tls=backend?http.createServer(handle):https.createServer({key:readFileSync(process.env.PILOT_TEST_KEY),cert:readFileSync(process.env.PILOT_TEST_CERT)},handle);
for(const sig of ['SIGTERM','SIGINT'])process.once(sig,async()=>{tls.close();await app.close();rmSync(dir,{recursive:true,force:true});process.exit(0);});
await new Promise(resolve=>tls.listen(backend?8296:testPort,backend?'0.0.0.0':'127.0.0.1',resolve));
