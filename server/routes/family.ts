import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { createAuthMiddleware, type AuthedRequest } from '../middleware/auth.ts';
import { logAudit } from '../services/audit.ts';

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(5).max(30),
  relationship: z.string().min(2).max(60),
  isEmergency: z.boolean().default(true),
  notes: z.string().max(240).default(''),
});

const inviteSchema = z.object({
  inviteeEmail: z.string().email().max(200),
  relationship: z.string().min(2).max(60).default('Family Member'),
  proposedSharingLevel: z.enum(['PRIVATE', 'LIMITED', 'AUTHORIZED']).default('LIMITED'),
});

const respondInviteSchema = z.object({
  decision: z.enum(['accept', 'reject']),
});

const consentCreateSchema = z.object({
  granteeEmail: z.string().email().max(200),
  moduleName: z.enum(['wellness', 'reminders', 'academy', 'emergency', 'family_notes']),
  actionDescription: z.string().min(4).max(300),
  sharingLevel: z.enum(['PRIVATE', 'LIMITED', 'AUTHORIZED']),
});

const consentDecisionSchema = z.object({
  status: z.enum(['approved', 'rejected', 'revoked']),
  sharingLevel: z.enum(['PRIVATE', 'LIMITED', 'AUTHORIZED']).optional(),
});

export function createFamilyAndAutonomyRouter(db: Database.Database) {
  const router = Router();
  const requireAuth = createAuthMiddleware(db);
  router.use(requireAuth);

  // --- FAMILY HUB ---
  router.get('/family/overview', (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    const email = req.user!.email;

    const contacts = db
      .prepare('SELECT * FROM trusted_contacts WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId);

    const connections = db
      .prepare(
        `SELECT cc.*, u_s.full_name as senior_name, u_s.email as senior_email,
                u_c.full_name as caregiver_name, u_c.email as caregiver_email
         FROM caregiver_connections cc
         JOIN users u_s ON u_s.id = cc.senior_id
         JOIN users u_c ON u_c.id = cc.caregiver_id
         WHERE (cc.senior_id = ? OR cc.caregiver_id = ?) AND cc.status = 'active'
         ORDER BY cc.updated_at DESC`
      )
      .all(userId, userId);

    const sentInvitations = db
      .prepare('SELECT * FROM invitations WHERE senior_id = ? ORDER BY created_at DESC')
      .all(userId);

    const receivedInvitations = db
      .prepare(
        `SELECT i.*, u.full_name as senior_name, u.email as senior_email
         FROM invitations i
         JOIN users u ON u.id = i.senior_id
         WHERE LOWER(i.invitee_email) = LOWER(?) AND i.status = 'pending'
         ORDER BY i.created_at DESC`
      )
      .all(email);

    res.json({ ok: true, contacts, connections, sentInvitations, receivedInvitations });
  });

  router.post('/family/contacts', (req: AuthedRequest, res) => {
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid contact details.', code: 'VALIDATION_ERROR' });
      return;
    }
    const id = `ctc_${crypto.randomUUID()}`;
    const d = parsed.data;
    db.prepare(
      `INSERT INTO trusted_contacts (id, user_id, name, phone, relationship, is_emergency, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.user!.id, d.name.trim(), d.phone.trim(), d.relationship.trim(), d.isEmergency ? 1 : 0, d.notes);
    const contact = db.prepare('SELECT * FROM trusted_contacts WHERE id = ?').get(id);
    res.status(201).json({ ok: true, contact });
  });

  router.delete('/family/contacts/:id', (req: AuthedRequest, res) => {
    const result = db
      .prepare('DELETE FROM trusted_contacts WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);
    if (result.changes === 0) {
      res.status(404).json({ ok: false, error: 'Contact not found.', code: 'NOT_FOUND' });
      return;
    }
    res.json({ ok: true });
  });

  router.post('/family/invite', (req: AuthedRequest, res) => {
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Please provide a valid caregiver email.', code: 'VALIDATION_ERROR' });
      return;
    }
    const inviteeEmail = parsed.data.inviteeEmail.trim().toLowerCase();
    if (inviteeEmail === req.user!.email.toLowerCase()) {
      res.status(400).json({ ok: false, error: 'You cannot invite yourself.', code: 'SELF_INVITE' });
      return;
    }
    const id = `inv_${crypto.randomUUID()}`;
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(
      `INSERT INTO invitations (id, senior_id, invitee_email, relationship, proposed_sharing_level, token, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).run(
      id,
      req.user!.id,
      inviteeEmail,
      parsed.data.relationship.trim(),
      parsed.data.proposedSharingLevel,
      token,
      expiresAt
    );

    logAudit(db, {
      actorId: req.user!.id,
      action: 'CAREGIVER_INVITATION_SENT',
      targetType: 'invitation',
      targetId: id,
      metadata: { inviteeEmail, sharingLevel: parsed.data.proposedSharingLevel },
      ipAddress: req.ip,
    });

    const invitation = db.prepare('SELECT * FROM invitations WHERE id = ?').get(id);
    res.status(201).json({ ok: true, invitation });
  });

  router.post('/family/invitations/:id/respond', (req: AuthedRequest, res) => {
    const parsed = respondInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid invitation decision.', code: 'VALIDATION_ERROR' });
      return;
    }

    const invite = db
      .prepare('SELECT * FROM invitations WHERE id = ? AND LOWER(invitee_email) = LOWER(?) AND status = \'pending\'')
      .get(req.params.id, req.user!.email) as
      | {
          id: string;
          senior_id: string;
          relationship: string;
          proposed_sharing_level: 'PRIVATE' | 'LIMITED' | 'AUTHORIZED';
        }
      | undefined;

    if (!invite) {
      res.status(404).json({ ok: false, error: 'Pending invitation not found for your email.', code: 'NOT_FOUND' });
      return;
    }

    const tx = db.transaction(() => {
      const nextStatus = parsed.data.decision === 'accept' ? 'accepted' : 'rejected';
      db.prepare('UPDATE invitations SET status = ?, responded_at = datetime(\'now\') WHERE id = ?').run(
        nextStatus,
        invite.id
      );

      if (parsed.data.decision === 'accept') {
        db.prepare(
          `INSERT INTO caregiver_connections (id, senior_id, caregiver_id, relationship, sharing_level, status)
           VALUES (?, ?, ?, ?, ?, 'active')
           ON CONFLICT(senior_id, caregiver_id) DO UPDATE SET status = 'active', sharing_level = excluded.sharing_level, updated_at = datetime('now')`
        ).run(
          `conn_${crypto.randomUUID()}`,
          invite.senior_id,
          req.user!.id,
          invite.relationship,
          invite.proposed_sharing_level
        );

        db.prepare(
          `INSERT INTO consent_records (id, senior_id, grantee_id, grantee_email, module_name, action_description, sharing_level, status, granted_at)
           VALUES (?, ?, ?, ?, 'wellness', ?, ?, 'approved', datetime('now'))`
        ).run(
          `con_${crypto.randomUUID()}`,
          invite.senior_id,
          req.user!.id,
          req.user!.email,
          `Caregiver connection accepted (${invite.relationship})`,
          invite.proposed_sharing_level
        );
      }
    });
    tx();

    logAudit(db, {
      actorId: req.user!.id,
      action: parsed.data.decision === 'accept' ? 'INVITATION_ACCEPTED' : 'INVITATION_REJECTED',
      targetType: 'invitation',
      targetId: invite.id,
      ipAddress: req.ip,
    });

    res.json({ ok: true, status: parsed.data.decision === 'accept' ? 'accepted' : 'rejected' });
  });

  router.delete('/family/connections/:id', (req: AuthedRequest, res) => {
    const conn = db
      .prepare('SELECT * FROM caregiver_connections WHERE id = ? AND (senior_id = ? OR caregiver_id = ?)')
      .get(req.params.id, req.user!.id, req.user!.id) as { id: string; senior_id: string; caregiver_id: string } | undefined;

    if (!conn) {
      res.status(404).json({ ok: false, error: 'Connection not found.', code: 'NOT_FOUND' });
      return;
    }

    const tx = db.transaction(() => {
      db.prepare('UPDATE caregiver_connections SET status = \'revoked\', updated_at = datetime(\'now\') WHERE id = ?').run(
        conn.id
      );
      db.prepare(
        `UPDATE consent_records SET status = 'revoked', revoked_at = datetime('now')
         WHERE senior_id = ? AND grantee_id = ? AND status = 'approved'`
      ).run(conn.senior_id, conn.caregiver_id);
    });
    tx();

    logAudit(db, {
      actorId: req.user!.id,
      action: 'CAREGIVER_CONNECTION_REVOKED',
      targetType: 'caregiver_connection',
      targetId: conn.id,
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  });

  // --- AUTONOMY ENGINE ---
  router.get('/autonomy/consents', (req: AuthedRequest, res) => {
    const consents = db
      .prepare('SELECT * FROM consent_records WHERE senior_id = ? ORDER BY created_at DESC')
      .all(req.user!.id);
    const privacyHistory = db
      .prepare(
        `SELECT * FROM audit_logs
         WHERE actor_id = ? AND action IN ('CONSENT_GRANTED', 'CONSENT_REVOKED', 'CONSENT_REJECTED', 'CAREGIVER_CONNECTION_REVOKED', 'CAREGIVER_INVITATION_SENT', 'SOS_CONFIRMED')
         ORDER BY created_at DESC LIMIT 30`
      )
      .all(req.user!.id);
    res.json({ ok: true, consents, privacyHistory });
  });

  router.post('/autonomy/consents', (req: AuthedRequest, res) => {
    const parsed = consentCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid consent configuration.', code: 'VALIDATION_ERROR' });
      return;
    }
    const d = parsed.data;
    const grantee = db
      .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)')
      .get(d.granteeEmail.trim()) as { id: string } | undefined;

    const id = `con_${crypto.randomUUID()}`;
    const isAutoApproved = d.sharingLevel !== 'PRIVATE';
    db.prepare(
      `INSERT INTO consent_records (id, senior_id, grantee_id, grantee_email, module_name, action_description, sharing_level, status, granted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.user!.id,
      grantee?.id || null,
      d.granteeEmail.trim().toLowerCase(),
      d.moduleName,
      d.actionDescription.trim(),
      d.sharingLevel,
      isAutoApproved ? 'approved' : 'pending',
      isAutoApproved ? new Date().toISOString() : null
    );

    if (grantee) {
      db.prepare(
        `UPDATE caregiver_connections SET sharing_level = ?, updated_at = datetime('now')
         WHERE senior_id = ? AND caregiver_id = ? AND status = 'active'`
      ).run(d.sharingLevel, req.user!.id, grantee.id);
    }

    logAudit(db, {
      actorId: req.user!.id,
      action: isAutoApproved ? 'CONSENT_GRANTED' : 'CONSENT_REQUESTED',
      targetType: 'consent_record',
      targetId: id,
      metadata: { moduleName: d.moduleName, sharingLevel: d.sharingLevel },
      ipAddress: req.ip,
    });

    const record = db.prepare('SELECT * FROM consent_records WHERE id = ?').get(id);
    res.status(201).json({ ok: true, consent: record });
  });

  router.patch('/autonomy/consents/:id', (req: AuthedRequest, res) => {
    const parsed = consentDecisionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid consent decision.', code: 'VALIDATION_ERROR' });
      return;
    }

    const existing = db
      .prepare('SELECT * FROM consent_records WHERE id = ? AND senior_id = ?')
      .get(req.params.id, req.user!.id) as { id: string; grantee_id: string | null; sharing_level: string } | undefined;

    if (!existing) {
      res.status(404).json({ ok: false, error: 'Consent record not found.', code: 'NOT_FOUND' });
      return;
    }

    const nextSharing = parsed.data.status === 'revoked' || parsed.data.status === 'rejected'
      ? 'PRIVATE'
      : parsed.data.sharingLevel || existing.sharing_level;

    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE consent_records
         SET status = ?, sharing_level = ?,
             granted_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE granted_at END,
             revoked_at = CASE WHEN ? IN ('revoked', 'rejected') THEN datetime('now') ELSE revoked_at END
         WHERE id = ?`
      ).run(parsed.data.status, nextSharing, parsed.data.status, parsed.data.status, existing.id);

      if (existing.grantee_id) {
        db.prepare(
          `UPDATE caregiver_connections SET sharing_level = ?, updated_at = datetime('now')
           WHERE senior_id = ? AND caregiver_id = ?`
        ).run(nextSharing, req.user!.id, existing.grantee_id);
      }
    });
    tx();

    logAudit(db, {
      actorId: req.user!.id,
      action:
        parsed.data.status === 'approved'
          ? 'CONSENT_GRANTED'
          : parsed.data.status === 'revoked'
          ? 'CONSENT_REVOKED'
          : 'CONSENT_REJECTED',
      targetType: 'consent_record',
      targetId: existing.id,
      ipAddress: req.ip,
    });

    const record = db.prepare('SELECT * FROM consent_records WHERE id = ?').get(existing.id);
    res.json({ ok: true, consent: record });
  });

  return router;
}
