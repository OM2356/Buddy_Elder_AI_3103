# DEPLOYMENT GUIDE — Buddy Elder AI

## Important Architecture Reality

1. **Serverless vs. Persistent Node.js Hosting**:
   - Local SQLite files (`better-sqlite3`) do **not** persist across ephemeral serverless functions (e.g., standard Vercel serverless routes).
   - For production deployment with SQLite persistence, deploy the unified Express server (`server.ts`) to a persistent container/VM host (such as **Google Cloud Run with a mounted persistent volume / Cloud SQL / Turso**, **Railway**, **Render**, or **Fly.io**), OR rely on **Firebase Firestore** (already provisioned for cloud persistence) when deploying a static/serverless frontend.
   - A `vercel.json` SPA rewrite configuration is provided if hosting the Vite frontend separately with `VITE_API_BASE_URL` pointing to the persistent Express backend.

## Build & Start Commands

```bash
npm install
npm run build
npm start
```

## Production Environment Variables

Configure these securely in your hosting provider's secret manager:
- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-4-hydrogen`
- `JWT_SECRET` (64-char random hex)
- `BACKUP_ENCRYPTION_SECRET` (separate 64-char random hex)
- `ALLOWED_ORIGINS`
- `APP_URL`
- `PORT=3000`
- `DATABASE_PATH=/var/data/buddy_elder.db`
