import type {FastifyInstance} from 'fastify';
import type {DatabaseSync} from 'node:sqlite';
import {PNG} from 'pngjs';
export function registerCompanyLogo(app:FastifyInstance,db:DatabaseSync){
 db.exec('PRAGMA secure_delete=ON; CREATE TABLE IF NOT EXISTS company_logo(id INTEGER PRIMARY KEY CHECK(id=1), image BLOB, revision INTEGER NOT NULL)');
 const current=()=>db.prepare('SELECT image,revision FROM company_logo WHERE id=1').get();
 app.get('/api/company/logo/meta',()=>{const row=current();return {present:!!row?.image,revision:Number(row?.revision??0)};});
 app.get('/api/company/logo',(_req,reply)=>{const row=current();return row?.image?reply.type('image/png').send(Buffer.from(row.image as Uint8Array)):reply.code(404).send({message:'Sem logo.'});});
 const schema={type:'object',additionalProperties:false,required:['expectedRevision'],properties:{expectedRevision:{type:'integer',minimum:0},png:{type:'string',maxLength:683000}}};
 for(const method of ['PUT','DELETE'] as const)app.route<{Body:{expectedRevision:number;png?:string}}>({method,url:'/api/company/logo',bodyLimit:700000,schema:{body:schema},handler:(req,reply)=>{
  const revision=Number(current()?.revision??0);
  if(revision!==req.body.expectedRevision)return reply.code(409).send({message:'A logo mudou em outra janela. Atualize a página antes de tentar novamente.'});
  let image:Buffer|null=null;
  if(method==='PUT'){
   try{
    const input=Buffer.from(req.body.png??'','base64');
    if(input.length>500*1024||input.length<33||!input.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error();
    if(input.readUInt32BE(8)!==13||input.toString('ascii',12,16)!=='IHDR'||input[28]!==0)throw Error();
    // Browser canvas produces non-interlaced PNG. Bound decoding before pngjs,
    // including duplicate headers that could replace the checked dimensions.
    let offset=8,headers=0,ended=false;
    while(offset+12<=input.length){const length=input.readUInt32BE(offset),kind=input.toString('ascii',offset+4,offset+8);if(length>input.length-offset-12)throw Error();if(kind==='IHDR'&&++headers!==1)throw Error();offset+=12+length;if(kind==='IEND'){ended=true;break;}}
    if(!ended||offset!==input.length||headers!==1)throw Error();
    const w=input.readUInt32BE(16),h=input.readUInt32BE(20);if(w<1||h<1||w>1024||h>1024)throw Error();
    const decoded=PNG.sync.read(input,{checkCRC:true});image=PNG.sync.write(decoded);
    if(image.length>500*1024)throw Error();
   }catch{return reply.code(400).send({message:'Use uma logo PNG válida de até 1024 × 1024 pixels e 500 KB após otimização.'});}
  }
  db.prepare('INSERT INTO company_logo(id,image,revision) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET image=excluded.image,revision=excluded.revision').run(image,revision+1);
  return {present:!!image,revision:revision+1};
 }});
}
