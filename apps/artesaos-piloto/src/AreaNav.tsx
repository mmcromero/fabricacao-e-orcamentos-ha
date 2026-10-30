export type Area='fabricacao'|'orcamentos'|'clientes'|'produtos';
export const areaNames:Record<Area,string>={fabricacao:'Fabricação',orcamentos:'Orçamentos',clientes:'Clientes',produtos:'Produtos'};
export default function AreaNav({active}:{active?:Area}){
 return <nav aria-label="Áreas">{(Object.keys(areaNames) as Area[]).map(area=><a key={area} href={`?view=${area}`} aria-current={active===area?'page':undefined} style={{fontWeight:active===area?750:400,marginRight:16}}>{areaNames[area]}</a>)}</nav>;
}
export function SettingsLink({area}:{area:Area}){return <a className="area-settings-link" href={`?view=configuracoes&area=${area}`}>Configurações</a>;}
