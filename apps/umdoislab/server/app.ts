import Fastify from 'fastify';
import staticFiles from '@fastify/static';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerHomeAssistantAccess } from './adapters/home-assistant.js';
import type { AppMode } from './config.js';

export async function createApp(options: { dataDir: string; staticDir: string; mode: AppMode }) {
  const { dataDir, staticDir, mode } = options;
  mkdirSync(dataDir, { recursive: true });
  const db = new DatabaseSync(resolve(dataDir, 'validation.sqlite'));
  db.exec('CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY, text TEXT NOT NULL, updated_at TEXT NOT NULL)');
  const app = Fastify({ logger: true, bodyLimit: 4096, trustProxy: false });
  if (mode === 'home-assistant') registerHomeAssistantAccess(app);
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Cache-Control', 'no-store');
    return payload;
  });
  app.get('/api/health', () => {
    db.prepare('SELECT 1').get();
    return { status: 'ok', database: 'ok', arch: process.arch, node: process.version };
  });
  app.get('/api/note', () => db.prepare('SELECT text, updated_at FROM notes WHERE id = 1').get() ?? { text: '', updated_at: null });
  app.put<{ Body: { text: string } }>('/api/note', {
    schema: { body: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string', maxLength: 500 } } } }
  }, request => {
    const updatedAt = new Date().toISOString();
    db.prepare('INSERT INTO notes (id, text, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET text=excluded.text, updated_at=excluded.updated_at').run(request.body.text, updatedAt);
    return { text: request.body.text, updated_at: updatedAt };
  });
  await app.register(staticFiles, { root: staticDir });
  app.addHook('onClose', async () => { db.close(); });
  return app;
}
