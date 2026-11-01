// Actual published 0.1.15 source, synthetic accounts/data, no external messages.
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,symlinkSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createPilotApp} from '../server/pilot/app.ts';
import {PilotStore,digest} from '../server/pilot/store.ts';
const temp=mkdtempSync(join(tmpdir(),'invitation-upgrade-')),oldRoot=join(temp,'old'),dataDir=join(temp,'data'),backup=join(temp,'backup');mkdirSync(oldRoot);
const origin='https://upgrade-invitations.example.test',prefix='/artesaos-piloto/';let app,control;
try{
 const archive=execFileSync('git',['archive','e4760f1','apps/umdoislab'],{cwd:resolve('../..'),maxBuffer:40*1024*1024});execFileSync('tar',['-x','-C',oldRoot],{input:archive});const source=join(oldRoot,'apps/umdoislab');symlinkSync(resolve('node_modules'),join(source,'node_modules'),'dir');execFileSync(process.execPath,['scripts/prepare-pilot-metadata.mjs'],{cwd:source});
 const {createPilotApp:oldApp}=await import(pathToFileURL(join(source,'server/pilot/app.ts')).href);const {PilotStore:OldStore}=await import(pathToFileURL(join(source,'server/pilot/store.ts')).href);
 const config={publicUrl:new URL(origin+prefix),prefix,dataDir,staticDir:resolve('dist'),clientId:'fixture',clientSecret:'fixture',sessionHours:8,idleMinutes:30,maxUsers:5,adminEmails:['admin@example.test']};
 const provider={async start(){throw Error('Not used');},async complete(){throw Error('Not used');}};
 app=await oldApp(config,provider);control=new OldStore(dataDir);const pending=control.invite('legacy@example.test');const existing=control.invite('existing@example.test');const identity={issuer:'https://accounts.google.com',subject:'existing',email:'existing@example.test',verified:true};const user=control.activate(identity,digest(existing),5),session=control.session(user,8),admin=control.adminSession({...identity,subject:'admin',email:'admin@example.test'}),context=control.getAdmin(admin.value,config.adminEmails).context;
 const adminHeaders={cookie:'__Secure-artesaos_admin_session='+admin.value,'x-pilot-admin-context':context,'x-pilot-admin-csrf':admin.csrf};const userHeaders={cookie:'__Secure-artesaos_session='+session.value,'x-pilot-context':user,'x-pilot-csrf':session.csrf};
 const req=(path,headers=adminHeaders,method='GET',payload)=>app.inject({url:prefix+path,method,headers:{host:new URL(origin).host,origin,...headers},...(payload===undefined?{}:{payload})});
 const company={name:'Empresa preservada',responsible:'Responsável',phone:'11999990000',email:'company@example.test'};assert.equal((await req('api/company',userHeaders,'PUT',{data:company,expectedRevision:0})).statusCode,200);
 await app.close();app=null;control.close();control=null;cpSync(dataDir,backup,{recursive:true});
 app=await createPilotApp(config,provider,null);control=new PilotStore(dataDir);assert.deepEqual((await req('api/company',userHeaders)).json().data,company);assert.equal((await req('admin/api/users')).json().total,1);
 const oldInvite=(await req('admin/api/invitations/'+digest(pending))).json();assert.equal(oldInvite.bindingMode,'email');assert.equal(oldInvite.code,null);assert.throws(()=>control.activate({...identity,subject:'wrong',email:'wrong@example.test'},digest(pending),5));
 const made=await req('admin/api/invitations',adminHeaders,'POST',{name:'Pessoa convidada',email:'contact@example.test',channel:'whatsapp',phone:'+5511999991234',requestKey:randomUUID()});assert.equal(made.statusCode,200,made.body);const invitation=made.json();const nextUser=control.activate({...identity,subject:'next',email:'google-different@example.test'},digest(invitation.code),5);assert.ok(nextUser);
 assert.equal((await req('admin/api/invitations')).json().total,1,'Only the old pending invite remains');assert.equal((await req('admin/api/users')).json().total,2);assert.equal((await req('admin/api/users/'+nextUser)).json().invitation.name,'Pessoa convidada');assert.equal((await req('admin/api/invitations/'+invitation.id)).json().acceptedGoogleEmail,'google-different@example.test');
 await app.close();app=null;control.close();control=null;app=await createPilotApp(config,provider,null);assert.equal((await req('admin/api/invitations/'+invitation.id)).json().code,invitation.code);await app.close();app=null;
 rmSync(dataDir,{recursive:true});cpSync(backup,dataDir,{recursive:true});app=await oldApp(config,provider);control=new OldStore(dataDir);assert.deepEqual((await req('api/company',userHeaders)).json().data,company);assert.equal(control.db.prepare('SELECT COUNT(*) n FROM pilot_users').get().n,1);assert.equal(control.db.prepare('SELECT used_at FROM pilot_invites WHERE hash=?').get(digest(pending)).used_at,null);
 console.log('PASS: real 0.1.15 -> current migration preserves session, company and email-bound legacy invite; new first-Google code, encrypted contact/key and restart work; full stopped-volume backup restored with original 0.1.15 code. Synthetic data only.');
}finally{if(app)await app.close();control?.close();rmSync(temp,{recursive:true,force:true});}
