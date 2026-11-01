import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyPortableRuntime} from '../scripts/verify-portable-runtime.mjs';
test('cross-build admite JS/WASM e links internos sem depender da máquina de build',()=>{const dir=mkdtempSync(join(tmpdir(),'portable-'));try{mkdirSync(join(dir,'pkg'));writeFileSync(join(dir,'pkg','index.js'),'export const x=1');writeFileSync(join(dir,'pkg','portable.wasm'),Buffer.from([0,97,115,109]));symlinkSync('pkg/index.js',join(dir,'link'));assert.equal(verifyPortableRuntime(dir),2);}finally{rmSync(dir,{recursive:true,force:true});}});
test('cross-build recusa ELF ou addon .node de plataforma anterior',()=>{const dir=mkdtempSync(join(tmpdir(),'native-'));try{writeFileSync(join(dir,'native'),Buffer.from([127,69,76,70]));assert.throws(()=>verifyPortableRuntime(dir),/Binário nativo/);rmSync(join(dir,'native'));writeFileSync(join(dir,'addon.node'),'not portable');assert.throws(()=>verifyPortableRuntime(dir),/Binário nativo/);}finally{rmSync(dir,{recursive:true,force:true});}});
test('cross-build recusa link fora da árvore de dependências',()=>{const dir=mkdtempSync(join(tmpdir(),'external-'));try{symlinkSync('/bin/sh',join(dir,'external'));assert.throws(()=>verifyPortableRuntime(dir),/fora do runtime/);}finally{rmSync(dir,{recursive:true,force:true});}});
