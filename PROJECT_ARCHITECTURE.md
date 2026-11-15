# PROJECT ARCHITECTURE — Buddy Elder AI

## 1. High-Level System Design

Buddy Elder AI is a full-stack, role-aware digital companion built as a unified TypeScript monorepo serving three distinct user experiences:

1. **Senior Citizens (`senior`)**: Accessible warm-cream / high-contrast workspace with `>=20px` body text, adjustable font sizes, light/dark modes, English/Hindi/Marathi localization, Web Speech voice I/O, AI Buddy, Scam Shield, OCR Audio Reader, Wellness Center, Digital Learning Academy, Research Hub, Smart Reminders, Family Hub, Autonomy Engine, Emergency Assistance, and Encrypted Backup.
2. **Caregivers & Family (`caregiver`)**: Dedicated dashboard displaying only senior data explicitly authorized through the Autonomy Engine (`LIMITED` or `AUTHORIZED` consent records), shared reminders, learning progress, approved wellness summaries, and caregiver notes.
3. **Administrators (`admin`)**: Platform operations console for managing users/roles, courses/lessons, research resources, system/API health, error/audit logs, usage analytics, and user feedback—strictly isolated from private senior conversations and private wellness notes.

## 2. Technology Layers

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4 (`@custom-variant dark`), React Router v7, Lucide React, Motion (`motion/react`), React Hook Form + Zod, React Markdown, Tesseract.js (OCR), Web Speech API (`SpeechRecognition` + `speechSynthesis`), Firebase JS SDK (Auth + Firestore).
- **Backend**: Node.js 22 + Express 4 (`server.ts` serving Vite middleware in development and `dist/` in production on port 3000), Helmet, CORS allowlist, `express-rate-limit`, `cookie-parser`, Multer (validated image/text uploads), `bcryptjs`, `jsonwebtoken`, Zod input validation.
- **Database**:
  - **SQLite (`better-sqlite3`, WAL mode, foreign keys ON)**: 21 normalized relational tables with versioned migrations and atomic transactions (`server/db/migrations.ts`).
  - **Firebase (Auth + Firestore)**: Google Sign-In (`signInWithPopup`) + Firestore cloud persistence for user preferences, conversations, wellness check-ins, reminders, consent records, and scam reports secured by hardened ABAC/RBAC `firestore.rules`.
- **AI Orchestration**: Server-side `@google/genai` SDK (`gemini-4-hydrogen` default, configurable via `GEMINI_MODEL`) inside `BuddyAgentOrchestrator` (`server/services/orchestrator.ts`) routing requests across 11 specialized capabilities without redundant LLM calls.

## 3. Authentication & Authority Model

- One unified `AuthContext` manages sessions.
- Email/password accounts authenticate against SQLite `users` (`bcryptjs`) and receive an HTTP-only `buddy_session` JWT cookie (plus Bearer support for API clients).
- Google Sign-In authenticates via Firebase Auth (`signInWithPopup`), verifies/exchanges the Firebase ID token at `POST /api/auth/firebase` against Google's JWK public keys, provisions/syncs the SQLite user record, and issues the same authoritative JWT session while enabling Firestore sync.

## 4. Security & Privacy Architecture

- **Autonomy Engine**: Every cross-user data share requires an explicit `consent_records` entry (`PRIVATE` | `LIMITED` | `AUTHORIZED`).
- **AES-256-GCM Backups**: `BACKUP_ENCRYPTION_SECRET` (distinct from `JWT_SECRET`) derives a 256-bit key via `crypto.scryptSync` with random salt and unique 12-byte IV per export, verified via GCM authentication tag on restore.
- **No Exposed Secrets**: `GEMINI_API_KEY`, `JWT_SECRET`, and `BACKUP_ENCRYPTION_SECRET` remain strictly server-side.
