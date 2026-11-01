import {randomBytes,createCipheriv,createDecipheriv,randomUUID} from 'node:crypto';
import {existsSync,writeFileSync,readFileSync,lstatSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {PilotStore,digest,token} from './store.js';
export class InvitationError extends Error{constructor(readonly status:number,message:string){super(message);}}
export class Invitations{
 private key:Buffer;
 constructor(private store:PilotStore,dir:string){
  store.db.exec(`CREATE TABLE IF NOT EXISTS pilot_invitation_details(hash TEXT PRIMARY KEY REFERENCES pilot_invites(hash),created_at INTEGER NOT NULL,created_by TEXT NOT NULL,request_key TEXT NOT NULL UNIQUE,iv BLOB NOT NULL,tag BLOB NOT NULL,payload BLOB NOT NULL);
  CREATE TABLE IF NOT EXISTS pilot_invitation_deliveries(id TEXT PRIMARY KEY,invite_hash TEXT NOT NULL REFERENCES pilot_invites(hash),request_key TEXT NOT NULL UNIQUE,actor TEXT NOT NULL,started_at INTEGER NOT NULL,finished_at INTEGER,method TEXT NOT NULL,status TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS pilot_invitation_keycheck(id INTEGER PRIMARY KEY CHECK(id=1),iv BLOB NOT NULL,tag BLOB NOT NULL,payload BLOB NOT NULL);`);
  const path=join(dir,'pilot-invitations.key');
  if(!existsSync(path)){if(store.db.prepare('SELECT 1 FROM pilot_invitation_keycheck').get()||store.db.prepare('SELECT 1 FROM pilot_invitation_details').get())throw Error('Chave dos convites ausente. Restaure a cópia completa do volume.');try{writeFileSync(path,randomBytes(32),{flag:'wx',mode:0o600});}catch(e){if(!existsSync(path))throw e;}}
  if(!lstatSync(path).isFile()||lstatSync(path).isSymbolicLink())throw Error('Chave dos convites inválida.');chmodSync(path,0o600);this.key=readFileSync(path);if(this.key.length!==32)throw Error('Chave dos convites inválida.');
  const check=store.db.prepare('SELECT * FROM pilot_invitation_keycheck WHERE id=1').get();if(check){if(this.decrypt(check,'keycheck')!=='pilot-invitations-v1')throw Error('Chave dos convites inválida.');}else{const c=this.encrypt('pilot-invitations-v1','keycheck');store.db.prepare('INSERT INTO pilot_invitation_keycheck VALUES(1,?,?,?)').run(c.iv,c.tag,c.payload);}
  // A process interrupted during SMTP cannot prove whether the provider accepted the message.
  store.db.prepare("UPDATE pilot_invitation_deliveries SET status='unconfirmed',finished_at=? WHERE status='sending'").run(Date.now());
 }
 private encrypt(text:string,aad:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',this.key,iv);c.setAAD(Buffer.from(aad));return {iv,payload:Buffer.concat([c.update(text,'utf8'),c.final()]),tag:c.getAuthTag()};}
 private decrypt(row:Record<string,unknown>,aad:string){const c=createDecipheriv('aes-256-gcm',this.key,row.iv as Uint8Array);c.setAAD(Buffer.from(aad));c.setAuthTag(row.tag as Uint8Array);return Buffer.concat([c.update(row.payload as Uint8Array),c.final()]).toString('utf8');}
 private record(row:Record<string,unknown>,includeCode=false){
  const accepted=row.accepted_user_id?this.store.db.prepare('SELECT email FROM pilot_users WHERE id=?').get(String(row.accepted_user_id)):null;
  const saved=row.payload?JSON.parse(this.decrypt(row,String(row.hash))):null;
  return {id:String(row.hash),bindingMode:row.binding_mode==='first_google'?'first_google':'email',acceptedGoogleEmail:accepted?String(accepted.email):null,name:saved?.name??null,channel:saved?.channel??'email',phone:saved?.phone||null,email:String(row.email),createdAt:row.created_at?Number(row.created_at):null,expiresAt:Number(row.expires_at),acceptedAt:row.used_at?Number(row.used_at):null,status:row.used_at?'accepted':row.revoked?'revoked':Number(row.expires_at)<=Date.now()?'expired':'pending',legacy:!saved,codeAvailable:!!saved,...(includeCode?{code:saved?.code??null}:{})};
 }
 private row(id:string){return this.store.db.prepare('SELECT i.*,d.created_at,d.created_by,d.request_key,d.iv,d.tag,d.payload FROM pilot_invites i LEFT JOIN pilot_invitation_details d ON d.hash=i.hash WHERE i.hash=?').get(id);}
 detail(id:string){const row=this.row(id);if(!row)throw new InvitationError(404,'Convite não encontrado.');return this.record(row,true);}
 contactForUser(userId:string){const row=this.store.db.prepare('SELECT i.*,d.created_at,d.iv,d.tag,d.payload FROM pilot_invites i JOIN pilot_invitation_details d ON d.hash=i.hash WHERE i.accepted_user_id=? AND i.used_at IS NOT NULL ORDER BY i.used_at LIMIT 1').get(userId);if(!row)return null;const item=this.record(row);return {name:item.name,email:item.email,phone:item.phone,channel:item.channel,registeredAt:item.createdAt};}
 list(page=1,status='unaccepted'){
  const condition=status==='unaccepted'?'i.used_at IS NULL':status==='accepted'?'i.used_at IS NOT NULL':status==='revoked'?'i.used_at IS NULL AND i.revoked=1':status==='expired'?'i.used_at IS NULL AND i.revoked=0 AND i.expires_at<=?':status==='pending'?'i.used_at IS NULL AND i.revoked=0 AND i.expires_at>?':'1=1';
  const args=status==='expired'||status==='pending'?[Date.now()]:[];const total=Number(this.store.db.prepare('SELECT COUNT(*) n FROM pilot_invites i WHERE '+condition).get(...args)!.n),pages=Math.max(1,Math.ceil(total/25)),current=Math.min(page,pages);
  const records=this.store.db.prepare('SELECT i.*,d.created_at,d.iv,d.tag,d.payload FROM pilot_invites i LEFT JOIN pilot_invitation_details d ON d.hash=i.hash WHERE '+condition+' ORDER BY COALESCE(d.created_at,i.expires_at-86400000) DESC,i.hash LIMIT 25 OFFSET ?').all(...args,(current-1)*25).map(row=>this.record(row));return {records,total,page:current,pages};
 }
 issue(name:string,email:string,actor:string,requestKey:string,maxUsers:number,channel:'email'|'whatsapp'='email',phone=''){
  name=name.trim();email=email.trim().toLowerCase();if(!name||name.length>100||/[\x00-\x1f\x7f<>]/.test(name)||email.length>254||(email!==''&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||/[\x00-\x20\x7f<>;,]/.test(email)||channel==='email'&&!email)throw new InvitationError(400,'Confira nome e e-mail do destinatário.');
  if(phone){if(!/^[+\d ()-]+$/.test(phone))throw new InvitationError(400,'Informe o WhatsApp com DDI e DDD.');phone=phone.replace(/\D/g,'');if(!/^[1-9]\d{7,14}$/.test(phone))throw new InvitationError(400,'Informe o WhatsApp com DDI e DDD.');}else if(channel==='whatsapp')throw new InvitationError(400,'Informe o WhatsApp com DDI e DDD.');
  const db=this.store.db;db.exec('BEGIN IMMEDIATE');
  try{
   const previous=db.prepare('SELECT hash,created_by FROM pilot_invitation_details WHERE request_key=?').get(requestKey);
   if(previous){const found=this.detail(String(previous.hash));if(found.name!==name||found.email!==email||previous.created_by!==actor||found.channel!==channel||found.phone!==(phone||null))throw new InvitationError(409,'Identificador de solicitação já utilizado.');db.exec('COMMIT');return found;}
   const pending=db.prepare('SELECT i.*,d.iv,d.tag,d.payload FROM pilot_invites i LEFT JOIN pilot_invitation_details d ON d.hash=i.hash WHERE i.used_at IS NULL AND i.revoked=0 AND i.expires_at>?').all(Date.now());
   if(pending.some(row=>email&&row.email===email||phone&&this.record(row).phone===phone))throw new InvitationError(409,'Já existe convite válido para este contato. Consulte o histórico antes de gerar outro.');
   const accounts=Number(db.prepare('SELECT COUNT(*) n FROM pilot_users').get()!.n),reserved=Number(db.prepare("SELECT COUNT(DISTINCT CASE WHEN binding_mode='first_google' THEN 'code:'||hash ELSE 'email:'||email END) n FROM pilot_invites WHERE used_at IS NULL AND revoked=0 AND expires_at>? AND (binding_mode='first_google' OR email NOT IN (SELECT email FROM pilot_users))").get(Date.now())!.n);
   if(accounts+reserved>=maxUsers)throw new InvitationError(409,'O limite do piloto já está ocupado por contas ou convites válidos.');
   const code=token(),hash=digest(code),createdAt=Date.now();
   db.prepare("INSERT INTO pilot_invites(hash,email,expires_at,binding_mode) VALUES(?,?,?,'first_google')").run(hash,email,createdAt+86400000);
   const c=this.encrypt(JSON.stringify({name,code,channel,phone}),hash);
   db.prepare('INSERT INTO pilot_invitation_details VALUES(?,?,?,?,?,?,?)').run(hash,createdAt,actor,requestKey,c.iv,c.tag,c.payload);const result=this.detail(hash);db.exec('COMMIT');return result;
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 beginDelivery(id:string,actor:string,requestKey:string,method:'smtp'='smtp'){
  const db=this.store.db;db.exec('BEGIN IMMEDIATE');try{
   const old=db.prepare('SELECT * FROM pilot_invitation_deliveries WHERE request_key=?').get(requestKey);
   if(old){if(old.invite_hash!==id||old.actor!==actor||old.method!==method)throw new InvitationError(409,'Identificador de envio já utilizado.');db.exec('COMMIT');return {id:String(old.id),fresh:false};}
   const record=this.detail(id);if(record.status!=='pending')throw new InvitationError(409,'Este convite já foi aceito, expirou ou foi revogado.');
   if(method==='smtp'&&record.channel!=='email')throw new InvitationError(400,'Este convite foi preparado para envio pelo WhatsApp.');
   if(method==='smtp'&&!record.code)throw new InvitationError(409,'O código deste convite antigo não está disponível.');
   if(db.prepare("SELECT 1 FROM pilot_invitation_deliveries WHERE invite_hash=? AND status='sending'").get(id))throw new InvitationError(409,'Já existe um envio em andamento para este convite.');
   if(method==='smtp'&&db.prepare("SELECT 1 FROM pilot_invitation_deliveries WHERE invite_hash=? AND method='smtp' AND started_at>?").get(id,Date.now()-60000))throw new InvitationError(429,'Aguarde um minuto antes de tentar outro envio.');
   if(Number(db.prepare('SELECT COUNT(*) n FROM pilot_invitation_deliveries WHERE invite_hash=?').get(id)!.n)>=100)throw new InvitationError(409,'Este convite atingiu o limite de registros de envio.');
   const attempt=randomUUID(),now=Date.now();db.prepare('INSERT INTO pilot_invitation_deliveries VALUES(?,?,?,?,?,?,?,?)').run(attempt,id,requestKey,actor,now,null,method,'sending');db.exec('COMMIT');return {id:attempt,fresh:true};
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 finishDelivery(id:string,confirmed:boolean){this.store.db.prepare("UPDATE pilot_invitation_deliveries SET status=?,finished_at=? WHERE id=? AND status='sending'").run(confirmed?'smtp_accepted':'unconfirmed',Date.now(),id);}
 close(){this.key.fill(0);}
}
