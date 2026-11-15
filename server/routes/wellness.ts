import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { createAuthMiddleware, type AuthedRequest } from '../middleware/auth.ts';

const checkinSchema = z.object({
  mood: z.enum(['great', 'good', 'okay', 'low', 'stressed']),
  energyLevel: z.number().int().min(1).max(10),
  sleepHours: z.number().min(0).max(24),
  waterGlasses: z.number().int().min(0).max(30),
  activityDone: z.string().max(200).default(''),
  notes: z.string().max(500).default(''),
  sharingLevel: z.enum(['PRIVATE', 'LIMITED', 'AUTHORIZED']).default('PRIVATE'),
});

const privacySchema = z.object({
  sharingLevel: z.enum(['PRIVATE', 'LIMITED', 'AUTHORIZED']),
});

export function createWellnessRouter(db: Database.Database) {
  const router = Router();
  const requireAuth = createAuthMiddleware(db);
  router.use(requireAuth);

  router.get('/checkins', (req: AuthedRequest, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const total = (
      db.prepare('SELECT COUNT(*) as c FROM wellness_checkins WHERE user_id = ?').get(req.user!.id) as { c: number }
    ).c;

    const checkins = db
      .prepare('SELECT * FROM wellness_checkins WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(req.user!.id, limit, offset) as {
      id: string;
      mood: string;
      energy_level: number;
      sleep_hours: number;
      water_glasses: number;
      activity_done: string;
      notes: string;
      sharing_level: string;
      created_at: string;
    }[];

    const last7 = db
      .prepare('SELECT mood, energy_level, sleep_hours, water_glasses FROM wellness_checkins WHERE user_id = ? ORDER BY created_at DESC LIMIT 7')
      .all(req.user!.id) as { energy_level: number; sleep_hours: number; water_glasses: number }[];
    const avgSleep =
      last7.length > 0 ? Number((last7.reduce((s, r) => s + r.sleep_hours, 0) / last7.length).toFixed(1)) : 0;
    const avgWater =
      last7.length > 0 ? Number((last7.reduce((s, r) => s + r.water_glasses, 0) / last7.length).toFixed(1)) : 0;
    const avgEnergy =
      last7.length > 0 ? Number((last7.reduce((s, r) => s + r.energy_level, 0) / last7.length).toFixed(1)) : 0;

    res.json({
      ok: true,
      checkins,
      pagination: { total, limit, offset },
      weeklySummary: {
        entriesCount: last7.length,
        avgSleep,
        avgWater,
        avgEnergy,
        disclaimer: 'Wellness tracking is for personal daily reflection only and is not a medical diagnosis.',
      },
    });
  });

  router.post('/checkins', (req: AuthedRequest, res) => {
    const parsed = checkinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid wellness check-in details.', code: 'VALIDATION_ERROR' });
      return;
    }
    const id = `wel_${crypto.randomUUID()}`;
    const d = parsed.data;
    db.prepare(
      `INSERT INTO wellness_checkins (id, user_id, mood, energy_level, sleep_hours, water_glasses, activity_done, notes, sharing_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.user!.id, d.mood, d.energyLevel, d.sleepHours, d.waterGlasses, d.activityDone, d.notes, d.sharingLevel);

    const checkin = db.prepare('SELECT * FROM wellness_checkins WHERE id = ?').get(id);
    res.status(201).json({ ok: true, checkin });
  });

  router.patch('/checkins/:id/privacy', (req: AuthedRequest, res) => {
    const parsed = privacySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid sharing level.', code: 'VALIDATION_ERROR' });
      return;
    }
    const result = db
      .prepare('UPDATE wellness_checkins SET sharing_level = ? WHERE id = ? AND user_id = ?')
      .run(parsed.data.sharingLevel, req.params.id, req.user!.id);
    if (result.changes === 0) {
      res.status(404).json({ ok: false, error: 'Check-in not found.', code: 'NOT_FOUND' });
      return;
    }
    res.json({ ok: true });
  });

  router.delete('/checkins/:id', (req: AuthedRequest, res) => {
    const result = db
      .prepare('DELETE FROM wellness_checkins WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);
    if (result.changes === 0) {
      res.status(404).json({ ok: false, error: 'Check-in not found.', code: 'NOT_FOUND' });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}
