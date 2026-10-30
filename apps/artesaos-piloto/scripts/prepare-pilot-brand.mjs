import {existsSync,copyFileSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
for(const [name,target] of [['logo_principal.png','pilot-logo.png'],['logo_horizontal_negativa.png','pilot-logo-horizontal.png']]){
 const source=[`pilot/branding/${name}`,`branding/${name}`,...(target==='pilot-logo.png'?['pilot/branding/logo.png','branding/logo.png']:[])].map(p=>resolve(p)).find(existsSync);
 const destination=resolve('dist',target);
 if(!source){rmSync(destination,{force:true});continue;}
 const file=readFileSync(source);
 if(file.length>2*1024*1024||!file.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('A logo deve ser PNG de até 2 MB.');
 mkdirSync('dist',{recursive:true});copyFileSync(source,destination);
}
