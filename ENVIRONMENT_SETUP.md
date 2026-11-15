# ENVIRONMENT SETUP — Buddy Elder AI

## Server-Side Environment Variables (Never Expose to Frontend)

| Variable | Purpose | Required | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | Server-side Google Gemini API key | Yes (for AI) | Never prefix with `VITE_` |
| `GEMINI_MODEL` | Gemini model alias/ID | No | Defaults to `gemini-4-hydrogen` |
| `JWT_SECRET` | Signs HTTP-only session JWTs | Yes | Generate >=32 random bytes |
| `BACKUP_ENCRYPTION_SECRET` | Derives AES-256-GCM key for backups | Yes | Must differ from `JWT_SECRET` |
| `FIREBASE_PROJECT_ID` | Firebase project ID for backend RS256 ID token verification | Yes (Prod) | Set to `gen-lang-client-0339283160` |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist | No | Defaults include `http://localhost:3000` and `https://buddy-elder-ai-31.vercel.app` |
| `APP_URL` | Public deployment URL | Yes (Prod) | Set to `https://buddy-elder-ai-31.vercel.app` |
| `PORT` | Express listen port | No | Defaults to `3000` |
| `DATABASE_PATH` | SQLite file path | No | Defaults to `./data/buddy_elder.db` locally and `/tmp/buddy_elder.db` on Vercel |
| `RESEND_API_KEY` | Resend email API key for password reset & notifications | No | Optional; password reset returns honest notice if unset |
| `RESEND_FROM_EMAIL` | Verified Resend sender identity | No | Required when `RESEND_API_KEY` is set |
| `ADMIN_NOTIFICATION_EMAIL` | Recipient for feedback notifications | No | Defaults to `omkarsathe3103@gmail.com` |

## Frontend Public Environment Variables (`VITE_*`)

| Variable | Purpose | Required | Notes |
|---|---|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Web API key | Yes (Vercel) | From Firebase Console (`Buddy Elder AI Web`) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | Yes (Vercel) | Usually `gen-lang-client-0339283160.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID | Yes (Vercel) | `gen-lang-client-0339283160` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket | No | From Firebase Web App config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | Yes (Vercel) | `373454483929` |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID | Yes (Vercel) | `1:373454483929:web:a4e321c3623df3196e29c8` |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | Named Firestore database ID | Yes (Vercel) | `ai-studio-333382bc-1651-47e3-9760-3843b6d200a1` |
| `VITE_API_BASE_URL` | Optional external backend origin | No | Leave empty on Vercel to use bundled `/api/*` serverless adapter |

> **Note on `DATABASE_URL`**: This codebase does **not** use `DATABASE_URL` (no Postgres/MySQL driver is used). Structured relational data uses SQLite (`DATABASE_PATH`) paired with Firebase Firestore (`VITE_FIREBASE_FIRESTORE_DATABASE_ID`).

## Local Development

```bash
npm install
npm run dev
```

The Express server listens on port `3000` and mounts Vite middleware automatically in development mode.
