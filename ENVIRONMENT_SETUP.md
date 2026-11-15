# ENVIRONMENT SETUP — Buddy Elder AI

## Required Variables

| Variable | Purpose | Required | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | Server-side Google Gemini API key | Yes (for AI) | Never exposed to frontend |
| `GEMINI_MODEL` | Gemini model alias/ID | No | Defaults to `gemini-4-hydrogen` |
| `JWT_SECRET` | Signs HTTP-only session JWTs | Yes | Generate >=32 random bytes |
| `BACKUP_ENCRYPTION_SECRET` | Derives AES-256-GCM key for backups | Yes | Must differ from `JWT_SECRET` |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist | No | Defaults to `http://localhost:3000,APP_URL` |
| `APP_URL` | Public deployment URL | No | Used for origin & link validation |
| `PORT` | Express listen port | No | Defaults to `3000` |
| `DATABASE_PATH` | SQLite file path | No | Defaults to `./data/buddy_elder.db` |

## Local Development

```bash
npm install
npm run dev
```

The Express server listens on port `3000` and mounts Vite middleware automatically in development mode.
