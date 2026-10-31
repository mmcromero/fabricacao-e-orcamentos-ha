import {DatabaseSync} from 'node:sqlite';
import {existsSync,readFileSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {digest} from './store.js';
type LegalDocument={version:string;effectiveAt:string;text:string};
type LegalConfig={enabled:boolean;reviewed:boolean;terms:LegalDocument;privacy:LegalDocument;cookies:LegalDocument};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export class LegalStore{
 readonly db:DatabaseSync;readonly config:LegalConfig|null;
 constructor(dir:string){
  const path=join(dir,'legal-config.json');this.config=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
  this.db=new DatabaseSync(join(dir,'pilot-legal.sqlite'));chmodSync(join(dir,'pilot-legal.sqlite'),0o600);
  this.db.exec('CREATE TABLE IF NOT EXISTS documents(kind TEXT NOT NULL,version TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(kind,version)); CREATE TABLE IF NOT EXISTS acceptances(account TEXT NOT NULL,version TEXT NOT NULL,accepted_at TEXT NOT NULL,PRIMARY KEY(account,version))');
  try{if(this.config?.enabled){
   if(this.config.reviewed!==true)throw Error('Documentos legais não revisados.');
   this.db.exec('BEGIN IMMEDIATE');
   for(const kind of ['terms','privacy','cookies'] as const){
    const doc=this.config[kind];if(!doc||!doc.version?.trim()||doc.version.length>100||!doc.text?.trim()||doc.text.length>100000||!Number.isFinite(Date.parse(doc.effectiveAt))||Date.parse(doc.effectiveAt)>Date.now())throw Error('Documento legal inválido ou ainda sem vigência.');
    const data=JSON.stringify({version:doc.version,effectiveAt:doc.effectiveAt,text:doc.text});
    const old=this.db.prepare('SELECT data FROM documents WHERE kind=? AND version=?').get(kind,doc.version);
    if(old&&old.data!==data)throw Error('Versão jurídica imutável: crie uma nova versão.');
    this.db.prepare('INSERT OR IGNORE INTO documents VALUES(?,?,?)').run(kind,doc.version,data);
   }
   this.db.exec('COMMIT');
  }}catch(e){if(this.db.isTransaction)this.db.exec('ROLLBACK');this.db.close();throw e;}
 }
 status(account:string){const enabled=this.config?.enabled===true;const version=enabled?this.config!.terms.version:null;return {enabled,version,termsHash:enabled?digest(this.config!.terms.text):null,required:enabled&&!this.db.prepare('SELECT 1 FROM acceptances WHERE account=? AND version=?').get(account,version!)};}
 accept(account:string,version:unknown,hash:unknown,accepted:unknown){const current=this.status(account);if(!current.enabled||accepted!==true||version!==current.version||hash!==current.termsHash)return false;this.db.prepare('INSERT OR IGNORE INTO acceptances VALUES(?,?,?)').run(account,current.version!,new Date().toISOString());return true;}
 publicPage(prefix:string){const active=this.config?.enabled===true;return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informações públicas — Artesão Digital</title><link rel="stylesheet" href="${prefix}pilot.css"></head><body><main class="pilot-auth"><h1>Artesão Digital</h1><p>Responsável: Marco Romero. Contato público de privacidade: <a href="mailto:artesaodigital00@gmail.com">artesaodigital00@gmail.com</a>.</p><p>Piloto gratuito por convite, em preparação. Servidor pessoal administrado pelo responsável no Brasil. Ainda não há sistema de backup dos dados configurado.</p><p>O acesso usa o Google para confirmar a identidade e o convite. O sistema recebe identificação e e-mail verificado antes do aceite no aplicativo. O Google é fornecedor externo; a hospedagem brasileira não significa tratamento exclusivamente no Brasil.</p>${active?(['terms','privacy','cookies'] as const).map((kind,i)=>{const d=this.config![kind];return `<section id="${kind}"><h2>${['Termos de Uso','Aviso de Privacidade','Cookies'][i]}</h2><p>Versão ${escape(d.version)} · Vigência ${escape(d.effectiveAt)}</p><div style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(d.text)}</div></section>`;}).join(''):'<p>Termos de Uso, Aviso de Privacidade e informações de Cookies estão em preparação. Nenhuma minuta foi ativada como documento definitivo.</p>'}<a href="${prefix}login">Voltar ao acesso</a></main></body></html>`;}
 close(){this.db.close();}
}
