# API DOCUMENTATION — Buddy Elder AI

All endpoints return consistent JSON envelopes (`{ ok: true, ... }` or `{ ok: false, error, code }`) and enforce JWT authentication, Zod validation, Helmet headers, CORS allowlist, redacted request logging, and rate limiting.

## Health & Auth
- `GET /api/health` — Database, Gemini configuration status, uptime
- `POST /api/auth/register` — Create senior or caregiver account (bcrypt + JWT cookie)
- `POST /api/auth/login` — Authenticate with email/password
- `POST /api/auth/firebase` — Verify Firebase Google ID token and issue authoritative session JWT
- `POST /api/auth/logout` — Clear session cookie and log audit event
- `GET /api/auth/me` — Return current user, profile, and accessibility preferences
- `PUT /api/auth/profile` — Update full name, preferred language, phone, and city
- `POST /api/auth/change-password` — Authenticated password update (verifies current password)
- `POST /api/auth/forgot-password` — Generate single-use 15-minute SHA-256 hashed reset token
- `POST /api/auth/reset-password` — Verify reset token and update password hash

## AI Buddy Assistant & Orchestrator
- `GET /api/assistant/conversations` — List user's conversations (`?q=` search)
- `POST /api/assistant/conversations` — Create conversation
- `PATCH /api/assistant/conversations/:id` — Rename conversation
- `DELETE /api/assistant/conversations/:id` — Delete conversation & messages
- `GET /api/assistant/conversations/:id/messages` — Get message history
- `POST /api/assistant/chat` — Invoke `BuddyAgentOrchestrator` (`stream`, `regenerate`)
- `POST /api/assistant/transform` — Transform message (`simplify` | `shorten` | `examples` | `translate_hi` | `translate_mr`)

## Scam Shield
- `POST /api/scam/analyze` — Deterministic + optional AI analysis (`channel`, `content`)
- `GET /api/scam/history` — Paginated scam check history (`?limit=&offset=`)
- `POST /api/scam/report/:id` — Flag a detection record for cybercrime reporting workflow

## Wellness Center
- `GET /api/wellness/checkins` — Paginated history (`?limit=&offset=`) + 7-day summary
- `POST /api/wellness/checkins` — Log daily mood, energy, sleep, water, activity, notes, sharing level
- `PATCH /api/wellness/checkins/:id/privacy` — Update sharing level (`PRIVATE` | `LIMITED` | `AUTHORIZED`)
- `DELETE /api/wellness/checkins/:id` — Owner-scoped deletion of a wellness record

## Family Hub & Autonomy Engine
- `GET /api/family/overview` — Connections, trusted contacts, pending invitations
- `POST /api/family/contacts` / `DELETE /api/family/contacts/:id` — Manage trusted contacts
- `POST /api/family/invite` — Send caregiver invitation
- `POST /api/family/invitations/:id/respond` — Accept or reject invitation
- `DELETE /api/family/connections/:id` — Revoke caregiver connection
- `GET /api/autonomy/consents` — List consent records & privacy history
- `POST /api/autonomy/consents` — Request/create consent record
- `PATCH /api/autonomy/consents/:id` — Approve, reject, or revoke consent

## Digital Learning Academy
- `GET /api/academy/courses` — Courses, lessons, quizzes, user progress, personalized recommendations
- `POST /api/academy/progress` — Mark lesson complete or toggle bookmark
- `POST /api/academy/quiz` — Submit quiz answers and record score

## Research Knowledge Hub
- `GET /api/research` — Search and filter curated & uploaded research papers
- `POST /api/research/upload` — Validated `.txt`/`.md` upload or text ingestion + chunk indexing
- `DELETE /api/research/:id` — Owner/admin removal of user-uploaded documents
- `POST /api/research/ask` — Chunk-retrieval RAG Q&A grounded strictly in top matching sections with source attribution

## Smart Reminders & Emergency
- `GET /api/reminders` / `POST /api/reminders` / `PATCH /api/reminders/:id` / `DELETE /api/reminders/:id` — CRUD + due-notification sync
- `PATCH /api/reminders/notifications/:id/dismiss` — Dismiss active in-app reminder notification
- `GET /api/emergency/profile` / `PUT /api/emergency/profile` — Voluntary medical info & emergency contacts
- `POST /api/emergency/sos-log` — Record double-confirmed SOS action & optional consented coordinates

## Caregiver & Admin
- `GET /api/caregiver/seniors` — Only seniors with active consent (`LIMITED`/`AUTHORIZED`)
- `POST /api/caregiver/notes` — Add family communication note
- `GET /api/admin/overview` — System health, analytics, users, feedback, audit logs (no private senior content)
- `PATCH /api/admin/users/:id` / `POST /api/admin/courses` / `POST /api/admin/research` / `PATCH /api/admin/feedback/:id`

## Preferences, Feedback & Backup
- `GET /api/preferences` / `PATCH /api/preferences`
- `POST /api/feedback` / `GET /api/feedback`
- `GET /api/backup/history` / `POST /api/backup/export` / `POST /api/backup/restore`
