# KNOWN ISSUES — Buddy Elder AI

All known limitations, environmental constraints, or incomplete items are documented transparently here.

1. **Playwright E2E Not Installed in Container**: Automated Vitest backend API (`13` tests) and React Testing Library (`11` tests) suites pass, and live HTTP smoke checks run against port `3000`, but headless Chromium/Playwright browser E2E tests could not run because `playwright` is not installed in the container.
2. **SMTP Email Delivery for Password Reset**: Password reset tokens are SHA-256 hashed, single-use, and expire after 15 minutes in SQLite (`password_reset_tokens`). Because no external SMTP service (`SMTP_HOST`) is configured in the container, `devResetToken` is returned only when `NODE_ENV !== 'production'` and suppressed in production until SMTP integration is wired.
3. **Research Document Upload Format**: Research Knowledge Hub validates and indexes `.txt` and `.md` plain-text uploads into `research_chunks` with lexical/BM25 scoring. Binary `.pdf`/`.docx` parsing and vector embeddings (`gemini-embedding-2`) are not enabled in this release.
4. **Tesseract.js Language Data**: Offline OCR defaults to English (`eng`); Hindi (`hin`) and Marathi (`mar`) OCR language packs download on demand from the Tesseract CDN when selected by the user and require network access on first use.
5. **Browser Web Speech API**: Voice input (`SpeechRecognition`) and local voice output (`speechSynthesis`) depend on the user's browser engine and OS voice packs.
6. **Browser Notifications**: Smart Reminder browser notifications can only fire while the browser permits notifications and the web app tab is open; the backend syncs due reminders into the in-app `notifications` table truthfully without claiming guaranteed background push delivery.
7. **SQLite on Ephemeral Hosting**: Local SQLite (`better-sqlite3`) requires persistent disk storage in production; Firebase Firestore provides cloud persistence for Google Sign-In users.
