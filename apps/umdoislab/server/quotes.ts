import {clientSchema} from './client-data.js';
import type {FastifyInstance} from 'fastify';
import type {DatabaseSync} from 'node:sqlite';
const text=(maxLength:number)=>({type:'string',maxLength});
const amount={type:['integer','null'],minimum:0,maximum:10000000000};
const prices={type:'object',additionalProperties:false,required:['wholesale','factory','retail'],properties:{wholesale:amount,factory:amount,retail:amount}};
const item={type:'object',additionalProperties:false,required:['id','name','productId','prices','priceKey','quantity','origin','lengthCm','widthCm','heightCm','weightGrams','packaging','packagingType','packagingAmount','packagingIncluded'],properties:{
 id:{type:'integer',minimum:1},name:{...text(200),minLength:1,pattern:'\\S'},productId:{type:['integer','null'],minimum:1},prices,
 priceKey:{enum:['','wholesale','factory','retail']},quantity:{type:'string',maxLength:6,pattern:'^[0-9]*$'},origin:{enum:['own','client']},
 lengthCm:{type:['number','null'],exclusiveMinimum:0,maximum:1000000},widthCm:{type:['number','null'],exclusiveMinimum:0,maximum:1000000},heightCm:{type:['number','null'],exclusiveMinimum:0,maximum:1000000},weightGrams:{type:['number','null'],exclusiveMinimum:0,maximum:1000000},
 packaging:{enum:['','none','with']},packagingType:text(200),packagingAmount:{type:'string',maxLength:14},packagingIncluded:{type:'boolean'}
}};
const client={anyOf:[{type:'null'},{...clientSchema,required:[...clientSchema.required,'id'],properties:{...clientSchema.properties,id:{type:'integer',minimum:1}}}]};
const dataSchema={type:'object',additionalProperties:false,required:['client','items','notes'],properties:{client,notes:text(10000),items:{type:'array',maxItems:200,items:item}}};
type Line={id:number;name:string;prices:Record<string,number|null>;priceKey:string;quantity:string;packaging:string;packagingAmount:string;packagingIncluded:boolean};
export function quoteTotals(items:Line[]){
 let productCents=0,packagingCents=0,pending=false;
 for(const item of items){
  const quantity=Number(item.quantity);const price=item.prices[item.priceKey];
  if(!Number.isSafeInteger(quantity)||quantity<1){pending=true;continue;}
  if(typeof price==='number'&&Number.isSafeInteger(productCents+price*quantity))productCents+=price*quantity;else pending=true;
  const extra=item.packaging==='none'||(item.packaging==='with'&&item.packagingIncluded)?0:item.packaging==='with'&&/^\d+(?:[.,]\d{1,2})?$/.test(item.packagingAmount)?Math.round(Number(item.packagingAmount.replace(',','.'))*100):null;
  if(extra!==null&&Number.isSafeInteger(packagingCents+extra*quantity))packagingCents+=extra*quantity;else pending=true;
  if(item.packaging==='with'&&!(item as Line&{packagingType:string}).packagingType?.trim())pending=true;
 }
 const subtotalCents=Number.isSafeInteger(productCents+packagingCents)?productCents+packagingCents:null;
 return {productCents,packagingCents,subtotalCents,pending:pending||subtotalCents===null,freightPending:true};
}
export function registerQuotes(app:FastifyInstance,db:DatabaseSync){
 db.exec('CREATE TABLE IF NOT EXISTS quotes (id INTEGER PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0)');
 const body={type:'object',additionalProperties:false,required:['data','expectedRevision'],properties:{data:dataSchema,expectedRevision:{type:'integer',minimum:0}}};
 const decode=(row:Record<string,unknown>)=>{const data=JSON.parse(row.data as string);return {id:row.id,data,revision:row.revision,updatedAt:row.updated_at,totals:quoteTotals(data.items)};};
 app.get('/api/quotes',()=>db.prepare('SELECT * FROM quotes WHERE archived=0 ORDER BY id DESC').all().map(decode));
 app.get<{Params:{id:string}}>('/api/quotes/:id',(req,reply)=>{const row=db.prepare('SELECT * FROM quotes WHERE id=? AND archived=0').get(req.params.id);return row?decode(row):reply.code(404).send({message:'Orçamento não encontrado.'});});
 function unique(items:Line[]){return new Set(items.map(i=>i.id)).size===items.length;}
 app.post<{Body:{data:{items:Line[]};expectedRevision:number}}>('/api/quotes',{bodyLimit:512*1024,schema:{body}},(req,reply)=>{
  if(req.body.expectedRevision!==0||!unique(req.body.data.items))return reply.code(400).send({message:'Revise a versão e os itens do orçamento.'});
  const result=db.prepare('INSERT INTO quotes(data,updated_at) VALUES (?,?)').run(JSON.stringify(req.body.data),new Date().toISOString());return {id:Number(result.lastInsertRowid),revision:1};
 });
 app.put<{Params:{id:string};Body:{data:{items:Line[]};expectedRevision:number}}>('/api/quotes/:id',{bodyLimit:512*1024,schema:{body}},(req,reply)=>{
  if(!unique(req.body.data.items))return reply.code(400).send({message:'Identificador de item repetido.'});
  const result=db.prepare('UPDATE quotes SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND archived=0').run(JSON.stringify(req.body.data),new Date().toISOString(),req.params.id,req.body.expectedRevision);
  return result.changes?{id:Number(req.params.id),revision:req.body.expectedRevision+1}:reply.code(409).send({message:'Este orçamento foi alterado em outra janela. Preserve suas alterações e reabra a versão salva antes de continuar.'});
 });
}
