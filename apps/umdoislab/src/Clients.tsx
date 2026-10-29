import {useEffect,useRef,useState,type FormEvent} from 'react';
import ClientFields from './ClientFields';
import {clientDraft,clientLabel,emptyClient,type ClientDraft} from './client-model';
import AreaNav,{SettingsLink} from './AreaNav';
import './products.css';
type Draft=ClientDraft;
type Client=Draft&{id:number;updatedAt:string};
const blank=emptyClient;
async function api(path:string,method='GET',body?:unknown){
 const response=await fetch(new URL(path,document.baseURI),{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=await response.json();if(!response.ok)throw Error(data.message||'Não foi possível salvar o cliente.');return data;
}
export default function Clients(){
 const [clients,setClients]=useState<Client[]>([]),[draft,setDraft]=useState<Draft|null>(null),[id,setId]=useState<number|null>(null),[busy,setBusy]=useState(false),[dirty,setDirty]=useState(false),[message,setMessage]=useState('Carregando clientes…'),[error,setError]=useState('');
 const [lookupBusy,setLookupBusy]=useState(false);
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLElement|null>(null);
 const load=async()=>setClients(await api('api/clients'));
 useEffect(()=>{load().then(()=>setMessage('Cadastros salvos nesta instalação.')).catch(e=>setMessage(e.message));},[]);
 useEffect(()=>{if(draft&&!dialog.current?.open)dialog.current?.showModal();},[draft]);
 function open(client?:Client){trigger.current=document.activeElement as HTMLElement;setId(client?.id??null);setDraft(client?clientDraft(client):blank());setDirty(false);setError('');}
 function close(force=false){if(!force&&(busy||(dirty&&!confirm('Descartar as alterações não salvas deste cliente?'))))return;setDraft(null);trigger.current?.focus();}
 function update(key:keyof Draft,value:string){setDraft(previous=>previous?{...previous,[key]:value}:previous);setDirty(true);}
 async function save(event:FormEvent){event.preventDefault();if(!draft)return;setBusy(true);setError('');try{if(!draft.name.trim()&&!draft.contact.trim())throw Error('Informe o nome da empresa ou o nome do contato.');await api(id===null?'api/clients':`api/clients/${id}`,id===null?'POST':'PUT',draft);await load();close(true);setMessage('Cliente salvo.');}catch(e){setError(e instanceof Error?e.message:'Falha ao salvar.');}finally{setBusy(false);}}

 return <main className="products-screen"><header><span className="brand">Fabricação e Orçamentos</span><a href="?view=diagnostico">Diagnóstico</a></header><AreaNav active="clientes"/><h1>Clientes</h1><SettingsLink area="clientes"/><p>Cadastros persistentes nesta instalação e disponíveis na área Orçamentos.</p><p role="status">{message}</p><button disabled={busy} onClick={()=>open()}>Novo cliente</button><section><h2>Clientes cadastrados ({clients.length})</h2>{!clients.length&&<p>Nenhum cliente cadastrado.</p>}{clients.map(client=><article key={client.id}><h3>{clientLabel(client)}</h3><p>Contato: {client.contact||'Não informado'}</p><details><summary>Ver dados do cliente</summary><dl>{([['Telefone',client.phone],['E-mail',client.email],['CPF ou CNPJ',client.taxDocument],['CEP de entrega',client.postal],['Rua / logradouro',client.street],['Número',client.number],['Complemento',client.complement],['Bairro',client.district],['Cidade',client.city],['Estado (UF)',client.state]] as const).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'Não informado'}</dd></div>)}</dl></details><button disabled={busy} onClick={()=>open(client)}>Editar {clientLabel(client)}</button><button type="button" disabled className="archive-unavailable" title="Será habilitado quando a consulta e a reativação dos arquivados estiverem disponíveis.">Arquivar</button></article>)}</section>
 {draft&&<dialog ref={dialog} aria-labelledby="client-title" onCancel={e=>{e.preventDefault();close();}} style={{position:'fixed',inset:0,maxHeight:'90vh',overflow:'auto',width:'min(90vw,650px)'}}><h2 id="client-title">{id===null?'Novo cliente':'Editar cliente'}</h2><form onSubmit={save}>
 <ClientFields draft={draft} prefix="client-page" update={update} busy={busy} onLookupBusy={setLookupBusy}/><p>Documento e endereço podem ficar pendentes no cadastro; envio e validação fiscal ainda não estão implementados.</p>{error&&<p role="alert">{error}</p>}<button disabled={busy||lookupBusy}>Salvar cliente</button><button type="button" disabled={busy} onClick={()=>close()}>Cancelar</button></form></dialog>}
 </main>;
}
