import type { IncomingMessage, ServerResponse } from 'http';
import { getEnvConfig } from '../server/config/env.ts';
import { getDb } from '../server/db/database.ts';
import { createApp } from '../server/app.ts';

let cachedHandler: ReturnType<typeof createApp> | null = null;

function getHandler() {
  if (!cachedHandler) {
    const env = getEnvConfig();
    const db = getDb(env.databasePath);
    cachedHandler = createApp(db);
  }
  return cachedHandler;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }
  const app = getHandler();
  return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
}
