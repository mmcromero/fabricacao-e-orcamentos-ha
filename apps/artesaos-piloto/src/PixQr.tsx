import {useEffect,useMemo,useRef,useState} from 'react';
import qrcode from 'qrcode-generator';
import ActionButton from './ActionButton';
import {normalizePixKey,pixPayload,validPixKey,type PixReceiver} from './pix-brcode';
import {judgeCharge,nextPollDelay,POLL_LIMIT_MS,type ChargeStatus} from './pix-poll';
const STORAGE='artesao.pix.receiver';
const money=(n:number)=>(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function loadReceiver():PixReceiver|null{
 try{const v=JSON.parse(localStorage.getItem(STORAGE)||'null');return v&&typeof v.key==='string'&&typeof v.name==='string'&&typeof v.city==='string'?v:null;}catch{return null;}
}
function saveReceiver(value:PixReceiver){try{localStorage.setItem(STORAGE,JSON.stringify(value));}catch{/* sem armazenamento: vale só para esta tela */}}
const maskKey=(key:string)=>key.length<=8?key:key.slice(0,4)+'…'+key.slice(-4);
const svgOf=(payload:string)=>{const qr=qrcode(0,'M');qr.addData(payload,'Byte');qr.make();return qr.createSvgTag({cellSize:4,margin:4,scalable:true});};
async function api(path:string,method='GET',body?:unknown){
 const r=await fetch(new URL('api/'+path,document.baseURI),{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(data.message||'Não foi possível concluir.'),{status:r.status});return data;
}
type Charge={id:string;amountCents:number;qrCode:string;phase:'waiting'|'paid'|'closed'|'stale'};

/** QR Pix com o valor da venda. O QR comum funciona sempre (inclusive sem internet);
 *  o QR com confirmação automática aparece só quando o servidor libera a conta. */
export default function PixQr({amountCents,onPaid}:{amountCents:number;onPaid?:(id:string)=>void}){
 const [receiver,setReceiver]=useState<PixReceiver|null>(loadReceiver),[editing,setEditing]=useState(false),[form,setForm]=useState<PixReceiver>(receiver??{key:'',name:'',city:''}),[error,setError]=useState(''),[copied,setCopied]=useState(false);
 const [enabled,setEnabled]=useState(false),[charge,setCharge]=useState<Charge|null>(null),[note,setNote]=useState(''),[creating,setCreating]=useState(false);
 const txid=useRef('AD'+Date.now().toString(36).toUpperCase()),paidCb=useRef(onPaid);paidCb.current=onPaid;
 useEffect(()=>{let live=true;if(navigator.onLine)api('pix-mp/status').then(s=>{if(live)setEnabled(!!s.enabled);}).catch(()=>{});return()=>{live=false;};},[]);
 // Valor mudou depois de gerar a cobrança: o QR automático não vale mais para esta venda.
 useEffect(()=>{if(charge&&charge.phase==='waiting'&&charge.amountCents!==amountCents){setCharge({...charge,phase:'stale'});setNote('O valor mudou. Gere um novo QR automático.');}},[amountCents,charge]);
 // Consulta enquanto o QR automático está na tela: pausa em segundo plano e sem internet.
 const waitingId=charge?.phase==='waiting'?charge.id:'',expected=charge?.amountCents??0;
 useEffect(()=>{
  if(!waitingId)return;let stop=false,timer:ReturnType<typeof setTimeout>|undefined,attempt=0;const started=Date.now();
  const schedule=(ms:number)=>{timer=setTimeout(tick,ms);};
  const tick=async()=>{
   if(stop)return;
   if(Date.now()-started>POLL_LIMIT_MS){setCharge(c=>c&&c.id===waitingId?{...c,phase:'closed'}:c);setNote('Tempo esgotado. Se o cliente já pagou, confira no banco.');return;}
   if(document.hidden||!navigator.onLine){schedule(2000);return;}
   try{
    const result:ChargeStatus=await api('pix-mp/charges/'+waitingId);if(stop)return;const verdict=judgeCharge(result,expected);attempt+=1;
    if(verdict==='paid'){setCharge(c=>c&&c.id===waitingId?{...c,phase:'paid'}:c);setNote('');paidCb.current?.(waitingId);return;}
    if(verdict==='closed'){setCharge(c=>c&&c.id===waitingId?{...c,phase:'closed'}:c);setNote('A cobrança expirou ou foi cancelada. Gere um novo QR.');return;}
    if(verdict==='mismatch'){setCharge(c=>c&&c.id===waitingId?{...c,phase:'closed'}:c);setNote('O valor da cobrança não confere com a venda. Confira no banco.');return;}
    setNote('');schedule(nextPollDelay(attempt));
   }catch(e){if(stop)return;attempt+=1;setNote((e as Error).message||'Sem conexão. Tentando de novo…');schedule(Math.max(nextPollDelay(attempt),5000));}
  };
  const wake=()=>{if(!document.hidden&&!stop){clearTimeout(timer);schedule(500);}};
  document.addEventListener('visibilitychange',wake);window.addEventListener('online',wake);schedule(nextPollDelay(0));
  return()=>{stop=true;clearTimeout(timer);document.removeEventListener('visibilitychange',wake);window.removeEventListener('online',wake);};
 },[waitingId,expected]);
 const result=useMemo(()=>{
  if(!receiver||editing)return null;
  try{const payload=pixPayload(receiver,amountCents,txid.current);return {payload,svg:svgOf(payload),error:''};}
  catch(e){return {payload:'',svg:'',error:(e as Error).message};}
 },[receiver,editing,amountCents]);
 const autoSvg=useMemo(()=>charge&&charge.phase==='waiting'?svgOf(charge.qrCode):'',[charge]);
 function save(){
  const key=normalizePixKey(form.key),next={key,name:form.name.trim(),city:form.city.trim()};
  if(!validPixKey(key))return setError('Chave Pix inválida. Use CPF, CNPJ, e-mail, telefone ou chave aleatória.');
  if(!next.name)return setError('Informe o nome do recebedor.');
  if(!next.city)return setError('Informe a cidade do recebedor.');
  saveReceiver(next);setReceiver(next);setForm(next);setEditing(false);setError('');
 }
 async function createCharge(){
  setCreating(true);setNote('');setError('');
  try{const c=await api('pix-mp/charges','POST',{amountCents});setCharge({id:c.id,amountCents:c.amountCents,qrCode:c.qrCode,phase:c.status==='approved'?'paid':'waiting'});}
  catch(e){setNote((e as Error).message+' Use o QR comum abaixo e confira no banco.');}
  finally{setCreating(false);}
 }
 async function copy(text:string){try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setError('Não foi possível copiar. Selecione o texto e copie manualmente.');}}
 const offline=typeof navigator!=='undefined'&&!navigator.onLine;
 const auto=charge&&charge.phase==='waiting'&&charge.amountCents===amountCents;
 const autoBlock=<>
  {charge?.phase==='paid'&&(charge.amountCents===amountCents?<p role="status"><strong>Pix recebido: {money(charge.amountCents)}.</strong> Pode finalizar a venda.</p>:<p role="alert">O Pix recebido foi de {money(charge.amountCents)}, mas o valor desta linha agora é {money(amountCents)}. Confira antes de finalizar.</p>)}
  {auto&&<><h4>QR com confirmação automática — {money(amountCents)}</h4>
   <div style={{background:'#fff',padding:8,maxWidth:280,width:'100%'}} role="img" aria-label={'QR Code Pix automático no valor de '+money(amountCents)} dangerouslySetInnerHTML={{__html:autoSvg}}/>
   <p role="status">Aguardando o pagamento… o app avisa sozinho quando o Pix chegar.</p>
   <ActionButton type="button" onClick={()=>copy(charge!.qrCode)}>{copied?'Copiado!':'Copiar Pix copia e cola (automático)'}</ActionButton></>}
  {enabled&&!offline&&charge?.phase!=='paid'&&!auto&&<ActionButton type="button" disabled={creating} onClick={createCharge}>Gerar QR com confirmação automática</ActionButton>}
  {enabled&&offline&&<p>Sem internet: use o QR comum abaixo e confira o recebimento no banco.</p>}
  {note&&<p role="alert">{note}</p>}</>;
 if(!receiver||editing)return <section aria-label="Dados do Pix">{autoBlock}<h4>Dados para receber por Pix</h4>
  <label>Chave Pix<input value={form.key} onChange={e=>setForm({...form,key:e.target.value})} autoComplete="off"/></label>
  <label>Nome do recebedor<input value={form.name} maxLength={25} onChange={e=>setForm({...form,name:e.target.value})}/></label>
  <label>Cidade<input value={form.city} maxLength={15} onChange={e=>setForm({...form,city:e.target.value})}/></label>
  {error&&<p role="alert">{error}</p>}
  <ActionButton type="button" onClick={save}>Salvar dados do Pix</ActionButton>{receiver&&<ActionButton type="button" onClick={()=>{setEditing(false);setError('');}}>Cancelar</ActionButton>}
  <p>Ficam salvos neste aparelho. Confira a chave: ela define quem recebe o dinheiro.</p></section>;
 return <section aria-label="QR Code Pix">
  {autoBlock}
  {(charge?.phase!=='paid'||charge.amountCents!==amountCents)&&<><h4>QR Code Pix comum — {money(amountCents)}</h4>
  {result?.error?<p role="alert">{result.error}</p>:result&&<>
   <div style={{background:'#fff',padding:8,maxWidth:280,width:'100%'}} role="img" aria-label={'QR Code Pix no valor de '+money(amountCents)} dangerouslySetInnerHTML={{__html:result.svg}}/>
   <p>Recebedor: {receiver.name.toUpperCase()} · Chave: {maskKey(normalizePixKey(receiver.key))}</p>
   <p>O cliente escaneia e o banco já abre com o valor preenchido. Confirme o recebimento no seu banco antes de finalizar.</p>
   <ActionButton type="button" onClick={()=>copy(result.payload)}>{copied?'Copiado!':'Copiar Pix copia e cola'}</ActionButton>
   <details><summary>Ver texto copia e cola</summary><textarea readOnly rows={4} value={result.payload} onFocus={e=>e.currentTarget.select()} style={{width:'100%'}}/></details></>}</>}
  {error&&<p role="alert">{error}</p>}
  <ActionButton type="button" onClick={()=>{setForm(receiver);setEditing(true);setError('');}}>Alterar dados do Pix</ActionButton>
 </section>;
}
