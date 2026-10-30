import type {CustomFetch} from 'openid-client';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {googleProvider} from '../server/pilot/google.js';
import type {PilotConfig} from '../server/pilot/config.js';
const base='https://pilot.example.test/artesaos-piloto/';
const config:PilotConfig={publicUrl:new URL(base),prefix:'/artesaos-piloto/',dataDir:'/tmp/unused',staticDir:'/tmp/unused',clientId:'synthetic-client',clientSecret:'synthetic-secret',sessionHours:8,idleMinutes:30,maxUsers:5};
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
function jwt(claims:object,forged=false){const enc=(v:object)=>Buffer.from(JSON.stringify(v)).toString('base64url');const data=enc({alg:'RS256',kid:'key-1'})+'.'+enc(claims);return data+'.'+(forged?Buffer.alloc(256):sign('RSA-SHA256',Buffer.from(data),privateKey)).toString('base64url');}
test('adaptador Google valida assinatura, audiência, nonce, validade e e-mail verificado',async()=>{
 async function attempt(overrides:object={},forged=false){
  const claims={iss:'https://accounts.google.com',aud:config.clientId,sub:'synthetic-subject',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300,nonce:'test-nonce',email:'a@example.test',email_verified:true,...overrides};
  const transport:CustomFetch=async(input,init)=>{const url=String(input);let body:unknown;
   if(url.includes('.well-known'))body={issuer:'https://accounts.google.com',authorization_endpoint:'https://accounts.google.com/o/oauth2/v2/auth',token_endpoint:'https://oauth2.googleapis.com/token',jwks_uri:'https://www.googleapis.com/oauth2/v3/certs',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256'],token_endpoint_auth_methods_supported:['client_secret_post'],code_challenge_methods_supported:['S256']};
   else if(url.includes('/token')){const params=new URLSearchParams(String(init?.body));assert.equal(params.get('code_verifier'),'test-verifier');body={access_token:'synthetic-access',token_type:'Bearer',expires_in:300,id_token:jwt(claims,forged)};}
   else if(url.includes('/certs'))body={keys:[{...publicKey.export({format:'jwk'}),kid:'key-1',alg:'RS256',use:'sig'}]};
   else throw Error('Unexpected URL');
   return new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
  };
  const provider=googleProvider(config,transport);const start=new URL(await provider.start('test-state','test-nonce','test-verifier'));assert.equal(start.searchParams.get('redirect_uri'),base+'auth/google/callback');assert.equal(start.searchParams.get('code_challenge_method'),'S256');
  return provider.complete(new URL(base+'auth/google/callback?state=test-state&code=synthetic-code'),'test-state','test-nonce','test-verifier');
 }
 assert.equal((await attempt()).email,'a@example.test');
 await assert.rejects(attempt({aud:'another-client'}));await assert.rejects(attempt({nonce:'wrong'}));await assert.rejects(attempt({exp:Math.floor(Date.now()/1000)-300}));await assert.rejects(attempt({email_verified:false}));await assert.rejects(attempt({},true));
});
