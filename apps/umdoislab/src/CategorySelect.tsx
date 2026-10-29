import {useEffect,useState} from 'react';
export type Category={id:number;path:string;reserved:number;revision:number};
export default function CategorySelect({value,onChange,disabled=false}:{value:string;onChange:(value:string)=>void;disabled?:boolean}){
 const [categories,setCategories]=useState<Category[]>([]),[error,setError]=useState('');
 useEffect(()=>{let active=true;fetch(new URL('api/categories',document.baseURI)).then(async r=>{if(!r.ok)throw Error('Não foi possível carregar as categorias.');return r.json();}).then(data=>{if(active)setCategories(data);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 return <><label>Categoria<select aria-label="Categoria" value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}><option value="">Sem categoria — Categoria pendente</option>{value&&!categories.some(c=>c.path===value)&&<option value={value}>{value} (categoria atual)</option>}{categories.filter(c=>!c.reserved).map(c=><option key={c.id} value={c.path}>{c.path}</option>)}</select></label>{error&&<p role="alert">{error} A categoria atual será preservada.</p>}</>;
}
