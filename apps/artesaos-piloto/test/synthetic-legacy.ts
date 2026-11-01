/** Exclusivamente fixtures sintéticas descartáveis: simula schema anterior ao ledger. */
import type {DatabaseSync} from 'node:sqlite';
import {migrations} from '../server/foundation/migrations.js';
export function removePostLegacyFixtureTables(db:DatabaseSync){
 for(const migration of migrations.tenant.filter(m=>m.version>=3).toReversed())
  for(const match of [...migration.sql.matchAll(/CREATE TABLE (\w+)/g)].reverse())db.exec('DROP TABLE '+match[1]);
}
