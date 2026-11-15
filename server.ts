import fs from 'fs';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { getEnvConfig } from './server/config/env.ts';
import { getDb } from './server/db/database.ts';
import { createApp } from './server/app.ts';

async function startServer() {
  const env = getEnvConfig();
  const db = getDb(env.databasePath);
  const app = createApp(db);

  if (env.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.use(['/images', '/assets', '/favicon.svg'], (_req, res) => {
        res.status(404).end();
      });
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`Buddy Elder AI server running on http://0.0.0.0:${env.port} (${env.nodeEnv})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Buddy Elder AI server:', err);
  process.exit(1);
});
