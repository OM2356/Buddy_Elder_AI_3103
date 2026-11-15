import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { createAuthMiddleware, type AuthedRequest } from '../middleware/auth.ts';
import { logAudit } from '../services/audit.ts';

const reminderSchema = z.object({
  title: z.string().min(1).max(160),
  category: z.enum(['medication', 'water', 'exercise', 'appointment', 'learning', 'family', 'custom']),
  scheduleTime: z.string().min(1).max(40),
  recurring: z.enum(['none', 'daily', 'weekly']).default('daily'),
  timezone: z.string().min(1).max(64).default('Asia/Kolkata'),
});

const reminderUpdateSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  category: z.enum(['medication', 'water', 'exercise', 'appointment', 'learning', 'family', 'custom']).optional(),
  scheduleTime: z.string().min(1).max(40).optional(),
  recurring: z.enum(['none', 'daily', 'weekly']).optional(),
  timezone: z.string().min(1).max(64).optional(),
  completed: z.boolean().optional(),
});

const emergencyProfileSchema = z.object({
  phone: z.string().max(40).default(''),
  city: z.string().max(100).default(''),
  bloodGroup: z.string().max(16).default(''),
  allergies: z.string().max(240).default(''),
  medicalConditions: z.string().max(300).default(''),
  emergencyNotes: z.string().max(500).default(''),
});

const sosLogSchema = z.object({
  confirmedDoubleCheck: z.literal(true),
  shareLocationPermitted: z.boolean(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  selectedService: z.enum(['112', '108', '1930', 'trusted_contact']),
});

export function createRemindersAndEmergencyRouter(db: Database.Database) {
  const router = Router();
  const requireAuth = createAuthMiddleware(db);
  router.use(requireAuth);

  function syncDueNotifications(userId: string) {
    const activeReminders = db
      .prepare('SELECT id, title, category, schedule_time, timezone FROM reminders WHERE user_id = ? AND completed = 0')
      .all(userId) as { id: string; title: string; category: string; schedule_time: string; timezone: string }[];

    const now = new Date();
    const todayPrefix = now.toISOString().slice(0, 10);

    for (const r of activeReminders) {
      let currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      try {
        currentHHMM = new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: r.timezone || 'Asia/Kolkata',
        }).format(now);
      } catch {
        // Fallback to server clock if timezone string is unrecognized
      }

      if (r.schedule_time <= currentHHMM) {
        const existingToday = db
          .prepare("SELECT id FROM notifications WHERE user_id = ? AND reminder_id = ? AND scheduled_for LIKE ?")
          .get(userId, r.id, `${todayPrefix}%`);

        if (!existingToday) {
          db.prepare(
            `INSERT INTO notifications (id, user_id, reminder_id, title, body, delivery_channel, status, scheduled_for)
             VALUES (?, ?, ?, ?, ?, 'in_app', 'pending', ?)`
          ).run(
            `ntf_${crypto.randomUUID().slice(0, 12)}`,
            userId,
            r.id,
            `Due Reminder: ${r.title}`,
            `Scheduled for ${r.schedule_time} (${r.category})`,
            `${todayPrefix} ${r.schedule_time}`
          );
        }
      }
    }
  }

  // --- SMART REMINDERS ---
  router.get('/reminders', (req: AuthedRequest, res) => {
    syncDueNotifications(req.user!.id);
    const reminders = db
      .prepare('SELECT * FROM reminders WHERE user_id = ? ORDER BY completed ASC, schedule_time ASC')
      .all(req.user!.id);
    const notifications = db
      .prepare("SELECT * FROM notifications WHERE user_id = ? AND status != 'dismissed' ORDER BY created_at DESC LIMIT 20")
      .all(req.user!.id);
    res.json({ ok: true, reminders, notifications });
  });

  router.patch('/reminders/notifications/:id/dismiss', (req: AuthedRequest, res) => {
    const result = db
      .prepare("UPDATE notifications SET status = 'dismissed' WHERE id = ? AND user_id = ?")
      .run(req.params.id, req.user!.id);
    if (result.changes === 0) {
      res.status(404).json({ ok: false, error: 'Notification not found.', code: 'NOT_FOUND' });
      return;
    }
    res.json({ ok: true });
  });

  router.post('/reminders', (req: AuthedRequest, res) => {
    const parsed = reminderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Please fill in a valid reminder title and schedule time.', code: 'VALIDATION_ERROR' });
      return;
    }
    const id = `rem_${crypto.randomUUID()}`;
    const d = parsed.data;
    db.prepare(
      `INSERT INTO reminders (id, user_id, title, category, schedule_time, recurring, timezone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.user!.id, d.title.trim(), d.category, d.scheduleTime.trim(), d.recurring, d.timezone);

    const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(id);
    res.status(201).json({ ok: true, reminder });
  });

  router.patch('/reminders/:id', (req: AuthedRequest, res) => {
    const parsed = reminderUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid reminder update.', code: 'VALIDATION_ERROR' });
      return;
    }
    const existing = db
      .prepare('SELECT * FROM reminders WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as Record<string, unknown> | undefined;

    if (!existing) {
      res.status(404).json({ ok: false, error: 'Reminder not found.', code: 'NOT_FOUND' });
      return;
    }

    const d = parsed.data;
    const completedVal = d.completed === undefined ? existing.completed : d.completed ? 1 : 0;
    db.prepare(
      `UPDATE reminders
       SET title = ?, category = ?, schedule_time = ?, recurring = ?, timezone = ?, completed = ?,
           last_completed_at = CASE WHEN ? = 1 THEN datetime('now') ELSE last_completed_at END,
           updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    ).run(
      d.title ?? existing.title,
      d.category ?? existing.category,
      d.scheduleTime ?? existing.schedule_time,
      d.recurring ?? existing.recurring,
      d.timezone ?? existing.timezone,
      completedVal,
      completedVal,
      req.params.id,
      req.user!.id
    );

    const reminder = db.prepare('SELECT * FROM reminders WHERE id = ?').get(req.params.id);
    res.json({ ok: true, reminder });
  });

  router.delete('/reminders/:id', (req: AuthedRequest, res) => {
    const result = db
      .prepare('DELETE FROM reminders WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);
    if (result.changes === 0) {
      res.status(404).json({ ok: false, error: 'Reminder not found.', code: 'NOT_FOUND' });
      return;
    }
    res.json({ ok: true });
  });

  // --- EMERGENCY ASSISTANCE ---
  router.get('/emergency/profile', (req: AuthedRequest, res) => {
    const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user!.id);
    const contacts = db
      .prepare('SELECT * FROM trusted_contacts WHERE user_id = ? ORDER BY is_emergency DESC, created_at DESC')
      .all(req.user!.id);

    res.json({
      ok: true,
      profile,
      contacts,
      verifiedHelplines: [
        { number: '112', name: 'National Emergency Response (India)', description: 'Police, Fire & General Emergency' },
        { number: '108', name: 'Emergency Ambulance Service', description: 'Medical emergency ambulance dispatch (where available)' },
        { number: '1930', name: 'Cyber Financial Fraud Helpline', description: 'Report online banking, UPI, or OTP fraud immediately' },
      ],
    });
  });

  router.put('/emergency/profile', (req: AuthedRequest, res) => {
    const parsed = emergencyProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid emergency medical card fields.', code: 'VALIDATION_ERROR' });
      return;
    }
    const d = parsed.data;
    db.prepare(
      `UPDATE profiles
       SET phone = ?, city = ?, blood_group = ?, allergies = ?, medical_conditions = ?, emergency_notes = ?, updated_at = datetime('now')
       WHERE user_id = ?`
    ).run(d.phone, d.city, d.bloodGroup, d.allergies, d.medicalConditions, d.emergencyNotes, req.user!.id);

    const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user!.id);
    res.json({ ok: true, profile });
  });

  router.post('/emergency/sos-log', (req: AuthedRequest, res) => {
    const parsed = sosLogSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Double confirmation is required before recording an SOS action.',
        code: 'DOUBLE_CONFIRM_REQUIRED',
      });
      return;
    }

    const { shareLocationPermitted, latitude, longitude, selectedService } = parsed.data;
    const coords =
      shareLocationPermitted && typeof latitude === 'number' && typeof longitude === 'number'
        ? { latitude, longitude }
        : null;

    logAudit(db, {
      actorId: req.user!.id,
      action: 'SOS_CONFIRMED',
      targetType: 'emergency',
      targetId: selectedService,
      metadata: {
        selectedService,
        locationShared: Boolean(coords),
        coords,
      },
      ipAddress: req.ip,
    });

    res.json({
      ok: true,
      message: `SOS action confirmed for ${selectedService}. Please use your phone dialer directly; Buddy Elder AI never dials automatically.`,
      coords,
    });
  });

  return router;
}
