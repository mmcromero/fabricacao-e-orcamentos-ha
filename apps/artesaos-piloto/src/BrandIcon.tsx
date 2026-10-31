export type BrandIconName='produtos'|'clientes'|'orcamentos'|'configuracoes'|'menu'|'close'|'plus';
const paths:Record<BrandIconName,string>={
 produtos:'M12 3 3 7.5v9L12 21l9-4.5v-9L12 3ZM3 7.5l9 4.5 9-4.5M12 12v9M7.5 5.25l9 4.5',
 clientes:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
 orcamentos:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6ZM14 2v6h6M8 13h8M8 17h6',
 configuracoes:'m9 3-1 3-3 1-2 3 2 2-1 3 2 3 3-1 3 2 3-2 3 1 2-3-1-3 2-2-2-3-3-1-1-3H9ZM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
 menu:'M3 6h18M3 12h18M3 18h18',close:'m6 6 12 12M18 6 6 18',plus:'M12 5v14M5 12h14'
};
export default function BrandIcon({name}:{name:BrandIconName}){return <svg className="pilot-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]}/></svg>;}
