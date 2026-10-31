import {appName} from './branding';
import ValidatedForm from './FormValidation';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import Quotes from './Quotes';
import Settings from './Settings';
import PilotSettings from './PilotSettings';
import Manufacturing from './Manufacturing';
import AreaNav,{areaNames,type Area} from './AreaNav';
import Clients from './Clients';
import Products from './Products';
import QuoteWireframe from './QuoteWireframe';

async function request(path: string, options?: RequestInit) {
  const response = await fetch(new URL(path, document.baseURI), options);
  if (!response.ok) throw new Error('Não foi possível concluir a operação. Verifique os logs do aplicativo.');
  return response.json();
}
function App() {
  const [health, setHealth] = useState<{status:string;database:string;arch:string;node:string}>();
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<string | null>(null);
  const [message, setMessage] = useState('Carregando diagnóstico…');
  const [busy, setBusy] = useState(true);
  useEffect(() => {
    Promise.all([request('api/health'), request('api/note')])
      .then(([h, n]) => { setHealth(h); setText(n.text); setSaved(n.updated_at); setMessage('Ambiente conectado.'); })
      .catch(e => setMessage(e.message)).finally(() => setBusy(false));
  }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const n = await request('api/note', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text}) });
      setSaved(n.updated_at); setMessage('Anotação salva. Reinicie o aplicativo e abra esta tela para conferir a persistência.');
    } catch(e) { setMessage(e instanceof Error ? e.message : 'Falha ao salvar.'); }
    finally { setBusy(false); }
  }
  return <main>
    <header><span className="brand">{appName}</span><span className="badge">Validação da instalação</span></header>
    <AreaNav/><h1>Diagnóstico da instalação</h1><section><h2>Catálogo persistente</h2><a href="?view=orcamentos">Abrir Orçamentos</a> · <a href="?view=produtos">Abrir Produtos</a> · <a href="?view=clientes">Abrir Clientes</a></section>
    <section><h2>Fluxo em avaliação</h2><p>Experimente cadastrar um produto dentro do orçamento. O wireframe usa dados temporários e não altera a anotação do banco.</p><a href="?view=produto">Abrir wireframe: produto no orçamento</a></section>
    <p>Esta tela verifica interface, servidor e banco. Orçamentos e cadastros são persistentes. Fabricação calcula custos configurados; frete e envio continuam manuais.</p>
    <section aria-labelledby="diagnostic"><h2 id="diagnostic">Diagnóstico</h2>
      <dl><div><dt>API</dt><dd>{health?.status ?? 'Não verificada'}</dd></div>
      <div><dt>SQLite</dt><dd>{health?.database ?? 'Não verificado'}</dd></div>
      <div><dt>Arquitetura</dt><dd>{health?.arch ?? '—'}</dd></div>
      <div><dt>Node.js</dt><dd>{health?.node ?? '—'}</dd></div></dl>
    </section>
    <section><h2>Teste de persistência</h2><p>Escreva algo sem dados pessoais, salve e reinicie o aplicativo pelo Home Assistant. A anotação deve continuar aqui.</p>
      <ValidatedForm onSubmit={save}><label htmlFor="note">Anotação de teste</label>
      <textarea id="note" maxLength={500} value={text} onChange={e => setText(e.target.value)} disabled={busy || !health} />
      <button disabled={busy || !health}>{busy ? 'Aguarde…' : 'Salvar anotação'}</button></ValidatedForm>
      <p>Última gravação: {saved ? new Date(saved).toLocaleString('pt-BR') : 'nenhuma'}</p>
    </section><p role="status">{message}</p>
  </main>;
}
declare const __APP_VERSION__: string;
const query=new URLSearchParams(window.location.search);
const view=query.get('view');
const area=query.get('area');
const pilotPage=view==='configuracoes'?<PilotSettings/>:view==='orcamentos'?<Quotes/>:view==='clientes'?<Clients/>:view==='produto'?<QuoteWireframe/>:view==='diagnostico'?<App/>:<Products/>;
const page = appName==='Artesão Digital'?pilotPage:(view==='configuracoes'&&area&&Object.hasOwn(areaNames,area)?<Settings area={area as Area}/>:view==='fabricacao'?<Manufacturing/>:view==='orcamentos'?<Quotes/>:view==='clientes'?<Clients/>:view==='produtos'?<Products/>:view==='produto'?<QuoteWireframe/>:view==='diagnostico'?<App/>:<Quotes/>);
createRoot(document.getElementById('root')!).render(<><small className="app-version" aria-label={`Versão ${__APP_VERSION__}`}>v{__APP_VERSION__}</small>{page}</>);
