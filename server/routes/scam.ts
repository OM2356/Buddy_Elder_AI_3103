import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { createAuthMiddleware, type AuthedRequest } from '../middleware/auth.ts';
import { analyzeScamInput } from '../services/scamAnalyzer.ts';
import { logAudit } from '../services/audit.ts';

const analyzeSchema = z.object({
  channel: z.enum(['sms', 'whatsapp', 'email', 'url', 'payment', 'phone']),
  content: z.string().min(3).max(4000),
  includeAiExplanation: z.boolean().optional(),
});

export function createScamRouter(db: Database.Database) {
  const router = Router();
  const requireAuth = createAuthMiddleware(db);
  router.use(requireAuth);

  router.post('/analyze', async (req: AuthedRequest, res) => {
    const parsed = analyzeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Please paste a message, link, or phone number (at least 3 characters).', code: 'VALIDATION_ERROR' });
      return;
    }

    const analysis = await analyzeScamInput({
      channel: parsed.data.channel,
      content: parsed.data.content,
      includeAiExplanation: parsed.data.includeAiExplanation ?? true,
    });

    const recordId = `scm_${crypto.randomUUID()}`;
    db.prepare(
      `INSERT INTO scam_detection_records (id, user_id, channel, content_preview, detected_indicators_json, risk_score, risk_level, safety_guidance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      recordId,
      req.user!.id,
      parsed.data.channel,
      parsed.data.content.slice(0, 240),
      JSON.stringify(analysis.indicators),
      analysis.riskScore,
      analysis.riskLevel,
      analysis.safetyGuidance.join(' ')
    );

    res.json({ ok: true, recordId, ...analysis });
  });

  router.get('/history', (req: AuthedRequest, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const total = (
      db.prepare('SELECT COUNT(*) as c FROM scam_detection_records WHERE user_id = ?').get(req.user!.id) as { c: number }
    ).c;

    const rows = db
      .prepare('SELECT * FROM scam_detection_records WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(req.user!.id, limit, offset) as Record<string, unknown>[];

    const history = rows.map((r) => ({
      ...r,
      indicators: JSON.parse(String(r.detected_indicators_json || '[]')),
    }));

    res.json({ ok: true, history, pagination: { total, limit, offset } });
  });

  router.post('/report/:id', (req: AuthedRequest, res) => {
    const result = db
      .prepare('UPDATE scam_detection_records SET reported_flag = 1 WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);

    if (result.changes === 0) {
      res.status(404).json({ ok: false, error: 'Scam record not found.', code: 'NOT_FOUND' });
      return;
    }

    logAudit(db, {
      actorId: req.user!.id,
      action: 'SCAM_RECORD_FLAGGED_FOR_REPORT',
      targetType: 'scam_detection_record',
      targetId: req.params.id,
      ipAddress: req.ip,
    });

    res.json({
      ok: true,
      guidance: {
        helpline: '1930',
        portal: 'https://cybercrime.gov.in',
        message: 'Marked in your safety log. Please dial 1930 or file your complaint directly at cybercrime.gov.in.',
      },
    });
  });

  return router;
}
