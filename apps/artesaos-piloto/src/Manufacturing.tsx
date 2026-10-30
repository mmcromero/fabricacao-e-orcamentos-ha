import {appName} from './branding';
import {useState} from 'react';
import AreaNav,{SettingsLink} from './AreaNav';
import ProductForm from './ProductForm';
import './products.css';
export default function Manufacturing(){
 const [cycle,setCycle]=useState(0),[message,setMessage]=useState(''),[dirty,setDirty]=useState(false);
 return <main className="products-screen"><header><span className="brand">{appName}</span></header><AreaNav active="fabricacao"/><h1>Fabricação</h1><SettingsLink area="fabricacao"/><p>Cadastre um produto completo, começando pelos dados de fabricação. Para editar produtos existentes, use a lista de Produtos.</p><p role="status">{message}</p><ProductForm key={cycle} context="fabricacao" onDirtyChange={setDirty} onSaved={product=>{setMessage(`${product.name} salvo no cadastro único. Preços aplicados somente conforme sua escolha.`);setDirty(false);setCycle(n=>n+1);}}/><button type="button" onClick={()=>{if(dirty&&!confirm('Descartar as alterações não salvas?'))return;setDirty(false);setCycle(n=>n+1);}}>Limpar e iniciar novo produto</button></main>;
}
