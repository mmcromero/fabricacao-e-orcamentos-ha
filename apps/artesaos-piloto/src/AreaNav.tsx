import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {appName} from './branding';
export type Area='fabricacao'|'orcamentos'|'clientes'|'produtos';
export const areaNames:Record<Area,string>={fabricacao:'Fabricação',orcamentos:'Orçamentos',clientes:'Clientes',produtos:'Produtos'};
export default function AreaNav({active}:{active?:Area}){
 const [host,setHost]=useState<HTMLElement|null>(null);
 useEffect(()=>{
  if(appName!=='Artesão Digital')return;
  const find=()=>{const target=document.getElementById('pilot-navigation');if(target){setHost(target);return true;}return false;};
  if(find())return;
  const observer=new MutationObserver(()=>{if(find())observer.disconnect();});observer.observe(document.body,{childList:true,subtree:true});
  return ()=>observer.disconnect();
 },[]);
 useEffect(()=>{host?.querySelector('[aria-current=page]')?.scrollIntoView({block:'nearest',inline:'nearest'});},[host,active]);
 const navigation=<nav aria-label="Áreas">{(Object.keys(areaNames) as Area[]).map(area=><a key={area} href={`?view=${area}`} aria-current={active===area?'page':undefined} style={{fontWeight:active===area?750:400,marginRight:16}}>{areaNames[area]}</a>)}</nav>;
 return host?createPortal(navigation,host):navigation;
}
export function SettingsLink({area}:{area:Area}){return <a className="area-settings-link" href={`?view=configuracoes&area=${area}`}>Configurações</a>;}
