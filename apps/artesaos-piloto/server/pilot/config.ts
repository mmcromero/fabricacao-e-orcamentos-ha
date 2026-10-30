import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
export type PilotConfig={publicUrl:URL;prefix:string;dataDir:string;staticDir:string;clientId:string;clientSecret:string;sessionHours:number;idleMinutes:number;maxUsers:number;initialInvites?:{email:string;code:string}[]};
export function pilotConfig(env:NodeJS.ProcessEnv=process.env):PilotConfig{
 let options:Record<string,unknown>={};
 if(env.PILOT_OPTIONS_FILE)options=JSON.parse(readFileSync(env.PILOT_OPTIONS_FILE,'utf8'));
 const value=(key:string,option:string)=>String(env[key]??options[option]??'');
 const raw=value('PILOT_PUBLIC_URL','public_url');
 if(!raw)throw Error('Configure public_url HTTPS antes de iniciar o piloto.');
 const publicUrl=new URL(raw);
 if(publicUrl.protocol!=='https:'||publicUrl.username||publicUrl.password||publicUrl.search||publicUrl.hash||publicUrl.pathname!=='/artesaos-piloto/')throw Error('public_url deve usar HTTPS e terminar em /artesaos-piloto/, sem credenciais ou parâmetros.');
 const clientId=value('GOOGLE_CLIENT_ID','google_client_id'),clientSecret=value('GOOGLE_CLIENT_SECRET','google_client_secret');
 if(!clientId||!clientSecret)throw Error('Configure o cliente OAuth Google antes de iniciar o piloto.');
 return {publicUrl,prefix:publicUrl.pathname,dataDir:resolve(env.DATA_DIR??'/data'),staticDir:resolve(env.PILOT_STATIC_DIR??new URL('../../dist/',import.meta.url).pathname),clientId,clientSecret,sessionHours:8,idleMinutes:30,maxUsers:5,initialInvites:[1,2,3,4,5].map(n=>({email:value(`PILOT_TEST_EMAIL_${n}`,`test_email_${n}`),code:value(`PILOT_TEST_INVITE_${n}`,`test_invite_${n}`)})).filter(i=>i.email||i.code)};
}
