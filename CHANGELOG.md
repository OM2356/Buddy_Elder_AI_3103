# CHANGELOG — Buddy Elder AI

## [1.1.1] — 2026-11-15
### Fixed
- Migrated all application visual assets from unbundled `/src/assets/images/` string paths to `/public/images/` (`hero-elder-companion.jpg`, `academy-digital-learning.jpg`, `wellness-morning-routine.jpg`, `family-hub-connection.jpg`) so `vite build` includes them in `dist/images/` for Vercel and Node.js production deployments.
- Added `/public/favicon.svg` and `/public/images/fallback-companion.svg`, wired `og:image`/`twitter:image` metadata in `index.html`, and upgraded `SafeImage` (`src/components/StateViews.tsx`) with two-stage local SVG fallback and explicit dimensions/loading attributes.
- Updated `vercel.json` and `server.ts` so `/images/*`, `/assets/*`, and `/favicon.svg` do not fall back to `index.html` on missing paths.

## [1.1.0] — 2026-11-15
### Added
- Migration `002_password_reset_and_research_chunks`: `password_reset_tokens` (SHA-256 hashed, 15-min expiry, single-use) and `research_chunks` tables.
- Account lifecycle endpoints: `PUT /api/auth/profile`, `POST /api/auth/change-password`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`.
- Wellness record deletion (`DELETE /api/wellness/checkins/:id`) and pagination on wellness check-ins and scam history.
- Research Knowledge Hub validated `.txt`/`.md` upload (`POST /api/research/upload`), chunk indexing, and top-K lexical chunk retrieval (`server/services/researchRag.ts`).
- Smart Reminders inline edit UI, completion history filter, due in-app notification sync, and dismissal (`PATCH /api/reminders/notifications/:id/dismiss`).
- Dedicated `/about` (`AboutPage.tsx`), `/features` (`FeaturesPage.tsx`), `/register` (`LoginPage` register mode), and `/settings` (`SettingsPage.tsx`) pages.
- Sensitive-data-redacted HTTP request logging middleware in `server/app.ts`.
- Expanded automated test suite (`tests/pages.test.tsx` + 30-prompt orchestrator routing + password reset/RAG/wellness tests = 24 passing Vitest tests).

## [1.0.0] — 2026-11-15
### Added
- Initial architecture, project tracker, database schema, security specification, and Firebase Firestore blueprint.
- Express + SQLite backend, JWT + Firebase Auth Google Sign-In, `BuddyAgentOrchestrator` with 11 capabilities, and all 13 application modules.
