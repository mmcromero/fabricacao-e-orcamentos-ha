import {useMemo,useRef,useState} from 'react';
import qrcode from 'qrcode-generator';
import ActionButton from './ActionButton';
import {normalizePixKey,pixPayload,validPixKey,type PixReceiver} from './pix-brcode';
const STORAGE='artesao.pix.receiver';
const money=(n:number)=>(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function loadReceiver():PixReceiver|null{
 try{const v=JSON.parse(localStorage.getItem(STORAGE)||'null');return v&&typeof v.key==='string'&&typeof v.name==='string'&&typeof v.city==='string'?v:null;}catch{return null;}
}
function saveReceiver(value:PixReceiver){try{localStorage.setItem(STORAGE,JSON.stringify(value));}catch{/* sem armazenamento: vale só para esta tela */}}
const maskKey=(key:string)=>key.length<=8?key:key.slice(0,4)+'…'+key.slice(-4);

/** QR Pix com o valor da venda. Regenera sozinho sempre que o valor muda. */
export default function PixQr({amountCents}:{amountCents:number}){
 const [receiver,setReceiver]=useState<PixReceiver|null>(loadReceiver),[editing,setEditing]=useState(false),[form,setForm]=useState<PixReceiver>(receiver??{key:'',name:'',city:''}),[error,setError]=useState(''),[copied,setCopied]=useState(false);
 const txid=useRef('AD'+Date.now().toString(36).toUpperCase());
 const result=useMemo(()=>{
  if(!receiver||editing)return null;
  try{
   const payload=pixPayload(receiver,amountCents,txid.current);
   const qr=qrcode(0,'M');qr.addData(payload,'Byte');qr.make();
   return {payload,svg:qr.createSvgTag({cellSize:4,margin:4,scalable:true}),error:''};
  }catch(e){return {payload:'',svg:'',error:(e as Error).message};}
 },[receiver,editing,amountCents]);
 function save(){
  const key=normalizePixKey(form.key),next={key,name:form.name.trim(),city:form.city.trim()};
  if(!validPixKey(key))return setError('Chave Pix inválida. Use CPF, CNPJ, e-mail, telefone ou chave aleatória.');
  if(!next.name)return setError('Informe o nome do recebedor.');
  if(!next.city)return setError('Informe a cidade do recebedor.');
  saveReceiver(next);setReceiver(next);setForm(next);setEditing(false);setError('');
 }
 async function copy(){if(!result?.payload)return;try{await navigator.clipboard.writeText(result.payload);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setError('Não foi possível copiar. Selecione o texto e copie manualmente.');}}
 if(!receiver||editing)return <section aria-label="Dados do Pix"><h4>Dados para receber por Pix</h4>
  <label>Chave Pix<input value={form.key} onChange={e=>setForm({...form,key:e.target.value})} autoComplete="off"/></label>
  <label>Nome do recebedor<input value={form.name} maxLength={25} onChange={e=>setForm({...form,name:e.target.value})}/></label>
  <label>Cidade<input value={form.city} maxLength={15} onChange={e=>setForm({...form,city:e.target.value})}/></label>
  {error&&<p role="alert">{error}</p>}
  <ActionButton type="button" onClick={save}>Salvar dados do Pix</ActionButton>{receiver&&<ActionButton type="button" onClick={()=>{setEditing(false);setError('');}}>Cancelar</ActionButton>}
  <p>Ficam salvos neste aparelho. Confira a chave: ela define quem recebe o dinheiro.</p></section>;
 return <section aria-label="QR Code Pix">
  <h4>QR Code Pix — {money(amountCents)}</h4>
  {result?.error?<p role="alert">{result.error}</p>:result&&<>
   <div style={{background:'#fff',padding:8,maxWidth:280,width:'100%'}} role="img" aria-label={'QR Code Pix no valor de '+money(amountCents)} dangerouslySetInnerHTML={{__html:result.svg}}/>
   <p>Recebedor: {receiver.name.toUpperCase()} · Chave: {maskKey(normalizePixKey(receiver.key))}</p>
   <p>O cliente escaneia e o banco já abre com o valor preenchido. Confirme o recebimento no seu banco antes de finalizar.</p>
   <ActionButton type="button" onClick={copy}>{copied?'Copiado!':'Copiar Pix copia e cola'}</ActionButton>
   <details><summary>Ver texto copia e cola</summary><textarea readOnly rows={4} value={result.payload} onFocus={e=>e.currentTarget.select()} style={{width:'100%'}}/></details></>}
  {error&&<p role="alert">{error}</p>}
  <ActionButton type="button" onClick={()=>{setForm(receiver);setEditing(true);setError('');}}>Alterar dados do Pix</ActionButton>
 </section>;
}
