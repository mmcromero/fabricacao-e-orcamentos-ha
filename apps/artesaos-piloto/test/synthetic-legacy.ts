/** Exclusivamente fixtures sintéticas descartáveis: simula schema anterior ao ledger. */
import type {DatabaseSync} from 'node:sqlite';
import {migrations} from '../server/foundation/migrations.js';
export function removePostLegacyFixtureTables(db:DatabaseSync){
 db.exec('DROP TRIGGER IF EXISTS clients_origin_immutable; DROP INDEX IF EXISTS clients_capture_session');
 for(const col of ['commercial_type','registration_origin','capture_session_id','created_at'])if(db.prepare('PRAGMA table_info(clients)').all().some(r=>r.name===col))db.exec('ALTER TABLE clients DROP COLUMN '+col);
 for(const migration of migrations.tenant.filter(m=>m.version>=3).toReversed())
  for(const match of [...migration.sql.matchAll(/CREATE TABLE (\w+)/g)].reverse())db.exec('DROP TABLE '+match[1]);
}
