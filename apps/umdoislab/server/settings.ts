import type {FastifyInstance} from 'fastify';
import type {DatabaseSync} from 'node:sqlite';
const areas=['fabricacao','orcamentos','clientes','produtos'];
const params={type:'object',required:['area'],properties:{area:{enum:areas}}};
const fields={quotesPerPage:{enum:['10','15','20','all']},originPostal:{type:'string',maxLength:20,pattern:'^(|[0-9]{5}-?[0-9]{3})$'},dailyCapacity:{type:'string',maxLength:1000},workDays:{type:'string',maxLength:1000},machines:{type:'string',maxLength:2000},queue:{type:'string',maxLength:2000},contingency:{type:'string',maxLength:1000}};
export function registerSettings(app:FastifyInstance,db:DatabaseSync){
 db.exec('CREATE TABLE IF NOT EXISTS area_settings (area TEXT PRIMARY KEY, data TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1)');
 app.get<{Params:{area:string}}>('/api/settings/:area',{schema:{params}},req=>{
  const row=db.prepare('SELECT data,revision FROM area_settings WHERE area=?').get(req.params.area);
  return row?{data:JSON.parse(row.data as string),revision:row.revision}:{data:{},revision:0};
 });
 app.put<{Params:{area:string};Body:{data:Record<string,string>;expectedRevision:number}}>('/api/settings/:area',{bodyLimit:16384,schema:{params,body:{type:'object',additionalProperties:false,required:['data','expectedRevision'],properties:{expectedRevision:{type:'integer',minimum:0},data:{type:'object',additionalProperties:false,properties:fields}}}}},(req,reply)=>{
  const allowed=req.params.area==='orcamentos'?['originPostal','quotesPerPage']:req.params.area==='fabricacao'?['dailyCapacity','workDays','machines','queue','contingency']:[];
  if(Object.keys(req.body.data).some(k=>!allowed.includes(k)))return reply.code(400).send({message:'Configuração não pertence a esta área.'});
  const row=db.prepare('SELECT revision FROM area_settings WHERE area=?').get(req.params.area);
  const revision=Number(row?.revision??0);
  if(revision!==req.body.expectedRevision)return reply.code(409).send({message:'Estas configurações foram alteradas em outra janela. Reabra a página antes de salvar.'});
  db.prepare('INSERT INTO area_settings(area,data,revision) VALUES (?,?,?) ON CONFLICT(area) DO UPDATE SET data=excluded.data,revision=excluded.revision').run(req.params.area,JSON.stringify(req.body.data),revision+1);
  return {revision:revision+1};
 });
}
