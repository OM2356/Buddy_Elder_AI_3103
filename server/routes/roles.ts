import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { createAuthMiddleware, requireRole, type AuthedRequest } from '../middleware/auth.ts';
import { logAudit } from '../services/audit.ts';
import { exportUserBackup, restoreUserBackup, type EncryptedBackupEnvelope } from '../services/backup.ts';
import { isGeminiConfigured } from '../services/gemini.ts';
import { sendAdminNotificationEmail } from '../services/email.ts';
import { indexDocumentChunks } from '../services/researchRag.ts';

const caregiverNoteSchema = z.object({
  seniorId: z.string().min(1),
  note: z.string().min(2).max(500),
});

const feedbackSchema = z.object({
  category: z.enum(['bug', 'accessibility', 'suggestion', 'safety', 'praise']),
  rating: z.number().int().min(1).max(5),
  message: z.string().min(4).max(1000),
});

const adminUserUpdateSchema = z.object({
  role: z.enum(['senior', 'caregiver', 'admin']).optional(),
  isActive: z.boolean().optional(),
});

const adminFeedbackUpdateSchema = z.object({
  status: z.enum(['open', 'reviewed', 'resolved']),
  adminReply: z.string().max(600).default(''),
});

const adminCourseSchema = z.object({
  title: z.string().min(3).max(160),
  category: z.string().min(2).max(60),
  difficulty: z.enum(['Beginner', 'Intermediate']).default('Beginner'),
  description: z.string().min(10).max(600),
  estimatedMinutes: z.number().int().min(5).max(120).default(15),
});

const adminResearchSchema = z.object({
  title: z.string().min(4).max(200),
  authors: z.string().min(2).max(200),
  topic: z.string().min(2).max(80),
  publishedYear: z.number().int().min(1990).max(2030),
  sourceUrl: z.string().url().max(300),
  summary: z.string().min(10).max(800),
  contentExcerpt: z.string().min(20).max(4000),
});

export function createRolesAndUtilityRouter(db: Database.Database) {
  const router = Router();
  const requireAuth = createAuthMiddleware(db);
  router.use(requireAuth);

  // --- CAREGIVER DASHBOARD (Strict Consent Filtering) ---
  router.get('/caregiver/seniors', requireRole('caregiver', 'admin'), (req: AuthedRequest, res) => {
    const connections = db
      .prepare(
        `SELECT cc.*, u.full_name as senior_name, u.email as senior_email, u.preferred_language
         FROM caregiver_connections cc
         JOIN users u ON u.id = cc.senior_id
         WHERE cc.caregiver_id = ? AND cc.status = 'active'`
      )
      .all(req.user!.id) as {
      id: string;
      senior_id: string;
      senior_name: string;
      senior_email: string;
      relationship: string;
      sharing_level: 'PRIVATE' | 'LIMITED' | 'AUTHORIZED';
    }[];

    const seniors = connections.map((conn) => {
      const notes = db
        .prepare('SELECT * FROM caregiver_notes WHERE caregiver_id = ? AND senior_id = ? ORDER BY created_at DESC LIMIT 20')
        .all(req.user!.id, conn.senior_id);

      if (conn.sharing_level === 'PRIVATE') {
        return {
          connectionId: conn.id,
          seniorId: conn.senior_id,
          seniorName: conn.senior_name,
          relationship: conn.relationship,
          sharingLevel: conn.sharing_level,
          accessNotice: 'This senior has set sharing to PRIVATE. No wellness, reminder, or learning details are shared.',
          wellnessSummary: [],
          reminders: [],
          learningStats: null,
          emergencyContacts: [],
          notes,
        };
      }

      const wellnessRows = db
        .prepare(
          `SELECT id, mood, energy_level, sleep_hours, water_glasses, sharing_level, created_at
           ${conn.sharing_level === 'AUTHORIZED' ? ', notes' : ''}
           FROM wellness_checkins
           WHERE user_id = ? AND sharing_level != 'PRIVATE'
           ORDER BY created_at DESC LIMIT 7`
        )
        .all(conn.senior_id);

      const reminders = db
        .prepare('SELECT id, title, category, schedule_time, recurring, completed FROM reminders WHERE user_id = ? ORDER BY schedule_time ASC LIMIT 15')
        .all(conn.senior_id);

      const learningStats = db
        .prepare(
          `SELECT COUNT(CASE WHEN completed = 1 THEN 1 END) as completedLessons,
                  ROUND(AVG(quiz_score)) as avgQuizScore
           FROM learning_progress WHERE user_id = ?`
        )
        .get(conn.senior_id);

      const emergencyContacts =
        conn.sharing_level === 'AUTHORIZED'
          ? db
              .prepare('SELECT id, name, phone, relationship FROM trusted_contacts WHERE user_id = ? AND is_emergency = 1')
              .all(conn.senior_id)
          : [];

      return {
        connectionId: conn.id,
        seniorId: conn.senior_id,
        seniorName: conn.senior_name,
        relationship: conn.relationship,
        sharingLevel: conn.sharing_level,
        accessNotice:
          conn.sharing_level === 'LIMITED'
            ? 'LIMITED sharing: private journal notes and AI chat messages remain strictly hidden.'
            : 'AUTHORIZED sharing: approved wellness summaries, reminders, learning progress, and emergency contacts are visible. Private AI chats remain hidden.',
        wellnessSummary: wellnessRows,
        reminders,
        learningStats,
        emergencyContacts,
        notes,
      };
    });

    res.json({ ok: true, seniors });
  });

  router.post('/caregiver/notes', requireRole('caregiver', 'admin'), (req: AuthedRequest, res) => {
    const parsed = caregiverNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Please enter a valid family note.', code: 'VALIDATION_ERROR' });
      return;
    }

    const conn = db
      .prepare('SELECT id FROM caregiver_connections WHERE caregiver_id = ? AND senior_id = ? AND status = \'active\'')
      .get(req.user!.id, parsed.data.seniorId);

    if (!conn) {
      res.status(403).json({ ok: false, error: 'No active caregiver connection to this senior.', code: 'FORBIDDEN' });
      return;
    }

    const id = `note_${crypto.randomUUID()}`;
    db.prepare('INSERT INTO caregiver_notes (id, caregiver_id, senior_id, note) VALUES (?, ?, ?, ?)').run(
      id,
      req.user!.id,
      parsed.data.seniorId,
      parsed.data.note.trim()
    );

    const note = db.prepare('SELECT * FROM caregiver_notes WHERE id = ?').get(id);
    res.status(201).json({ ok: true, note });
  });

  // --- FEEDBACK ---
  router.get('/feedback', (req: AuthedRequest, res) => {
    const items = db
      .prepare('SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
      .all(req.user!.id);
    res.json({ ok: true, feedback: items });
  });

  router.post('/feedback', (req: AuthedRequest, res) => {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Please provide a category, rating, and message.', code: 'VALIDATION_ERROR' });
      return;
    }
    const id = `fbk_${crypto.randomUUID()}`;
    db.prepare('INSERT INTO feedback (id, user_id, category, rating, message) VALUES (?, ?, ?, ?, ?)').run(
      id,
      req.user!.id,
      parsed.data.category,
      parsed.data.rating,
      parsed.data.message.trim()
    );
    const item = db.prepare('SELECT * FROM feedback WHERE id = ?').get(id);
    sendAdminNotificationEmail({
      subject: `[Buddy Elder AI] New ${parsed.data.category} feedback (${parsed.data.rating}/5)`,
      text: `Category: ${parsed.data.category}\nRating: ${parsed.data.rating}/5\nFrom user: ${req.user!.email}\nMessage:\n${parsed.data.message.trim()}`,
    }).catch(() => {});
    res.status(201).json({ ok: true, feedback: item });
  });

  // --- ADMINISTRATOR DASHBOARD (Zero unrestricted private user content access) ---
  router.get('/admin/overview', requireRole('admin'), (_req: AuthedRequest, res) => {
    const users = db
      .prepare('SELECT id, email, full_name, role, preferred_language, is_active, created_at FROM users ORDER BY created_at DESC')
      .all();
    const courses = db.prepare('SELECT id, slug, title, category, difficulty, estimated_minutes, is_published FROM courses ORDER BY sort_order ASC').all();
    const research = db.prepare('SELECT id, title, authors, topic, published_year, source_url FROM research_documents ORDER BY published_year DESC').all();
    const feedback = db
      .prepare(
        `SELECT f.*, u.full_name, u.role as user_role
         FROM feedback f JOIN users u ON u.id = f.user_id
         ORDER BY f.created_at DESC LIMIT 50`
      )
      .all();
    const auditLogs = db
      .prepare('SELECT id, actor_id, action, target_type, target_id, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 60')
      .all();

    const stats = {
      totalUsers: (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c,
      seniors: (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'senior'").get() as { c: number }).c,
      caregivers: (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'caregiver'").get() as { c: number }).c,
      totalScamChecks: (db.prepare('SELECT COUNT(*) as c FROM scam_detection_records').get() as { c: number }).c,
      totalCourses: courses.length,
      totalResearchPapers: research.length,
      totalConsentGrants: (db.prepare("SELECT COUNT(*) as c FROM consent_records WHERE status = 'approved'").get() as { c: number }).c,
    };

    res.json({
      ok: true,
      privacyNotice:
        'Administrator view excludes private senior chat conversations, private wellness journal notes, and personal emergency medical notes.',
      systemHealth: {
        database: 'healthy',
        geminiConfigured: isGeminiConfigured(),
        uptimeSeconds: Math.round(process.uptime()),
      },
      stats,
      users,
      courses,
      research,
      feedback,
      auditLogs,
    });
  });

  router.patch('/admin/users/:id', requireRole('admin'), (req: AuthedRequest, res) => {
    const parsed = adminUserUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid user update.', code: 'VALIDATION_ERROR' });
      return;
    }
    const existing = db.prepare('SELECT id, role, is_active FROM users WHERE id = ?').get(req.params.id) as
      | { id: string; role: string; is_active: number }
      | undefined;
    if (!existing) {
      res.status(404).json({ ok: false, error: 'User not found.', code: 'NOT_FOUND' });
      return;
    }
    const nextRole = parsed.data.role ?? existing.role;
    const nextActive = parsed.data.isActive === undefined ? existing.is_active : parsed.data.isActive ? 1 : 0;
    db.prepare('UPDATE users SET role = ?, is_active = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
      nextRole,
      nextActive,
      req.params.id
    );
    logAudit(db, {
      actorId: req.user!.id,
      action: 'ADMIN_USER_UPDATED',
      targetType: 'user',
      targetId: req.params.id,
      metadata: { role: nextRole, isActive: Boolean(nextActive) },
      ipAddress: req.ip,
    });
    res.json({ ok: true });
  });

  router.post('/admin/courses', requireRole('admin'), (req: AuthedRequest, res) => {
    const parsed = adminCourseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid course fields.', code: 'VALIDATION_ERROR' });
      return;
    }
    const id = `course_${crypto.randomUUID().slice(0, 8)}`;
    const slug = `${parsed.data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${id.slice(-4)}`;
    db.prepare(
      `INSERT INTO courses (id, slug, title, category, difficulty, description, estimated_minutes, sort_order, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, 99, 1)`
    ).run(id, slug, parsed.data.title, parsed.data.category, parsed.data.difficulty, parsed.data.description, parsed.data.estimatedMinutes);

    logAudit(db, {
      actorId: req.user!.id,
      action: 'ADMIN_COURSE_CREATED',
      targetType: 'course',
      targetId: id,
      ipAddress: req.ip,
    });

    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(id);
    res.status(201).json({ ok: true, course });
  });

  router.post('/admin/research', requireRole('admin'), (req: AuthedRequest, res) => {
    const parsed = adminResearchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid research paper fields.', code: 'VALIDATION_ERROR' });
      return;
    }
    const id = `paper_${crypto.randomUUID().slice(0, 8)}`;
    const d = parsed.data;
    db.prepare(
      `INSERT INTO research_documents (id, title, authors, topic, published_year, source_url, summary, content_excerpt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, d.title, d.authors, d.topic, d.publishedYear, d.sourceUrl, d.summary, d.contentExcerpt);

    indexDocumentChunks(db, id, `${d.summary}\n\n${d.contentExcerpt}`);

    logAudit(db, {
      actorId: req.user!.id,
      action: 'ADMIN_RESEARCH_ADDED',
      targetType: 'research_document',
      targetId: id,
      ipAddress: req.ip,
    });

    const doc = db.prepare('SELECT * FROM research_documents WHERE id = ?').get(id);
    res.status(201).json({ ok: true, document: doc });
  });

  router.patch('/admin/feedback/:id', requireRole('admin'), (req: AuthedRequest, res) => {
    const parsed = adminFeedbackUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid feedback update.', code: 'VALIDATION_ERROR' });
      return;
    }
    const result = db
      .prepare('UPDATE feedback SET status = ?, admin_reply = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(parsed.data.status, parsed.data.adminReply, req.params.id);
    if (result.changes === 0) {
      res.status(404).json({ ok: false, error: 'Feedback not found.', code: 'NOT_FOUND' });
      return;
    }
    res.json({ ok: true });
  });

  // --- ENCRYPTED BACKUP & RESTORE ---
  router.get('/backup/history', (req: AuthedRequest, res) => {
    const history = db
      .prepare('SELECT * FROM backup_metadata WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
      .all(req.user!.id);
    const prefs = db
      .prepare('SELECT backup_consent FROM user_preferences WHERE user_id = ?')
      .get(req.user!.id) as { backup_consent: number } | undefined;
    res.json({ ok: true, history, backupConsent: Boolean(prefs?.backup_consent) });
  });

  router.post('/backup/export', (req: AuthedRequest, res) => {
    const prefs = db
      .prepare('SELECT backup_consent FROM user_preferences WHERE user_id = ?')
      .get(req.user!.id) as { backup_consent: number } | undefined;
    if (!prefs?.backup_consent && !req.body?.explicitConsent) {
      res.status(403).json({
        ok: false,
        error: 'Please grant explicit backup consent before exporting your personal data.',
        code: 'BACKUP_CONSENT_REQUIRED',
      });
      return;
    }
    if (req.body?.explicitConsent) {
      db.prepare('UPDATE user_preferences SET backup_consent = 1, updated_at = datetime(\'now\') WHERE user_id = ?').run(
        req.user!.id
      );
    }

    const { envelope, recordCount } = exportUserBackup(db, req.user!.id);
    logAudit(db, {
      actorId: req.user!.id,
      action: 'BACKUP_EXPORTED',
      targetType: 'backup',
      metadata: { recordCount, algorithm: 'AES-256-GCM' },
      ipAddress: req.ip,
    });
    res.json({ ok: true, envelope, recordCount });
  });

  router.post('/backup/restore', (req: AuthedRequest, res) => {
    try {
      const envelope = req.body?.envelope as EncryptedBackupEnvelope;
      const result = restoreUserBackup(db, req.user!.id, envelope);
      logAudit(db, {
        actorId: req.user!.id,
        action: 'BACKUP_RESTORED',
        targetType: 'backup',
        metadata: result,
        ipAddress: req.ip,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Backup restore failed.',
        code: 'RESTORE_FAILED',
      });
    }
  });

  return router;
}
