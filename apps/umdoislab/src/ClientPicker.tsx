import { useEffect, useRef, useState, type FormEvent } from 'react';

export type Client = {
  id: number; name: string; contact: string; phone: string; email: string;
  taxDocument: string; postal: string;
};
type ClientDraft = Omit<Client, 'id'>;
const emptyClient = (): ClientDraft => ({ name: '', contact: '', phone: '', email: '', taxDocument: '', postal: '' });
const examples: Client[] = [
  { ...emptyClient(), id: 1, name: 'Cliente de demonstração' },
  { ...emptyClient(), id: 2, name: 'Empresa de demonstração', contact: 'Contato de exemplo' },
];

export default function ClientPicker({ selected, onSelect, persistent=false }: { selected: Client | null; onSelect: (client: Client | null) => void; persistent?:boolean }) {
  const [clients, setClients] = useState<Client[]>(persistent?[]:examples);
  const [draft, setDraft] = useState<ClientDraft>(emptyClient);
  const [editing, setEditing] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const nextId = useRef(3);
  const [busy,setBusy]=useState(false);
  async function clientRequest(path:string,method='GET',body?:unknown){const r=await fetch(new URL(path,document.baseURI),{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.message||'Não foi possível salvar o cliente.');return data;}
  useEffect(()=>{if(persistent)clientRequest('api/clients').then(setClients).catch(e=>setMessage(e.message));},[persistent]);

  function open(client?: Client) {
    trigger.current = document.activeElement as HTMLElement;
    setDraft(client ? { ...client } : emptyClient());
    setEditing(client?.id ?? null); setDirty(false); setError('');
    dialog.current?.showModal();
  }
  function close(force = false) {
    if(!force&&busy)return;
    if (!force && dirty && !window.confirm('Descartar as alterações não salvas deste cliente?')) return;
    dialog.current?.close(); trigger.current?.focus();
  }
  function update(key: keyof ClientDraft, value: string) {
    setDraft(previous => ({ ...previous, [key]: value })); setDirty(true);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) { setError('Informe o nome do cliente ou empresa.'); return; }
    const email = event.currentTarget.elements.namedItem('client-email') as HTMLInputElement;
    if (email.validity.typeMismatch) { setError('Confira o formato do e-mail informado.'); return; }
    if(persistent){
      setBusy(true);
      try{
        const body={name:draft.name.trim(),contact:draft.contact,phone:draft.phone,email:draft.email,taxDocument:draft.taxDocument,postal:draft.postal};
        const result=await clientRequest(editing===null?'api/clients':`api/clients/${editing}`,editing===null?'POST':'PUT',body);
        const list:Client[]=await clientRequest('api/clients');setClients(list);
        onSelect(list.find(c=>c.id===(editing??result.id))??null);
        setMessage('Cliente salvo no cadastro e selecionado neste orçamento.');close(true);
      }catch(e){setError(e instanceof Error?e.message:'Falha ao salvar.');}finally{setBusy(false);}
      return;
    }
    const client: Client = { ...draft, name: draft.name.trim(), id: editing ?? nextId.current++ };
    setClients(previous => editing === null ? [...previous, client] : previous.map(c => c.id === editing ? client : c));
    onSelect(client);
    setMessage(editing === null ? 'Cliente adicionado à lista simulada e selecionado neste orçamento.' : 'Cadastro simulado atualizado. Os itens do orçamento foram preservados.');
    close(true);
  }
  return <div className="wf-client-picker">
    <div className="wf-client-select"><div><label htmlFor="wf-client-select">Selecionar cliente</label><select id="wf-client-select" value={selected?.id ?? ''} onChange={e => { onSelect(clients.find(c => c.id === Number(e.target.value)) ?? null); setMessage(''); }}><option value="">Escolha um cliente da lista</option>{clients.map(client => <option value={client.id} key={client.id}>{client.name}</option>)}</select></div><button type="button" onClick={() => open()}>+ Novo cliente</button></div>
    {selected ? <div className="wf-selected-client"><strong>{selected.name}</strong><p>Contato: {selected.contact || 'a informar'} · CEP: {selected.postal || 'pendente'}</p><details><summary>Ver dados do cliente</summary><dl className="wf-client-details">{([
      ['Nome do cliente ou empresa', selected.name], ['Nome do contato', selected.contact],
      ['Telefone', selected.phone], ['E-mail', selected.email], ['CPF ou CNPJ', selected.taxDocument], ['CEP de entrega', selected.postal],
    ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Não informado'}</dd></div>)}</dl><p className="wf-muted">Dados para consulta. CPF/CNPJ ainda não validado neste protótipo.</p></details><button type="button" className="wf-quiet" onClick={() => open(selected)}>Editar cadastro do cliente</button></div>
      : <p className="wf-pending">Cliente a selecionar. O orçamento pode continuar como rascunho.</p>}
    <p className="wf-muted">{persistent?'O cadastro de clientes é persistente. Salve o orçamento para guardar a seleção.':'A lista e os cadastros são simulados nesta página; recarregar descarta as alterações.'}</p>
    <p role="status">{message}</p>
    <dialog ref={dialog} className="wf-dialog" aria-labelledby="wf-client-modal-title" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <form noValidate onSubmit={save}><div className="wf-modal-header"><div><small>CADASTRO SEM SAIR DO ORÇAMENTO</small><h2 id="wf-client-modal-title">{editing === null ? 'Novo cliente' : 'Editar cliente'}</h2></div><button type="button" className="wf-quiet" onClick={() => close()} aria-label="Fechar cadastro de cliente">Fechar</button></div>
        <div className="wf-modal-body"><p>Os produtos, embalagens e observações do pedido continuam preservados.</p>{error && <div className="wf-error" role="alert">{error}</div>}
          <label htmlFor="wf-client-name">Nome do cliente ou empresa *</label><input autoFocus id="wf-client-name" value={draft.name} onChange={e => update('name', e.target.value)} aria-required="true" />
          <div className="wf-form-grid"><div><label htmlFor="wf-client-contact">Nome do contato</label><input id="wf-client-contact" value={draft.contact} onChange={e => update('contact', e.target.value)} /></div><div><label htmlFor="wf-client-phone">Telefone</label><input id="wf-client-phone" type="tel" value={draft.phone} onChange={e => update('phone', e.target.value)} /></div><div><label htmlFor="wf-client-email">E-mail</label><input id="wf-client-email" name="client-email" type="email" value={draft.email} onChange={e => update('email', e.target.value)} /></div><div><label htmlFor="wf-client-document">CPF ou CNPJ</label><input id="wf-client-document" value={draft.taxDocument} onChange={e => update('taxDocument', e.target.value)} placeholder="Pode ficar pendente até preparar o envio" /></div></div>
          <label htmlFor="wf-client-postal">CEP de entrega</label><input id="wf-client-postal" inputMode="numeric" value={draft.postal} onChange={e => update('postal', e.target.value)} placeholder="Pode ficar pendente no rascunho" />
          <p className="wf-muted">CPF/CNPJ será necessário para preparar o envio, sem bloquear o rascunho ou a cotação. Validação fiscal e consulta de frete ainda não implementadas.</p>
        </div><div className="wf-modal-footer"><button type="button" className="wf-secondary" onClick={() => close()}>Cancelar</button><button type="submit" disabled={busy}>{editing === null ? 'Salvar e selecionar cliente' : 'Salvar cadastro do cliente'}</button></div>
      </form>
    </dialog>
  </div>;
}
