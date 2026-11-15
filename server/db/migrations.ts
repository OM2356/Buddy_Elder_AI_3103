import type Database from 'better-sqlite3';

export interface Migration {
  id: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: 1,
    name: '001_initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('senior', 'caregiver', 'admin')) DEFAULT 'senior',
        firebase_uid TEXT UNIQUE,
        preferred_language TEXT NOT NULL CHECK (preferred_language IN ('en', 'hi', 'mr')) DEFAULT 'en',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

      CREATE TABLE IF NOT EXISTS profiles (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        phone TEXT DEFAULT '',
        date_of_birth TEXT DEFAULT '',
        city TEXT DEFAULT '',
        blood_group TEXT DEFAULT '',
        allergies TEXT DEFAULT '',
        medical_conditions TEXT DEFAULT '',
        emergency_notes TEXT DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        text_size TEXT NOT NULL CHECK (text_size IN ('normal', 'large', 'xlarge')) DEFAULT 'large',
        theme TEXT NOT NULL CHECK (theme IN ('light', 'dark')) DEFAULT 'light',
        speech_rate REAL NOT NULL DEFAULT 0.95,
        speech_volume REAL NOT NULL DEFAULT 1.0,
        voice_lang TEXT NOT NULL DEFAULT 'en-IN',
        notifications_enabled INTEGER NOT NULL DEFAULT 0,
        backup_consent INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS caregiver_connections (
        id TEXT PRIMARY KEY,
        senior_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        caregiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        relationship TEXT NOT NULL DEFAULT 'Family Member',
        sharing_level TEXT NOT NULL CHECK (sharing_level IN ('PRIVATE', 'LIMITED', 'AUTHORIZED')) DEFAULT 'LIMITED',
        status TEXT NOT NULL CHECK (status IN ('active', 'revoked')) DEFAULT 'active',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(senior_id, caregiver_id)
      );
      CREATE INDEX IF NOT EXISTS idx_caregiver_conn_senior ON caregiver_connections(senior_id);
      CREATE INDEX IF NOT EXISTS idx_caregiver_conn_caregiver ON caregiver_connections(caregiver_id);

      CREATE TABLE IF NOT EXISTS trusted_contacts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        relationship TEXT NOT NULL,
        is_emergency INTEGER NOT NULL DEFAULT 1,
        notes TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_trusted_contacts_user ON trusted_contacts(user_id);

      CREATE TABLE IF NOT EXISTS invitations (
        id TEXT PRIMARY KEY,
        senior_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invitee_email TEXT NOT NULL,
        relationship TEXT NOT NULL,
        proposed_sharing_level TEXT NOT NULL CHECK (proposed_sharing_level IN ('PRIVATE', 'LIMITED', 'AUTHORIZED')) DEFAULT 'LIMITED',
        token TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')) DEFAULT 'pending',
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        responded_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(invitee_email);

      CREATE TABLE IF NOT EXISTS consent_records (
        id TEXT PRIMARY KEY,
        senior_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        grantee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        grantee_email TEXT NOT NULL DEFAULT '',
        module_name TEXT NOT NULL,
        action_description TEXT NOT NULL,
        sharing_level TEXT NOT NULL CHECK (sharing_level IN ('PRIVATE', 'LIMITED', 'AUTHORIZED')) DEFAULT 'PRIVATE',
        status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')) DEFAULT 'pending',
        granted_at TEXT,
        revoked_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_consent_senior ON consent_records(senior_id);

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        language TEXT NOT NULL CHECK (language IN ('en', 'hi', 'mr')) DEFAULT 'en',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        capability_used TEXT DEFAULT 'general_conversation',
        verification_note TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at ASC);

      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        difficulty TEXT NOT NULL CHECK (difficulty IN ('Beginner', 'Intermediate')) DEFAULT 'Beginner',
        description TEXT NOT NULL,
        estimated_minutes INTEGER NOT NULL DEFAULT 15,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_published INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS lessons (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        steps_json TEXT NOT NULL,
        audio_script TEXT NOT NULL,
        practice_prompt TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id, sort_order ASC);

      CREATE TABLE IF NOT EXISTS quizzes (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        options_json TEXT NOT NULL,
        correct_index INTEGER NOT NULL,
        explanation TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS learning_progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
        lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        completed INTEGER NOT NULL DEFAULT 0,
        bookmarked INTEGER NOT NULL DEFAULT 0,
        quiz_score INTEGER,
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(user_id, lesson_id)
      );
      CREATE INDEX IF NOT EXISTS idx_learning_progress_user ON learning_progress(user_id, course_id);

      CREATE TABLE IF NOT EXISTS scam_detection_records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email', 'url', 'payment', 'phone')),
        content_preview TEXT NOT NULL,
        detected_indicators_json TEXT NOT NULL,
        risk_score INTEGER NOT NULL,
        risk_level TEXT NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
        safety_guidance TEXT NOT NULL,
        reported_flag INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_scam_user ON scam_detection_records(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS wellness_checkins (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mood TEXT NOT NULL CHECK (mood IN ('great', 'good', 'okay', 'low', 'stressed')),
        energy_level INTEGER NOT NULL CHECK (energy_level BETWEEN 1 AND 10),
        sleep_hours REAL NOT NULL CHECK (sleep_hours BETWEEN 0 AND 24),
        water_glasses INTEGER NOT NULL DEFAULT 0,
        activity_done TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        sharing_level TEXT NOT NULL CHECK (sharing_level IN ('PRIVATE', 'LIMITED', 'AUTHORIZED')) DEFAULT 'PRIVATE',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_wellness_user ON wellness_checkins(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('medication', 'water', 'exercise', 'appointment', 'learning', 'family', 'custom')),
        schedule_time TEXT NOT NULL,
        recurring TEXT NOT NULL CHECK (recurring IN ('none', 'daily', 'weekly')) DEFAULT 'daily',
        timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
        completed INTEGER NOT NULL DEFAULT 0,
        last_completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id, schedule_time ASC);

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reminder_id TEXT REFERENCES reminders(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        delivery_channel TEXT NOT NULL CHECK (delivery_channel IN ('browser', 'in_app')) DEFAULT 'in_app',
        status TEXT NOT NULL CHECK (status IN ('pending', 'shown', 'dismissed', 'unverified')) DEFAULT 'pending',
        scheduled_for TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS research_documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        authors TEXT NOT NULL,
        topic TEXT NOT NULL,
        published_year INTEGER NOT NULL,
        source_url TEXT NOT NULL,
        summary TEXT NOT NULL,
        content_excerpt TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS backup_metadata (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        cipher_alg TEXT NOT NULL DEFAULT 'AES-256-GCM',
        checksum_sha256 TEXT NOT NULL,
        record_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT DEFAULT '',
        metadata_json TEXT NOT NULL DEFAULT '{}',
        ip_address TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

      CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category TEXT NOT NULL CHECK (category IN ('bug', 'accessibility', 'suggestion', 'safety', 'praise')),
        rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        message TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('open', 'reviewed', 'resolved')) DEFAULT 'open',
        admin_reply TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS caregiver_notes (
        id TEXT PRIMARY KEY,
        caregiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        senior_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        note TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
  },
  {
    id: 2,
    name: '002_password_reset_and_research_chunks',
    sql: `
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_pwd_reset_user ON password_reset_tokens(user_id);

      ALTER TABLE research_documents ADD COLUMN is_user_uploaded INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE research_documents ADD COLUMN uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL;

      CREATE TABLE IF NOT EXISTS research_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL REFERENCES research_documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        keywords TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_research_chunks_doc ON research_chunks(document_id, chunk_index ASC);
    `,
  },
];

export function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[]).map((r) => r.name)
  );

  for (const migration of migrations) {
    if (!applied.has(migration.name)) {
      const tx = db.transaction(() => {
        db.exec(migration.sql);
        db.prepare('INSERT INTO schema_migrations (id, name) VALUES (?, ?)').run(migration.id, migration.name);
      });
      tx();
    }
  }
}
