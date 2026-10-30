import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const script=resolve('scripts/prepare-pilot-metadata.mjs');
test('build registra versões separadas e impede pacote com base divergente',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pilot-version-'));
 try{
  mkdirSync(join(dir,'pilot'));writeFileSync(join(dir,'package.json'),JSON.stringify({version:'0.1.19'}));writeFileSync(join(dir,'pilot/config.yaml'),'version: "0.1.1"\n');writeFileSync(join(dir,'pilot/core-base.json'),JSON.stringify({version:'0.1.19',commit:'a'.repeat(40)}));
  let result=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(readFileSync(join(dir,'pilot-build.json'),'utf8')),{pilotVersion:'0.1.1',coreVersion:'0.1.19',coreCommit:'a'.repeat(40)});assert.ok(existsSync(join(dir,'server/pilot/build-info.ts')));
  rmSync(join(dir,'pilot-build.json'));writeFileSync(join(dir,'package.json'),JSON.stringify({version:'0.1.20'}));result=spawnSync(process.execPath,[script],{cwd:dir,encoding:'utf8'});assert.notEqual(result.status,0);assert.equal(existsSync(join(dir,'pilot-build.json')),false);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
