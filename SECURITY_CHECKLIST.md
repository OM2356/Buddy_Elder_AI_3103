# SECURITY CHECKLIST — Buddy Elder AI

- [x] `bcryptjs` (cost >= 10) for all password hashes; plaintext passwords never stored or returned.
- [x] Authoritative JWT sessions with HTTP-only `SameSite=Lax` cookies + Bearer token verification.
- [x] Independent `JWT_SECRET` and `BACKUP_ENCRYPTION_SECRET` (never reused).
- [x] AES-256-GCM encrypted backups with random 16-byte salt, `scryptSync` key derivation, random 12-byte IV, and GCM auth tag verification.
- [x] Helmet security headers (`contentSecurityPolicy` configured cleanly for Vite/Firebase/Fonts).
- [x] Strict CORS allowlist via `ALLOWED_ORIGINS` and `APP_URL`.
- [x] Express rate limiting on API and auth/AI endpoints.
- [x] Zod input validation on every API route and SQLite parameterized queries (`?`) throughout.
- [x] RBAC enforcement (`senior`, `caregiver`, `admin`) + Autonomy Engine consent enforcement for caregiver access.
- [x] Admin privacy boundary: administrators cannot read private senior chat messages or private wellness notes.
- [x] Audit logging for login, logout, role changes, consent changes, emergency SOS confirmation, and backup export/restore.
- [x] Firebase `firestore.rules` audited against the 8 Pillars and linted with `@firebase/eslint-plugin-security-rules`.
- [x] `.gitignore` excludes `.env*`, `data/`, `backups/`, `*.db`, `*.db-wal`, `*.db-shm`.
- [x] Sensitive-data-redacted HTTP request logger omits Authorization headers, cookies, passwords, and query tokens.
- [x] Single-use SHA-256 hashed password reset tokens with 15-minute expiry (`password_reset_tokens`); dev preview token disabled when `NODE_ENV=production`.
