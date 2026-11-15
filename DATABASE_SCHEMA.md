# DATABASE SCHEMA — Buddy Elder AI

## 1. SQLite Relational Schema (`better-sqlite3`)

All tables enable `PRAGMA foreign_keys = ON;` and `PRAGMA journal_mode = WAL;`. Versioned via `schema_migrations` (`001_initial_schema`, `002_password_reset_and_research_chunks`).

1. `schema_migrations (id, name, applied_at)`
2. `users (id, email, password_hash, full_name, role, firebase_uid, preferred_language, is_active, created_at, updated_at)`
3. `profiles (user_id, phone, date_of_birth, city, blood_group, allergies, medical_conditions, emergency_notes, updated_at)`
4. `user_preferences (user_id, text_size, theme, speech_rate, speech_volume, voice_lang, notifications_enabled, backup_consent, updated_at)`
5. `caregiver_connections (id, senior_id, caregiver_id, relationship, sharing_level, status, created_at, updated_at)`
6. `trusted_contacts (id, user_id, name, phone, relationship, is_emergency, notes, created_at)`
7. `invitations (id, senior_id, invitee_email, relationship, proposed_sharing_level, token, status, expires_at, created_at, responded_at)`
8. `consent_records (id, senior_id, grantee_id, grantee_email, module_name, action_description, sharing_level, status, granted_at, revoked_at, created_at)`
9. `conversations (id, user_id, title, language, created_at, updated_at)`
10. `messages (id, conversation_id, user_id, role, content, capability_used, verification_note, created_at)`
11. `courses (id, slug, title, category, difficulty, description, estimated_minutes, sort_order, is_published, created_at)`
12. `lessons (id, course_id, title, summary, steps_json, audio_script, practice_prompt, sort_order, created_at)`
13. `quizzes (id, course_id, question, options_json, correct_index, explanation, created_at)`
14. `learning_progress (id, user_id, course_id, lesson_id, completed, bookmarked, quiz_score, updated_at)`
15. `scam_detection_records (id, user_id, channel, content_preview, detected_indicators_json, risk_score, risk_level, safety_guidance, reported_flag, created_at)`
16. `wellness_checkins (id, user_id, mood, energy_level, sleep_hours, water_glasses, activity_done, notes, sharing_level, created_at)`
17. `reminders (id, user_id, title, category, schedule_time, recurring, timezone, completed, last_completed_at, created_at, updated_at)`
18. `notifications (id, user_id, reminder_id, title, body, delivery_channel, status, scheduled_for, created_at)`
19. `research_documents (id, title, authors, topic, published_year, source_url, summary, content_excerpt, is_user_uploaded, uploaded_by, created_at)`
20. `research_chunks (id, document_id, chunk_index, chunk_text, keywords, created_at)`
21. `backup_metadata (id, user_id, filename, cipher_alg, checksum_sha256, record_count, created_at)`
22. `audit_logs (id, actor_id, action, target_type, target_id, metadata_json, ip_address, created_at)`
23. `feedback (id, user_id, category, rating, message, status, admin_reply, created_at, updated_at)`
24. `caregiver_notes (id, caregiver_id, senior_id, note, created_at)`
25. `password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at)`

## 2. Firestore Cloud Schema (`firebase-blueprint.json`)

Used for Google Sign-In synchronization and cloud persistence under strict ABAC/RBAC rules:
- `/users/{userId}` — Non-PII preferences and profile display data
- `/users/{userId}/private/{docId}` — Isolated PII (email, phone, voluntary medical summary)
- `/admins/{userId}` — Trusted admin registry
- `/conversations/{convId}` & `/conversations/{convId}/messages/{msgId}`
- `/wellnessCheckins/{checkinId}`
- `/reminders/{reminderId}`
- `/consentRecords/{consentId}`
- `/scamReports/{reportId}`
