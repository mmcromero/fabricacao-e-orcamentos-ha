import type {FastifyInstance} from 'fastify';
import type {DatabaseSync} from 'node:sqlite';

import {clientSchema as schema,normalizeClient,type ClientDraft} from './client-data.js';

export function registerClients(app:FastifyInstance,db:DatabaseSync){
  db.exec('CREATE TABLE IF NOT EXISTS clients (id INTEGER PRIMARY KEY, data TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)');
  app.get('/api/clients',()=>db.prepare('SELECT id,data,updated_at FROM clients WHERE archived=0 ORDER BY id DESC').all().map(row=>({id:row.id,...normalizeClient(JSON.parse(row.data as string)),updatedAt:row.updated_at})));
  app.post<{Body:ClientDraft}>('/api/clients',{bodyLimit:8192,schema:{body:schema}},req=>{
    const data=normalizeClient(req.body);
    const result=db.prepare('INSERT INTO clients(data,updated_at) VALUES (?,?)').run(JSON.stringify(data),new Date().toISOString());
    return {id:Number(result.lastInsertRowid)};
  });
  app.put<{Params:{id:string};Body:ClientDraft}>('/api/clients/:id',{bodyLimit:8192,schema:{body:schema}},(req,reply)=>{
    const result=db.prepare('UPDATE clients SET data=?,updated_at=? WHERE id=? AND archived=0').run(JSON.stringify(normalizeClient(req.body)),new Date().toISOString(),req.params.id);
    return result.changes?{ok:true}:reply.code(404).send({message:'Cliente não encontrado.'});
  });
  app.delete<{Params:{id:string}}>('/api/clients/:id',(req,reply)=>{
    const result=db.prepare('UPDATE clients SET archived=1 WHERE id=? AND archived=0').run(req.params.id);
    return result.changes?{ok:true}:reply.code(404).send({message:'Cliente não encontrado.'});
  });
}
