import {useEffect,useState,type ReactNode} from 'react';
type Status={enabled:boolean;required:boolean;version:string|null;termsHash:string|null};
export default function LegalGate({children}:{children:ReactNode}){
 const [status,setStatus]=useState<Status|null>(null),[checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const load=async()=>{const r=await fetch(new URL('api/legal/status',document.baseURI));if(!r.ok)throw Error('Não foi possível consultar os Termos. Atualize a página.');setStatus(await r.json());};
 useEffect(()=>{void load().catch(e=>setMessage(e.message));},[]);
 async function accept(){if(!status||!checked)return;setBusy(true);try{const r=await fetch(new URL('api/legal/accept',document.baseURI),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:status.version,termsHash:status.termsHash,accepted:true})});if(!r.ok){setChecked(false);await load();throw Error('Não foi possível registrar o aceite. Confira a versão atual e tente novamente.');}await load();}catch(e){setMessage(e instanceof Error?e.message:'Falha ao registrar aceite.');}finally{setBusy(false);}}
 if(status&&!status.required)return <>{children}</>;
 return <main className="products-screen"><h1>Termos de Uso</h1>{!status?<p>Consultando documentos…</p>:<><p>Antes das boas-vindas e do uso, leia os <a href="legal#terms" target="_blank" rel="noopener">Termos de Uso (versão {status.version})</a>.</p><p>Consulte separadamente o <a href="legal#privacy" target="_blank" rel="noopener">Aviso de Privacidade</a> e as <a href="legal#cookies" target="_blank" rel="noopener">informações de Cookies</a>.</p><label><input type="checkbox" checked={checked} disabled={busy} onChange={e=>setChecked(e.target.checked)}/>Li e aceito os Termos de Uso.</label><button disabled={!checked||busy} onClick={()=>void accept()}>Confirmar e continuar</button></>}<p role="alert">{message}</p></main>;
}
