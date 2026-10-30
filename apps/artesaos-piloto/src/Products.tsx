import {appName} from './branding';
import ProductForm,{ProductPhoto,emptyProduct,type EditableProduct} from './ProductForm';
import RecordActions,{archiveRecord} from './RecordActions';
import ListPagination,{pageSizes,searchProducts} from './ListPagination';
import ModalClose from './ModalClose';
import ListEditButton from './ListEditButton';
import './products.css';
import {productCategory} from './product-category';
import AreaNav,{SettingsLink} from './AreaNav';
import React, {useEffect,useState,useRef} from 'react';
type Product=EditableProduct;
async function api(path:string,method='GET',body?:unknown,expectedUpdatedAt?:string){const r=await fetch(new URL(path,document.baseURI),{method,headers:{'Content-Type':'application/json',...(expectedUpdatedAt?{'X-Expected-Updated-At':expectedUpdatedAt}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.message||'Não foi possível concluir.');return data;}
export default function Products(){
 const [batchSelection,setBatchSelection]=useState<number[]>([]);
 const [products,setProducts]=useState<Product[]>([]),[edit,setEdit]=useState<Product|null>(null),[message,setMessage]=useState('Carregando…'),[busy,setBusy]=useState(false);
 const [formDirty,setFormDirty]=useState(false);
 const [filter,setFilter]=useState('all'),[categoryFilter,setCategoryFilter]=useState(''),[categories,setCategories]=useState<{path:string}[]>([]);
 useEffect(()=>{api('api/categories').then(setCategories).catch(e=>setMessage(e.message));},[]);
 const [search,setSearch]=useState(''),[page,setPage]=useState(1),[pageSize,setPageSize]=useState('10');
 const trigger=useRef<HTMLElement|null>(null);
 function openProduct(product?:Product){trigger.current=document.activeElement as HTMLElement;const value=product?structuredClone(product):emptyProduct();setFormDirty(false);setEdit(value);}
 function closeProduct(force=false){if(!force&&(busy||(formDirty&&!confirm('Descartar as alterações não salvas deste produto?'))))return;dialog.current?.close();setEdit(null);trigger.current?.focus({preventScroll:true});}
 useEffect(()=>{api('api/settings/produtos').then(r=>setPageSize(pageSizes.includes(r.data.productsPerPage)?r.data.productsPerPage:'10')).catch(e=>setMessage(e.message));},[]);
 const filtered=searchProducts(products.filter(p=>(filter==='all'||p.origin===filter)&&(categoryFilter===''||(categoryFilter==='__pending__'?!productCategory(p):productCategory(p)===categoryFilter))),search);
 const size=pageSize==='all'?Math.max(1,filtered.length):Number(pageSize),pages=Math.max(1,Math.ceil(filtered.length/size)),currentPage=Math.min(page,pages);
 const visible=filtered.slice((currentPage-1)*size,currentPage*size);
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(edit && dialog.current && !dialog.current.open)dialog.current.showModal();},[edit]);
 const load=async()=>{const [list,cats]=await Promise.all([api('api/products'),api('api/categories')]);setProducts(list);setCategories(cats);};
 useEffect(()=>{load().then(()=>setMessage('Catálogo persistente.')).catch(e=>setMessage(e.message));},[]);
 async function run(work:()=>Promise<void>){setBusy(true);try{await work();}catch(e){setMessage(e instanceof Error?e.message:'Falha na operação.');}finally{setBusy(false);}}
 return <main className="products-screen"><header><span className="brand">{appName}</span></header><AreaNav active="produtos"/>
 <h1>Produtos</h1><SettingsLink area="produtos"/><p>Cadastro salvo no banco desta instalação e disponível na área Orçamentos.</p><p role="status">{message}</p>
 <button disabled={busy} onClick={()=>openProduct()}>Novo produto</button>
 <section><h2>Catálogo ({filtered.length})</h2><label>Buscar produtos<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Nome ou código/SKU"/></label><label>Exibir produtos<select aria-label="Exibir produtos" value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}><option value="all">Sem filtro de origem</option><option value="own">Próprios — linha comercial</option><option value="client">De cliente — personalizados</option></select></label><label>Filtrar por categoria<select value={categoryFilter} onChange={e=>{setCategoryFilter(e.target.value);setPage(1);}}><option value="">Todas as categorias</option><option value="__pending__">Categoria pendente</option>{Array.from(new Set([...categories.map(c=>c.path),...products.map(productCategory).filter(Boolean)])).sort((a,b)=>a.localeCompare(b,'pt-BR')).map(path=><option key={path} value={path}>{path}</option>)}</select></label>{!filtered.length&&<p>Nenhum produto encontrado.</p>}{visible.map(p=><article key={p.id} className="record-row product-record"><div className="record-product-info"><div className="record-product-photo">{p.imageUrl?<ProductPhoto url={p.imageUrl} name={p.name}/>:<span className="product-photo-empty">Sem foto</span>}</div><div className="record-product-details"><label className="record-select"><input type="checkbox" aria-label={`Selecionar ${p.name}`} checked={batchSelection.includes(p.id!)} onChange={e=>setBatchSelection(previous=>e.target.checked?[...previous,p.id!]:previous.filter(id=>id!==p.id))}/>Selecionar</label><h3 className="record-title">{p.name}</h3>{p.sku&&<p>SKU: {p.sku}</p>}<p>{Object.entries(p.prices).filter(([,v])=>v!==null).map(([k,v])=>`${({wholesale:'Atacado',factory:'Loja de fábrica',retail:'Varejo'} as Record<string,string>)[k]}: ${(v!/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}`).join(' · ')}</p><p className={!productCategory(p)?'category-pending':undefined}>{productCategory(p)||'Categoria pendente'}</p><p>{p.origin==='own'?'Próprio':'De cliente'} · {p.publicAllowed?'Divulgação autorizada':'Privado'}</p></div></div><ListEditButton disabled={busy} onClick={()=>openProduct(p)}/><button type="button" disabled={busy} className="archive-unavailable" onClick={()=>{void run(async()=>{await archiveRecord('products',p as {id:number;updatedAt:string;name:string});await load();});}}>Arquivar</button></article>)}<RecordActions selection={{ids:batchSelection,setIds:setBatchSelection}} kind="products" rows={filtered as {id:number;updatedAt:string;name:string}[]} visible={visible as {id:number;updatedAt:string;name:string}[]} onDone={load} disabled={busy}/><ListPagination settingsArea="produtos" page={currentPage} pages={pages} total={filtered.length} size={pageSize} label="produtos" busy={busy} onPage={setPage}/></section>
 {edit&&<dialog ref={dialog} onCancel={e=>{e.preventDefault();closeProduct();}} aria-labelledby="product-title" style={{position:'fixed',inset:0,maxHeight:'90vh',overflow:'auto',width:'min(90vw,650px)',zIndex:5}}><ModalClose onClose={()=>closeProduct()} disabled={busy}/><h2 id="product-title">{edit.id?'Editar produto':'Novo produto'}</h2><ProductForm key={edit.id??'new'} initial={edit.id?edit:undefined} context="produtos" onBusyChange={setBusy} onDirtyChange={setFormDirty} onCancel={()=>closeProduct()} onSaved={async()=>{await load();closeProduct(true);setMessage('Produto salvo.');}}/></dialog>}
 </main>;
}
