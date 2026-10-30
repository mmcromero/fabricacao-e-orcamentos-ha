import {existsSync,copyFileSync,mkdirSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const source=['pilot/branding/logo.png','branding/logo.png'].map(p=>resolve(p)).find(existsSync);
if(source){const file=readFileSync(source);if(file.length>2*1024*1024||!file.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('A logo deve ser PNG de até 2 MB.');mkdirSync('dist',{recursive:true});copyFileSync(source,resolve('dist/pilot-logo.png'));}
