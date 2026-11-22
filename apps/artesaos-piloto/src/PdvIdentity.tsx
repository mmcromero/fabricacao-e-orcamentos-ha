import {useEffect, useState} from 'react';
import BrandIcon from './BrandIcon';

export default function PdvIdentity({step, onOptions, onBack, showGlobal}: {
 step: number;
 onOptions: () => void;
 onBack?: () => void;
 showGlobal: boolean;
}) {
 const [name, setName] = useState('');
 const [logo, setLogo] = useState('');
 const [officialAvailable, setOfficialAvailable] = useState(true);

 useEffect(() => {
  const controller = new AbortController();
  const read = (path: string) => fetch(new URL('api/company' + path, document.baseURI), {signal: controller.signal});
  let logoUrl = '';
  void read('').then(async response => {
   if (!response.ok) return;
   const {data} = await response.json();
   if (!controller.signal.aborted) setName(data.name?.trim() ?? '');
  }).catch(() => {});
  void read('/logo/meta').then(async response => {
   if (!response.ok) return;
   const {present, revision} = await response.json();
   if (!present) return;
   const image = await read('/logo?revision=' + revision);
   if (!image.ok) return;
   const blob = await image.blob();
   if (controller.signal.aborted) return;
   logoUrl = URL.createObjectURL(blob);
   setLogo(logoUrl);
  }).catch(() => {});
  return () => {
   controller.abort();
   if (logoUrl) URL.revokeObjectURL(logoUrl);
  };
 }, []);

 return <>
  <header className="pdv-top">
   <button type="button" className="pdv-ghost" aria-label={showGlobal?'Voltar ao PDV':onBack?'Voltar uma etapa':'Opções do PDV'} onClick={!showGlobal&&onBack?onBack:onOptions}>
    <BrandIcon name={showGlobal?'close':onBack?'back':'menu'}/>
   </button>
   <div className="pdv-identity">
    {logo ? <img src={logo} alt={name || 'Logo do negócio'} onError={() => setLogo('')}/>
     : officialAvailable ? <img src={new URL('brand/logo-horizontal.png',document.baseURI).href} alt="Artesão Digital" onError={()=>setOfficialAvailable(false)}/>
     : <span>Artesão Digital</span>}
   </div>
   <div id="pdv-attention-host"/>
  </header>
  <span className="sr-only">Etapa {step + 1} de 5</span>
 </>;
}
