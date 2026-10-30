import https from 'node:https';
// Test harness only. Never used by the production entrypoint or copied into its runtime image.
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createPilotApp} from '../server/pilot/app.ts';
if(process.env.PILOT_BROWSER_TEST!=='1')throw Error('Explicit disposable test mode required');
const dir=mkdtempSync(join(tmpdir(),'pilot-browser-'));
const origin='https://127.0.0.1:8298';
const config={publicUrl:new URL(origin+'/artesaos-piloto/'),prefix:'/artesaos-piloto/',dataDir:dir,staticDir:resolve('dist'),clientId:'synthetic',clientSecret:'synthetic',sessionHours:8,idleMinutes:30,maxUsers:5,initialInvites:[{email:'a@example.test',code:'synthetic-invite-a-01234567890123456789'},{email:'b@example.test',code:'synthetic-invite-b-01234567890123456789'}]};
const provider={async start(state){return 'https://accounts.google.com/test?state='+state;},async complete(url){const subject=url.searchParams.get('code');if(!['a','b'].includes(subject))throw Error('Unknown fixture');return {issuer:'https://accounts.google.com',subject,email:subject+'@example.test',verified:true};}};
const app=await createPilotApp(config,provider);
const tls=https.createServer({key:readFileSync(process.env.PILOT_TEST_KEY),cert:readFileSync(process.env.PILOT_TEST_CERT)},async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const response=await app.inject({method:req.method,url:req.url,headers:req.headers,...(body.length?{payload:body}:{})});res.writeHead(response.statusCode,response.headers);res.end(response.rawPayload);}catch{res.writeHead(500);res.end();}});
for(const sig of ['SIGTERM','SIGINT'])process.once(sig,async()=>{tls.close();await app.close();rmSync(dir,{recursive:true,force:true});process.exit(0);});
await new Promise(resolve=>tls.listen(8298,'127.0.0.1',resolve));
