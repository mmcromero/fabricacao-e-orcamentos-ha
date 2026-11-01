import {useEffect} from 'react';
import OperationalPreferences from './OperationalPreferences';
import CompanyLogo from './CompanyLogo';
import SupportHub from './SupportHub';
import CompanySettings from './CompanySettings';
import AreaNav from './AreaNav';
import Settings from './Settings';
export default function PilotSettings(){
 useEffect(()=>{const area=new URLSearchParams(location.search).get('area');const groups:Record<string,string>={fabricacao:'custos',produtos:'cadastros',clientes:'cadastros',orcamentos:'frete',suporte:'cadastros'};if(area==='clientes'){const clients=document.getElementById('config-clients') as HTMLDetailsElement|null;if(clients)clients.open=true;}if(area&&groups[area])document.getElementById('config-'+groups[area])?.scrollIntoView();},[]);
 return <main className="products-screen pilot-settings"><AreaNav active="configuracoes"/><h1>Configurações</h1><p>Preferências e parâmetros por finalidade. Os cadastros operacionais permanecem próximos do trabalho diário.</p>
 <nav aria-label="Grupos de configurações" className="settings-group-links">{[['geral','Geral'],['custos','Custos e precificação'],['vendas','Vendas e pagamentos'],['frete','Orçamentos e frete'],['cadastros','Cadastros e suporte']].map(([id,label])=><a key={id} href={'#config-'+id}>{label}</a>)}</nav>
 <section id="config-geral" className="pilot-general" aria-labelledby="general-title"><h2 id="general-title">Geral</h2><OperationalPreferences/><CompanySettings/><CompanyLogo/></section>
 <section id="config-custos"><h2>Custos e precificação</h2><p>Parâmetros de cálculo e anotações de planejamento. Despesas mensais estimadas não são contas pagas no Financeiro. Alterar sugestões não substitui preços comerciais já aplicados.</p><Settings area="fabricacao" embedded/></section>
 <section id="config-vendas"><h2>Vendas e pagamentos</h2><p>Contas, formas de pagamento, taxas e prazos são mantidos no Financeiro. Seus padrões são aplicados às novas operações; pagamentos históricos preservam os valores registrados.</p><p><a href="?view=financeiro&tab=entries#finance-settings">Abrir contas e formas de pagamento</a></p><p><a href="?view=vendas">Cupons, locais e sessões de venda</a></p></section>
 <section id="config-frete"><h2>Orçamentos e frete</h2><Settings area="orcamentos" embedded/><p>Caixas, proteção, dimensões e saldos são gerenciados no Estoque. A estimativa está no orçamento e no pedido; somente confirmar preparo real no pedido consome materiais.</p><a href="?view=estoque&section=materiais">Gerenciar embalagens e materiais de envio</a></section>
 <section id="config-cadastros"><h2>Cadastros e suporte</h2><details id="config-products" open><summary>Produtos: categorias, importação e lista</summary><Settings area="produtos" embedded/></details><details id="config-clients"><summary>Clientes: lista e importação</summary><Settings area="clientes" embedded/></details><p><a href="?view=estoque&section=materiais">Materiais, insumos e categorias</a> · <a href="?view=estoque">Distribuição em pontos parceiros</a></p><div id="config-support"><SupportHub embedded/></div><h3>Suporte e diagnóstico</h3><a href="?view=diagnostico">Abrir diagnóstico da instalação</a></section>
 </main>;
}
