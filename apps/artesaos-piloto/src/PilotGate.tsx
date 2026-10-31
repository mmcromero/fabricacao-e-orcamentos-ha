import {useCallback,useEffect,useState,type ReactNode} from 'react';
import CompanySettings from './CompanySettings';
import MaterialSettings from './MaterialSettings';
import Settings from './Settings';
type SetupStatus={complete:boolean;ready:boolean;checks:Record<string,boolean>};
const labels:Record<string,string>={company:'Dados da empresa completos',materials:'Ao menos um material cadastrado',hourly:'Ao menos uma tarifa de trabalho humano ou máquina maior que zero',productiveHours:'Horas produtivas mensais maiores que zero',operation:'Ao menos uma despesa operacional maior que zero',settings:'Parâmetros de cálculo válidos'};
export default function PilotGate({children}:{children:ReactNode}){
 const [status,setStatus]=useState<SetupStatus|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{try{const response=await fetch(new URL('api/onboarding',document.baseURI));if(!response.ok)throw Error('Não foi possível verificar os dados iniciais. Atualize a página para tentar novamente.');setStatus(await response.json());setError('');}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível verificar os dados iniciais.');}},[]);
 useEffect(()=>{void refresh();const saved=()=>{void refresh();};addEventListener('pilot-setup-saved',saved);return()=>removeEventListener('pilot-setup-saved',saved);},[refresh]);
 async function finish(){setBusy(true);try{const response=await fetch(new URL('api/onboarding/complete',document.baseURI),{method:'POST'});const result=await response.json();if(!response.ok){setStatus(result);throw Error(result.message);}location.replace(new URL('?view=produtos',document.baseURI).href);}catch(reason){setError(reason instanceof Error?reason.message:'Não foi possível concluir.');}finally{setBusy(false);}}
 if(status?.complete)return children;
 if(!status)return <main className="products-screen"><h1>Preparando seu acesso</h1><p role={error?'alert':'status'}>{error||'Verificando os dados iniciais…'}</p></main>;
 return <main className="products-screen pilot-settings pilot-welcome"><h1>Boas-vindas ao Artesão Digital</h1><p>Vamos preparar os dados mínimos para calcular seus custos de fabricação. Salve cada seção e, ao terminar, selecione “Concluir configuração inicial”.</p><p>Você pode sair e retomar depois. Seus dados salvos serão preservados, e esta etapa continuará aparecendo até a conclusão.</p>
  <section aria-labelledby="welcome-progress"><h2 id="welcome-progress">O que falta preencher</h2><ul className="pilot-checklist">{Object.entries(labels).map(([key,label])=><li key={key}>{status.checks[key]?'✓ Concluído: ':'Pendente: '}{label}</li>)}</ul></section>
  <CompanySettings/><MaterialSettings/><section aria-label="Custos e precificação iniciais"><h2>Custos e precificação</h2><p>Informe um custo de hora humana ou de máquina e uma despesa operacional. Tarifas horárias não utilizadas podem ficar vazias e serão salvas como zero. As horas produtivas mensais são necessárias para o rateio.</p><Settings area="fabricacao" embedded initialSetup/></section>
  <section><h2>Começar a usar</h2><p>Os multiplicadores começam nos mínimos permitidos. Em cada produto, ainda será necessário informar os tempos e os materiais consumidos; use zero para o tempo que não se aplica. Materiais de custo direto recebem seu valor utilizado no próprio produto.</p><button disabled={!status.ready||busy} onClick={()=>void finish()}>Concluir configuração inicial</button><p role="alert">{error}</p></section>
 </main>;
}
