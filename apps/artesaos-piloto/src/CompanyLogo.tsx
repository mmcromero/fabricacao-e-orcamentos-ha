import {logoDimensions} from './logo-image';
import {useEffect,useState} from 'react';
export default function CompanyLogo(){
 const [revision,setRevision]=useState(0),[loaded,setLoaded]=useState(false),[present,setPresent]=useState(false),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{let active=true;fetch(new URL('api/company/logo/meta',document.baseURI)).then(async r=>{if(!r.ok)throw Error('Falha ao carregar a logo.');return r.json();}).then(r=>{if(active){setRevision(r.revision);setPresent(r.present);setLoaded(true);}}).catch(e=>{if(active)setMessage(e.message);});return()=>{active=false;};},[]);
 async function select(file?:File){
  setPreview('');if(!file)return;setBusy(true);
  try{
   if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Escolha PNG, JPEG ou WebP de até 5 MB.');
   const [width,height]=logoDimensions(new Uint8Array(await file.arrayBuffer()));
   if(width<1||height<1||width*height>16000000||width>8192||height>8192)throw Error('Imagem grande demais em pixels. Use uma versão menor.');
   const bitmap=await createImageBitmap(file);
   try{
    if(bitmap.width*bitmap.height>16000000||bitmap.width>8192||bitmap.height>8192)throw Error('Imagem grande demais em pixels. Use uma versão menor.');
    const scale=Math.min(1,1024/bitmap.width,1024/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);
    let value=canvas.toDataURL('image/png');
    while(value.length>682000&&canvas.width>128&&canvas.height>128){const smaller=document.createElement('canvas');smaller.width=Math.round(canvas.width*.75);smaller.height=Math.round(canvas.height*.75);smaller.getContext('2d')!.drawImage(canvas,0,0,smaller.width,smaller.height);canvas.width=smaller.width;canvas.height=smaller.height;canvas.getContext('2d')!.drawImage(smaller,0,0);value=canvas.toDataURL('image/png');}
    if(value.length>682000)throw Error('Não foi possível reduzir a logo para 500 KB. Escolha uma imagem mais simples.');
    setPreview(value);setMessage('Confira a prévia e salve para substituir a logo atual.');
   }finally{bitmap.close();}
  }catch(e){setMessage(e instanceof Error?e.message:'Falha ao preparar imagem.');}finally{setBusy(false);}
 }
 async function save(remove=false){setBusy(true);try{const r=await fetch(new URL('api/company/logo',document.baseURI),{method:remove?'DELETE':'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({expectedRevision:revision,...(!remove?{png:preview.split(',')[1]}:{})})});const result=await r.json();if(!r.ok)throw Error(result.message);setRevision(result.revision);setPresent(result.present);setPreview('');setMessage(remove?'Logo removida.':'Logo salva.');}catch(e){setMessage(e instanceof Error?e.message:'Falha ao salvar logo.');}finally{setBusy(false);}}
 return <section><h3>Logo da sua empresa (opcional)</h3><p>Uma logo por conta, sem histórico de imagens no aplicativo. Novos PDFs usam a logo atual. Sem logo, usamos nome e contatos.</p>{(preview||present)&&<img alt={preview?'Prévia da nova logo':'Logo atual da empresa'} src={preview||new URL(`api/company/logo?revision=${revision}`,document.baseURI).href} style={{maxWidth:240,maxHeight:140,objectFit:'contain'}}/>}<label>Selecionar logo<input disabled={!loaded||busy} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void select(e.target.files?.[0])}/></label><p>PNG, JPEG ou WebP até 5 MB. Otimização automática mantendo proporção e transparência.</p><button type="button" disabled={!loaded||busy||!preview} onClick={()=>void save()}>Salvar logo</button>{preview&&<button type="button" disabled={busy} onClick={()=>setPreview('')}>Descartar prévia</button>}{present&&<button type="button" disabled={busy} onClick={()=>{if(confirm('Remover a logo atual?'))void save(true);}}>Remover logo</button>}<p role="status">{message}</p></section>;
}
