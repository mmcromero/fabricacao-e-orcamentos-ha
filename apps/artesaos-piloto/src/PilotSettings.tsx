import SupportHub from './SupportHub';
import CompanySettings from './CompanySettings';
import {useRef,useState,type KeyboardEvent} from 'react';
import AreaNav,{areaNames} from './AreaNav';
import Settings from './Settings';
const tabs=['produtos','clientes','orcamentos','suporte'] as const;
export default function PilotSettings(){
 const initial=new URLSearchParams(location.search).get('area');
 const [tab,setTab]=useState<typeof tabs[number]>(tabs.includes(initial as typeof tabs[number])?initial as typeof tabs[number]:'produtos');
 const tabNames={...areaNames,suporte:'Meus chamados'};
 const buttons=useRef<(HTMLButtonElement|null)[]>([]);
 function key(event:KeyboardEvent,index:number){
  const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:null;
  if(next===null)return;event.preventDefault();setTab(tabs[next]);buttons.current[next]?.focus();
 }
 return <main className="products-screen pilot-settings"><AreaNav active="configuracoes"/><h1>Configurações</h1><p>Preferências comuns e ajustes de cada área, em um só lugar.</p>
  <section className="pilot-general" aria-labelledby="general-title"><h2 id="general-title">Configurações gerais</h2><p>Parâmetros compartilhados pelos cálculos de produtos e orçamentos. Alterar estes valores não substitui os preços comerciais já salvos.</p><CompanySettings/><Settings area="fabricacao" embedded/></section>
  <section className="pilot-settings-areas" aria-label="Configurações por área"><div role="tablist" aria-label="Áreas de configuração">{tabs.map((area,index)=><button key={area} ref={element=>{buttons.current[index]=element;}} id={`tab-${area}`} role="tab" type="button" aria-selected={tab===area} aria-controls={`panel-${area}`} tabIndex={tab===area?0:-1} onKeyDown={event=>key(event,index)} onClick={()=>setTab(area)}>{tabNames[area]}</button>)}</div>
   {tabs.map(area=><div key={area} id={`panel-${area}`} role="tabpanel" aria-labelledby={`tab-${area}`} hidden={tab!==area}><h2>{area==='suporte'?'Meus chamados':`Configurações de ${areaNames[area].toLocaleLowerCase('pt-BR')}`}</h2>{area==='suporte'?<SupportHub embedded/>:<Settings area={area} embedded/>}</div>)}
  </section><section><h2>Suporte e diagnóstico</h2><a href="?view=diagnostico">Abrir diagnóstico da instalação</a></section>
 </main>;
}
