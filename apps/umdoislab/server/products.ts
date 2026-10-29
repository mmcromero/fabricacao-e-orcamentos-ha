import type { FastifyInstance } from 'fastify';
import type { DatabaseSync } from 'node:sqlite';

const money = {type:['integer','null'], minimum:0, maximum:10000000000};
const measure = {type:['number','null'], exclusiveMinimum:0, maximum:1000000};
const schema = {type:'object', additionalProperties:false, required:['name','origin','publicAllowed','prices','weightGrams','lengthCm','widthCm','heightCm','colors','sourceKeys','family','description'], properties:{
  name:{type:'string',minLength:1,maxLength:200,pattern:'\\S'}, origin:{enum:['own','client']}, publicAllowed:{type:'boolean'},
  prices:{type:'object',additionalProperties:false,required:['wholesale','factory','retail'],properties:{wholesale:money,factory:money,retail:money}},
  weightGrams:measure,lengthCm:measure,widthCm:measure,heightCm:measure,
  colors:{type:'array',maxItems:100,uniqueItems:true,items:{type:'string',maxLength:100}},
  sourceKeys:{type:'array',maxItems:200,uniqueItems:true,items:{type:'string',minLength:1,maxLength:250}},
  sourceFamily:{type:'string',maxLength:250},family:{type:'string',maxLength:200},description:{type:'string',maxLength:20000}
}};
export type Product = {sourceFamily?:string;name:string;origin:'own'|'client';publicAllowed:boolean;prices:{wholesale:number|null;factory:number|null;retail:number|null};weightGrams:number|null;lengthCm:number|null;widthCm:number|null;heightCm:number|null;colors:string[];sourceKeys:string[];family:string;description:string};
function valid(p:Product) {return Object.values(p.prices).some(v=>v!==null) && !(p.origin==='client' && p.publicAllowed);}
export function registerProducts(app:FastifyInstance, db:DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, data TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS product_sources (source_key TEXT PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id));`);
  const list=()=>db.prepare('SELECT id,data,updated_at FROM products WHERE archived=0 ORDER BY id DESC').all().map(r=>({id:r.id,...JSON.parse(r.data as string),updatedAt:r.updated_at}));
  const add=(p:Product)=>{
    const id=Number(db.prepare('INSERT INTO products(data,updated_at) VALUES (?,?)').run(JSON.stringify(p),new Date().toISOString()).lastInsertRowid);
    for(const key of p.sourceKeys) db.prepare('INSERT INTO product_sources VALUES (?,?)').run(key,id);
    return id;
  };
  app.get('/api/products',list);
  app.post<{Body:Product}>('/api/products',{bodyLimit:65536,schema:{body:schema}},(req,reply)=>{
    if(!valid(req.body)) return reply.code(400).send({message:'Informe pelo menos um preço. Produto de cliente deve permanecer privado.'});
    if(req.body.sourceKeys.length) return reply.code(400).send({message:'Vínculos externos são reservados à importação.'});
    return {id:add(req.body)};
  });
  app.put<{Params:{id:string};Body:Product}>('/api/products/:id',{bodyLimit:65536,schema:{body:schema}},(req,reply)=>{
    const row=db.prepare('SELECT data FROM products WHERE id=? AND archived=0').get(req.params.id);
    if(!row) return reply.code(404).send({message:'Produto não encontrado.'});
    const old=JSON.parse(row.data as string) as Product;
    if(!valid(req.body)||JSON.stringify(old.sourceKeys)!==JSON.stringify(req.body.sourceKeys)) return reply.code(400).send({message:'Confira os preços, a privacidade e os vínculos externos.'});
    db.prepare('UPDATE products SET data=?,updated_at=? WHERE id=?').run(JSON.stringify(req.body),new Date().toISOString(),req.params.id);
    return {ok:true};
  });
  app.delete<{Params:{id:string}}>('/api/products/:id',(req,reply)=>{
    const result=db.prepare('UPDATE products SET archived=1 WHERE id=? AND archived=0').run(req.params.id);
    return result.changes?{ok:true}:reply.code(404).send({message:'Produto não encontrado.'});
  });
  app.post<{Body:{products:Product[];confirm:boolean}}>('/api/products/import',{bodyLimit:1024*1024,schema:{body:{type:'object',additionalProperties:false,required:['products','confirm'],properties:{confirm:{type:'boolean'},products:{type:'array',minItems:1,maxItems:500,items:schema}}}}},(req,reply)=>{
    const seen=new Set<string>();
    const pending:Product[]=[];let skipped=0;
    for(const p of req.body.products){
      if(!valid(p)||!p.sourceKeys.length) return reply.code(400).send({message:'Carga inválida: confira preços, origem e identificadores.'});
      const matches=new Set<number>();
      for(const key of p.sourceKeys){
        if(seen.has(key)) return reply.code(400).send({message:'Identificador repetido dentro do arquivo.'});
        seen.add(key);
        const row=db.prepare('SELECT product_id FROM product_sources WHERE source_key=?').get(key);
        if(row)matches.add(Number(row.product_id));
      }
      if(matches.size>1) return reply.code(409).send({message:'Vínculos conflitantes. Nenhum produto foi importado.'});
      if(matches.size){
        const existing=db.prepare('SELECT source_key FROM product_sources WHERE product_id=?').all([...matches][0]).map(r=>r.source_key as string);
        if(existing.length!==p.sourceKeys.length || existing.some(k=>!p.sourceKeys.includes(k))) return reply.code(409).send({message:'O agrupamento das variações mudou. Revise antes de importar; nenhum produto foi gravado.'});
        skipped++;
      }else pending.push(p);
    }
    if(req.body.confirm){
      db.exec('BEGIN IMMEDIATE');
      try{for(const p of pending)add(p);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
    }
    return {created:req.body.confirm?pending.length:0,toCreate:pending.length,skipped,confirmed:req.body.confirm};
  });
}
