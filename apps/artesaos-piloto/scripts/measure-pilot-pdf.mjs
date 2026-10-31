// Synthetic measurements on this worker, not a hardware capacity claim.
import {renderQuotePdf} from '../server/pilot/quote-pdf.ts';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {PDFDocument} from 'pdf-lib';
const out=process.argv[2]??'/tmp/artesao-validation';mkdirSync(out,{recursive:true});
const before=process.memoryUsage().rss;
const base={company:{name:'Ateliê de teste',responsible:'Teste',phone:'11999990000',email:'teste@example.test'},quote:{client:{name:'Cliente fictício'},items:[],notes:'Condições comerciais. '.repeat(450),delivery:{mode:'pickup',carrier:'',notes:''}},totals:{productCents:20000,packagingCents:0,deliveryCents:0,totalCents:20000}};
const results=[];
for(const count of [1,80,200]){
 const data={...base,quote:{...base.quote,items:Array.from({length:count},()=>({name:'Peça de teste com acentos — São João',quantity:'1',priceKey:'retail',prices:{retail:100},packaging:'none',packagingIncluded:false,packagingAmount:'0'}))}};
 const start=performance.now();const bytes=await renderQuotePdf(1,1,new Date().toISOString(),data);const elapsedMs=performance.now()-start;
 results.push({items:count,notesCharacters:data.quote.notes.length,elapsedMs:Math.round(elapsedMs),pdfBytes:bytes.length,pages:(await PDFDocument.load(bytes)).getPageCount(),rssBytes:process.memoryUsage().rss});
 writeFileSync(join(out,`medicao-${count}.pdf`),bytes);
}
const metrics={node:process.version,arch:process.arch,baselineRssBytes:before,results};writeFileSync(join(out,'consumo.json'),JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics,null,2));
