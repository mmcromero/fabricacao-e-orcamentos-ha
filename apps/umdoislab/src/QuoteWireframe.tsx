import { useRef, useState, type FormEvent } from 'react';
import './wireframe.css';

type ProductForm = {
  name: string; description: string; price: string; included: string;
  length: string; width: string; height: string; weight: string;
  quantity: string; private: boolean; catalog: boolean;
  origin: '' | 'own' | 'client';
};
type Item = ProductForm & { id: number };
const emptyProduct = (): ProductForm => ({
  name: '', description: '', price: '', included: '', length: '', width: '',
  height: '', weight: '', quantity: '1', private: true, catalog: false, origin: '',
});
const originLabel = (origin: ProductForm['origin']) => origin === 'own' ? 'Próprio' : origin === 'client' ? 'De cliente' : 'Origem a definir';
const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cents = (value: string): number | null => {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ''] = value.trim().replace(',', '.').split('.');
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(result) ? result : null;
};

export default function QuoteWireframe() {
  const [screen, setScreen] = useState<'editor' | 'list' | 'catalog'>('editor');
  const [client, setClient] = useState('Cliente de demonstração');
  const [postal, setPostal] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [catalog, setCatalog] = useState<Item[]>([]);
  const [draft, setDraft] = useState<ProductForm>(emptyProduct);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [dirty, setDirty] = useState(false);
  const [packaging, setPackaging] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const nextId = useRef(1);
  const trigger = useRef<HTMLElement | null>(null);
  const subtotal = items.reduce((sum, p) => sum + (cents(p.price) ?? 0) * Number(p.quantity), 0);
  const pricePending = items.some(p => cents(p.price) === null);
  const physicalPending = items.some(p => !p.length || !p.width || !p.height || !p.weight);

  function open(item?: Item) {
    trigger.current = document.activeElement as HTMLElement;
    setDraft(item ? { ...item } : emptyProduct());
    setEditing(item?.id ?? null); setError(''); setDirty(false);
    dialog.current?.showModal();
  }
  function close(force = false) {
    if (!force && dirty && !window.confirm('Descartar as alterações não salvas deste produto?')) return;
    dialog.current?.close();
    trigger.current?.focus();
  }
  function update<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setDraft(previous => ({ ...previous, [key]: value })); setDirty(true);
  }
  function example() {
    setDraft(previous => ({ ...previous, name: 'Quebra-cabeça deslizante de duas faces',
      description: 'Até quatro cores. Exemplo histórico para avaliar a tela.',
      price: '32,50', included: 'Custos, trabalho e margem. Saquinho individual não incluído.',
      length: '9,6', width: '9,6', height: '0,7', weight: '39', quantity: '45' }));
    setDirty(true); setError('');
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim()) { setError('Informe o nome do produto.'); return; }
    if (draft.price.trim() && cents(draft.price) === null) {
      setError('Informe um preço válido, com até duas casas decimais, ou deixe pendente.'); return;
    }
    const quantity = Number(draft.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1) { setError('Informe uma quantidade inteira maior que zero.'); return; }
    for (const key of ['length', 'width', 'height', 'weight'] as const) {
      if (draft[key].trim() && (!/^\d+(?:[.,]\d+)?$/.test(draft[key].trim()) || Number(draft[key].replace(',', '.')) <= 0)) {
        setError('Dimensões e peso devem ser maiores que zero. Você também pode deixá-los pendentes.'); return;
      }
    }
    if (draft.price.trim() && !Number.isSafeInteger(cents(draft.price)! * quantity)) {
      setError('O valor calculado excede o limite deste protótipo.'); return;
    }
    const item = { ...draft, name: draft.name.trim(), id: editing ?? nextId.current++ };
    setItems(previous => editing === null ? [...previous, item] : previous.map(p => p.id === editing ? item : p));
    if (draft.catalog) setCatalog(previous => [...previous.filter(p => p.id !== item.id), { ...item }]);
    else if (editing !== null) setCatalog(previous => previous.filter(p => p.id !== editing));
    setStatus(`${item.name} ${editing === null ? 'adicionado' : 'atualizado'}. ${draft.catalog ? 'Incluído também no catálogo simulado.' : 'Usado somente neste orçamento.'} ${draft.private ? 'Privado: bloqueado para divulgação no site.' : 'Elegível para divulgação futura; nada foi publicado.'}`);
    close(true);
  }
  function remove(item: Item) {
    if (!window.confirm('Remover este item do orçamento?')) return;
    setItems(previous => previous.filter(p => p.id !== item.id));
    setStatus('Item removido do orçamento. O catálogo simulado foi preservado.');
  }

  return <div className="wf-shell">
    <div className="wf-banner"><strong>Wireframe navegável</strong><span>Dados de demonstração nesta página. Recarregar descarta as alterações. O banco não é usado.</span></div>
    <header className="wf-header"><div><strong>Fabricação e Orçamentos</strong><small>Seu trabalho comercial, em um só lugar.</small></div><a href="?">Voltar ao diagnóstico</a></header>
    <nav className="wf-nav" aria-label="Áreas"><button onClick={() => setScreen('list')} aria-current={screen !== 'catalog' ? 'page' : undefined}>Orçamentos</button><button onClick={() => setScreen('catalog')} aria-current={screen === 'catalog' ? 'page' : undefined}>Catálogo simulado</button><span>Fabricação: a detalhar</span></nav>
    <main className="wf-main">
      {screen === 'list' && <><div className="wf-title"><div><small>ORÇAMENTOS</small><h1>Rascunhos da demonstração</h1></div><button onClick={() => setScreen('editor')}>Abrir orçamento</button></div><section className="wf-card"><h2>Orçamento em preparação</h2><p>{client || 'Cliente a definir'} · {items.length} {items.length === 1 ? 'item' : 'itens'}</p><p>Não salvo no banco, não enviado. Todos os dados são desta demonstração.</p><button onClick={() => setScreen('editor')}>Continuar preenchendo</button></section></>}
      {screen === 'catalog' && <><div className="wf-title"><div><small>CATÁLOGO SIMULADO</small><h1>Produtos desta sessão</h1></div><button onClick={() => setScreen('editor')}>Voltar ao orçamento</button></div><p>Salvar no catálogo não autoriza publicar no site. A integração com o site ainda não existe.</p>{catalog.length === 0 ? <section className="wf-card"><h2>Nenhum produto salvo no catálogo</h2><p>Cadastre pelo orçamento e marque a opção de salvar também no catálogo.</p></section> : catalog.map(p => <section className="wf-card" key={p.id}><h2>{p.name}</h2><span className="wf-tag">{p.private ? 'Privado · não exportar para site' : 'Divulgação autorizada · não publicado'}</span><p>{originLabel(p.origin)} · {cents(p.price) === null ? 'Preço pendente' : `${money(cents(p.price)!)} por unidade`}</p><button onClick={() => { setItems(previous => [...previous, { ...p, id: nextId.current++, quantity: '1', catalog: false }]); setScreen('editor'); setStatus('Produto do catálogo simulado adicionado ao orçamento.'); }}>Usar no orçamento</button></section>)}</>}
      {screen === 'editor' && <>
        <div className="wf-title"><div><small>ORÇAMENTOS / NOVO RASCUNHO</small><h1>Vamos montar o pedido.</h1><p>Comece com o cliente e adicione um produto, mesmo que ele ainda não esteja no catálogo.</p></div><span className="wf-tag">Demonstração · não enviado</span></div>
        <div className="wf-grid"><div>
          <section className="wf-card"><h2><span className="wf-step">1</span>Cliente e observações</h2><label htmlFor="wf-client">Nome do cliente</label><input id="wf-client" value={client} onChange={e => setClient(e.target.value)} /><label htmlFor="wf-postal">CEP de entrega</label><input id="wf-postal" inputMode="numeric" placeholder="Pode ficar pendente" value={postal} onChange={e => setPostal(e.target.value)} /><label htmlFor="wf-notes">Observações do pedido</label><textarea id="wf-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Estes campos serão preservados ao cadastrar o produto." /></section>
          <section className="wf-card"><div className="wf-row"><h2><span className="wf-step">2</span>Produtos do orçamento</h2><button onClick={() => open()}>+ Novo produto</button></div><p>Informe o preço de venda que você já calculou. Fabricação e precificação serão detalhadas depois.</p>
            {catalog.length > 0 && <><label htmlFor="wf-catalog-select">Selecionar do catálogo simulado</label><select id="wf-catalog-select" value="" onChange={e => { const p = catalog.find(p => p.id === Number(e.target.value)); if (p) { setItems(previous => [...previous, { ...p, id: nextId.current++, quantity: '1', catalog: false }]); setStatus('Produto adicionado do catálogo simulado.'); } }}><option value="">Selecione um produto</option>{catalog.map(p => <option key={p.id} value={p.id}>{p.name}{p.private ? ' · privado' : ''}</option>)}</select></>}
            {items.length === 0 ? <div className="wf-empty"><h3>Uma peça nova também pode entrar aqui.</h3><p>Use “Novo produto” para informar nome, preço e dados físicos sem sair do orçamento.</p></div> : items.map(p => <article className="wf-item" key={p.id}><div className="wf-row"><h3>{p.name}</h3><span className="wf-tag">{p.private ? 'Privado' : 'Divulgação autorizada'}</span></div><p>{p.description || 'Sem descrição'}<br />{p.quantity} unidades × {cents(p.price) === null ? 'preço pendente' : money(cents(p.price)!)}<br />{p.length && p.width && p.height ? `${p.length} × ${p.width} × ${p.height} cm` : 'Dimensões pendentes'} · {p.weight ? `${p.weight} g/unidade` : 'Peso pendente'}</p><p className="wf-muted">{originLabel(p.origin)} · {p.catalog ? 'Também salvo no catálogo simulado' : 'Somente neste orçamento'} · {p.private ? 'Bloqueado para futura carga no site' : 'Elegível para divulgação futura; ainda não publicado'}</p><div className="wf-actions"><button className="wf-secondary" onClick={() => open(p)} aria-label={`Editar ${p.name}`}>Editar produto e quantidade</button><button className="wf-quiet" onClick={() => remove(p)} aria-label={`Remover ${p.name}`}>Remover do orçamento</button></div></article>)}
          </section>
          <section className="wf-card"><h2><span className="wf-step">3</span>Embalagem e envio</h2><label htmlFor="wf-packaging">Embalagem individual neste pedido</label><select id="wf-packaging" value={packaging} onChange={e => setPackaging(e.target.value)}><option value="">A definir</option><option value="none">Sem embalagem individual</option><option value="with">Com embalagem individual</option></select><p>{packaging === 'with' ? 'Tipo, compatibilidade e cobrança da embalagem serão detalhados no próximo fluxo.' : 'A embalagem individual é diferente da caixa de transporte.'}</p><div className="wf-pending">Frete não consultado. O pacote de transporte ainda não foi estimado.</div></section>
        </div><aside><section className="wf-card wf-summary"><small>RESUMO DO RASCUNHO</small><h2>Valores dos produtos</h2><strong className="wf-total">{money(subtotal)}</strong><p>{pricePending ? 'Soma parcial: há produto com preço pendente.' : 'Subtotal dos produtos com preço informado.'}</p><hr /><p>Embalagem: {packaging === 'none' ? 'sem embalagem individual' : 'a definir / não precificada'}</p><p>Frete: pendente</p><p>Prazo de fabricação: a definir</p>{!postal && <p className="wf-pending">CEP de entrega pendente.</p>}{physicalPending && <p className="wf-pending">Há dados físicos incompletos para preparar o envio.</p>}<p className="wf-muted">Este subtotal não é o total final do orçamento. Nenhuma cotação, prazo ou publicação foi realizada.</p></section></aside></div>
      </>}
      <p className="wf-status" role="status">{status}</p>
    </main>
    <dialog ref={dialog} className="wf-dialog" aria-labelledby="wf-dialog-title" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <form noValidate onSubmit={save}>
        <div className="wf-modal-header"><div><small>CADASTRO DIRETO NO ORÇAMENTO</small><h2 id="wf-dialog-title">{editing === null ? 'Novo produto' : 'Editar produto'}</h2></div><button type="button" className="wf-quiet" aria-label="Fechar cadastro de produto" onClick={() => close()}>Fechar</button></div>
        <div className="wf-modal-body"><p>Use o preço de venda final. Os dados do orçamento continuam guardados enquanto você preenche.</p><button type="button" className="wf-secondary" onClick={example}>Preencher exemplo histórico</button><p className="wf-muted">O exemplo é uma referência antiga; não consulta frete nem define preços atuais.</p>
          {error && <div className="wf-error" role="alert">{error}</div>}
          <label htmlFor="wf-product-name">Nome do produto <span aria-hidden="true">*</span></label><input autoFocus id="wf-product-name" value={draft.name} onChange={e => update('name', e.target.value)} aria-required="true" />
          <label htmlFor="wf-description">Descrição (opcional)</label><textarea id="wf-description" value={draft.description} onChange={e => update('description', e.target.value)} />
          <div className="wf-form-grid"><div><label htmlFor="wf-price">Preço de venda por unidade (R$)</label><input id="wf-price" inputMode="decimal" value={draft.price} onChange={e => update('price', e.target.value)} placeholder="Pode ficar pendente no rascunho" /></div><div><label htmlFor="wf-quantity">Quantidade neste orçamento</label><input id="wf-quantity" inputMode="numeric" value={draft.quantity} onChange={e => update('quantity', e.target.value)} /></div></div>
          <label htmlFor="wf-included">O que já está incluído nesse preço?</label><textarea id="wf-included" value={draft.included} onChange={e => update('included', e.target.value)} placeholder="Ex.: custos, trabalho e margem; embalagem, se já incluída." />
          <fieldset><legend>Dados físicos da peça, por unidade</legend><p className="wf-muted">Estas são as medidas da peça, sem a embalagem individual ou a caixa de transporte. Dados ausentes deixam o envio pendente.</p><div className="wf-form-grid">{([
            ['length', 'Comprimento (cm)'], ['width', 'Largura (cm)'], ['height', 'Altura / espessura (cm)'], ['weight', 'Peso (g)']
          ] as const).map(([key, label]) => <div key={key}><label htmlFor={`wf-${key}`}>{label}</label><input id={`wf-${key}`} inputMode="decimal" value={draft[key]} onChange={e => update(key, e.target.value)} placeholder="A informar" /></div>)}</div></fieldset>
          <label htmlFor="wf-origin">Origem do produto</label><select id="wf-origin" value={draft.origin} onChange={e => update('origin', e.target.value as ProductForm['origin'])}><option value="">A definir</option><option value="own">Próprio</option><option value="client">De cliente</option></select><p className="wf-muted">A origem organiza os produtos. Um produto próprio também pode permanecer privado.</p>
          <fieldset><legend>Privacidade e divulgação</legend><label className="wf-choice"><input type="radio" name="wf-visibility" checked={draft.private} onChange={() => update('private', true)} />Privado — não incluir em futura carga no site</label><label className="wf-choice"><input type="radio" name="wf-visibility" checked={!draft.private} onChange={() => update('private', false)} />Autorizo a elegibilidade para divulgação futura</label><p className="wf-muted">Todo produto novo começa privado. Autorizar não publica o produto. A integração com o site ainda não existe.</p></fieldset>
          <fieldset><legend>Onde usar este produto?</legend><label className="wf-choice"><input type="checkbox" checked={draft.catalog} onChange={e => update('catalog', e.target.checked)} />Salvar também no catálogo (simulação)</label><p className="wf-muted">Desmarcado: usar só neste orçamento. Produtos privados também podem ficar no catálogo e continuam bloqueados para divulgação.</p></fieldset>
        </div><div className="wf-modal-footer"><button type="button" className="wf-secondary" onClick={() => close()}>Cancelar</button><button type="submit">{editing === null ? 'Adicionar ao orçamento' : 'Salvar alterações no item'}</button></div>
      </form>
    </dialog>
  </div>;
}
