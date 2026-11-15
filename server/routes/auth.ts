import crypto from 'crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type JwtHeader } from 'jsonwebtoken';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { getEnvConfig } from '../config/env.ts';
import {
  clearSessionCookie,
  createAuthMiddleware,
  setSessionCookie,
  signSessionToken,
  type AuthedRequest,
  type UserRole,
} from '../middleware/auth.ts';
import { logAudit } from '../services/audit.ts';
import { isEmailDeliveryConfigured, sendPasswordResetEmail } from '../services/email.ts';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

const registerSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(128),
  fullName: z.string().min(2).max(100),
  role: z.enum(['senior', 'caregiver']).default('senior'),
  preferredLanguage: z.enum(['en', 'hi', 'mr']).default('en'),
  firebaseUid: z.string().min(6).max(128).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(1).max(128),
});

const firebaseAuthSchema = z.object({
  idToken: z.string().min(20).max(8192),
  role: z.enum(['senior', 'caregiver']).optional(),
});

const preferencesSchema = z.object({
  textSize: z.enum(['normal', 'large', 'xlarge']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  preferredLanguage: z.enum(['en', 'hi', 'mr']).optional(),
  speechRate: z.number().min(0.5).max(1.8).optional(),
  speechVolume: z.number().min(0).max(1).optional(),
  voiceLang: z.string().min(2).max(20).optional(),
  notificationsEnabled: z.boolean().optional(),
  backupConsent: z.boolean().optional(),
});

const profileUpdateSchema = z.object({
  fullName: z.string().min(2).max(100),
  preferredLanguage: z.enum(['en', 'hi', 'mr']).optional(),
  phone: z.string().max(40).optional(),
  city: z.string().max(100).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().max(128).optional(),
  newPassword: z.string().min(8).max(128),
});

const forgotPasswordSchema = z.object({
  email: z.string().email().max(200),
});

const resetPasswordSchema = z.object({
  token: z.string().min(16).max(200),
  newPassword: z.string().min(8).max(128),
});

let cachedCerts: { keys: Record<string, string>; expiresAt: number } | null = null;

async function fetchGooglePublicKeys(): Promise<Record<string, string>> {
  if (cachedCerts && Date.now() < cachedCerts.expiresAt) {
    return cachedCerts.keys;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com'
  );
  if (!resp.ok) {
    throw new Error('Unable to fetch Google public keys for Firebase verification.');
  }
  const keys = (await resp.json()) as Record<string, string>;
  cachedCerts = { keys, expiresAt: Date.now() + 3600 * 1000 };
  return keys;
}

async function verifyFirebaseIdToken(idToken: string): Promise<{
  uid: string;
  email: string;
  name: string;
  emailVerified: boolean;
}> {
  const decodedComplete = jwt.decode(idToken, { complete: true }) as
    | { header: JwtHeader; payload: Record<string, unknown> }
    | null;
  if (!decodedComplete?.header?.kid) {
    throw new Error('Malformed Firebase ID token.');
  }
  const keys = await fetchGooglePublicKeys();
  const cert = keys[decodedComplete.header.kid];
  if (!cert) {
    throw new Error('Firebase signing key not recognized.');
  }
  const { firebaseProjectId } = getEnvConfig();
  const projectId = firebaseProjectId || firebaseConfig.projectId;
  const verified = jwt.verify(idToken, cert, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  }) as Record<string, unknown>;

  const uid = String(verified.user_id || verified.sub || '');
  const email = String(verified.email || '').toLowerCase();
  const emailVerified = Boolean(verified.email_verified);
  const name = String(verified.name || email.split('@')[0] || 'Buddy User');

  if (!uid || !email) {
    throw new Error('Firebase account UID and email are required.');
  }
  return { uid, email, name, emailVerified };
}

export function createAuthRouter(db: Database.Database) {
  const router = Router();
  const requireAuth = createAuthMiddleware(db);

  function loadUserBundle(userId: string) {
    const user = db
      .prepare('SELECT id, email, full_name, role, preferred_language, is_active, created_at FROM users WHERE id = ?')
      .get(userId) as
      | {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          preferred_language: 'en' | 'hi' | 'mr';
          is_active: number;
          created_at: string;
        }
      | undefined;

    const preferences = db
      .prepare('SELECT * FROM user_preferences WHERE user_id = ?')
      .get(userId) as Record<string, unknown> | undefined;

    const profile = db
      .prepare('SELECT * FROM profiles WHERE user_id = ?')
      .get(userId) as Record<string, unknown> | undefined;

    return { user, preferences, profile };
  }

  router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'Invalid registration data.', code: 'VALIDATION_ERROR' });
      return;
    }

    const { email, password, fullName, role, preferredLanguage, firebaseUid } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    const { bootstrappedAdminEmail } = getEnvConfig();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      res.status(409).json({ ok: false, error: 'An account with this email already exists.', code: 'EMAIL_EXISTS' });
      return;
    }

    const assignedRole: UserRole =
      normalizedEmail === bootstrappedAdminEmail.toLowerCase() ? 'admin' : role;

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_${crypto.randomUUID()}`;

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO users (id, email, password_hash, full_name, role, firebase_uid, preferred_language)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(userId, normalizedEmail, passwordHash, fullName.trim(), assignedRole, firebaseUid ?? null, preferredLanguage);

      db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(userId);
      db.prepare(
        `INSERT INTO user_preferences (user_id, voice_lang) VALUES (?, ?)`
      ).run(userId, preferredLanguage === 'hi' ? 'hi-IN' : preferredLanguage === 'mr' ? 'mr-IN' : 'en-IN');
    });
    tx();

    const authUser = {
      id: userId,
      email: normalizedEmail,
      fullName: fullName.trim(),
      role: assignedRole,
      preferredLanguage,
    };
    const token = signSessionToken(authUser);
    setSessionCookie(res, token, req);

    logAudit(db, {
      actorId: userId,
      action: 'USER_REGISTERED',
      targetType: 'user',
      targetId: userId,
      metadata: { role: assignedRole },
      ipAddress: req.ip,
    });

    const bundle = loadUserBundle(userId);
    res.status(201).json({ ok: true, token, ...bundle });
  });

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Please enter a valid email and password.', code: 'VALIDATION_ERROR' });
      return;
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const row = db
      .prepare('SELECT id, email, password_hash, full_name, role, preferred_language, is_active FROM users WHERE email = ?')
      .get(normalizedEmail) as
      | {
          id: string;
          email: string;
          password_hash: string | null;
          full_name: string;
          role: UserRole;
          preferred_language: 'en' | 'hi' | 'mr';
          is_active: number;
        }
      | undefined;

    if (!row || !row.password_hash) {
      res.status(401).json({ ok: false, error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
      return;
    }

    if (!row.is_active) {
      res.status(403).json({ ok: false, error: 'This account is currently deactivated.', code: 'ACCOUNT_DISABLED' });
      return;
    }

    const matches = await bcrypt.compare(parsed.data.password, row.password_hash);
    if (!matches) {
      logAudit(db, {
        actorId: row.id,
        action: 'LOGIN_FAILED',
        targetType: 'user',
        targetId: row.id,
        ipAddress: req.ip,
      });
      res.status(401).json({ ok: false, error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
      return;
    }

    const authUser = {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role,
      preferredLanguage: row.preferred_language,
    };
    const token = signSessionToken(authUser);
    setSessionCookie(res, token, req);

    logAudit(db, {
      actorId: row.id,
      action: 'USER_LOGIN',
      targetType: 'user',
      targetId: row.id,
      ipAddress: req.ip,
    });

    const bundle = loadUserBundle(row.id);
    res.json({ ok: true, token, ...bundle });
  });

  router.post('/firebase', async (req, res) => {
    const parsed = firebaseAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid Firebase auth payload.', code: 'VALIDATION_ERROR' });
      return;
    }

    try {
      const fbUser = await verifyFirebaseIdToken(parsed.data.idToken);
      const { bootstrappedAdminEmail } = getEnvConfig();
      const existing = db
        .prepare('SELECT id, email, full_name, role, preferred_language, is_active FROM users WHERE firebase_uid = ? OR email = ?')
        .get(fbUser.uid, fbUser.email) as
        | {
            id: string;
            email: string;
            full_name: string;
            role: UserRole;
            preferred_language: 'en' | 'hi' | 'mr';
            is_active: number;
          }
        | undefined;

      let userId: string;
      let role: UserRole;
      let fullName: string;
      let preferredLanguage: 'en' | 'hi' | 'mr' = 'en';

      if (existing) {
        if (!existing.is_active) {
          res.status(403).json({ ok: false, error: 'Account is deactivated.', code: 'ACCOUNT_DISABLED' });
          return;
        }
        userId = existing.id;
        const canBootstrappedAdmin = fbUser.emailVerified && fbUser.email === bootstrappedAdminEmail.toLowerCase();
        role = canBootstrappedAdmin ? 'admin' : existing.role;
        fullName = existing.full_name;
        preferredLanguage = existing.preferred_language;
        db.prepare('UPDATE users SET firebase_uid = ?, role = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
          fbUser.uid,
          role,
          userId
        );
      } else {
        userId = `usr_${crypto.randomUUID()}`;
        const canBootstrappedAdmin = fbUser.emailVerified && fbUser.email === bootstrappedAdminEmail.toLowerCase();
        role = canBootstrappedAdmin ? 'admin' : parsed.data.role || 'senior';
        fullName = fbUser.name;
        const tx = db.transaction(() => {
          db.prepare(
            `INSERT INTO users (id, email, full_name, role, firebase_uid, preferred_language)
             VALUES (?, ?, ?, ?, ?, 'en')`
          ).run(userId, fbUser.email, fullName, role, fbUser.uid);
          db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(userId);
          db.prepare('INSERT INTO user_preferences (user_id) VALUES (?)').run(userId);
        });
        tx();
      }

      const authUser = {
        id: userId,
        email: fbUser.email,
        fullName,
        role,
        preferredLanguage,
      };
      const token = signSessionToken(authUser);
      setSessionCookie(res, token, req);

      logAudit(db, {
        actorId: userId,
        action: 'FIREBASE_GOOGLE_LOGIN',
        targetType: 'user',
        targetId: userId,
        ipAddress: req.ip,
      });

      const bundle = loadUserBundle(userId);
      res.json({ ok: true, token, ...bundle });
    } catch (err) {
      res.status(401).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Firebase token verification failed.',
        code: 'FIREBASE_AUTH_FAILED',
      });
    }
  });

  router.post('/logout', requireAuth, (req: AuthedRequest, res) => {
    if (req.user) {
      logAudit(db, {
        actorId: req.user.id,
        action: 'USER_LOGOUT',
        targetType: 'user',
        targetId: req.user.id,
        ipAddress: req.ip,
      });
    }
    clearSessionCookie(res, req);
    res.json({ ok: true });
  });

  router.get('/me', requireAuth, (req: AuthedRequest, res) => {
    const bundle = loadUserBundle(req.user!.id);
    res.json({ ok: true, ...bundle });
  });

  router.get('/preferences', requireAuth, (req: AuthedRequest, res) => {
    const preferences = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user!.id);
    res.json({ ok: true, preferences, preferredLanguage: req.user!.preferredLanguage });
  });

  router.patch('/preferences', requireAuth, (req: AuthedRequest, res) => {
    const parsed = preferencesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid preferences update.', code: 'VALIDATION_ERROR' });
      return;
    }

    const d = parsed.data;
    const tx = db.transaction(() => {
      if (d.preferredLanguage) {
        db.prepare('UPDATE users SET preferred_language = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
          d.preferredLanguage,
          req.user!.id
        );
      }

      const current = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(req.user!.id) as Record<
        string,
        unknown
      >;
      db.prepare(
        `UPDATE user_preferences
         SET text_size = ?, theme = ?, speech_rate = ?, speech_volume = ?, voice_lang = ?, notifications_enabled = ?, backup_consent = ?, updated_at = datetime('now')
         WHERE user_id = ?`
      ).run(
        d.textSize ?? current.text_size,
        d.theme ?? current.theme,
        d.speechRate ?? current.speech_rate,
        d.speechVolume ?? current.speech_volume,
        d.voiceLang ?? current.voice_lang,
        d.notificationsEnabled === undefined ? current.notifications_enabled : d.notificationsEnabled ? 1 : 0,
        d.backupConsent === undefined ? current.backup_consent : d.backupConsent ? 1 : 0,
        req.user!.id
      );
    });
    tx();

    const bundle = loadUserBundle(req.user!.id);
    res.json({ ok: true, ...bundle });
  });

  router.put('/profile', requireAuth, (req: AuthedRequest, res) => {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'Invalid profile update.', code: 'VALIDATION_ERROR' });
      return;
    }
    const { fullName, preferredLanguage, phone, city } = parsed.data;
    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE users SET full_name = ?, preferred_language = COALESCE(?, preferred_language), updated_at = datetime('now') WHERE id = ?`
      ).run(fullName.trim(), preferredLanguage ?? null, req.user!.id);

      if (phone !== undefined || city !== undefined) {
        db.prepare(
          `UPDATE profiles SET phone = COALESCE(?, phone), city = COALESCE(?, city), updated_at = datetime('now') WHERE user_id = ?`
        ).run(phone ?? null, city ?? null, req.user!.id);
      }
    });
    tx();

    logAudit(db, {
      actorId: req.user!.id,
      action: 'PROFILE_UPDATED',
      targetType: 'user',
      targetId: req.user!.id,
      ipAddress: req.ip,
    });

    const bundle = loadUserBundle(req.user!.id);
    res.json({ ok: true, ...bundle });
  });

  router.post('/change-password', requireAuth, async (req: AuthedRequest, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: parsed.error.issues[0]?.message || 'New password must be at least 8 characters.', code: 'VALIDATION_ERROR' });
      return;
    }

    const row = db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(req.user!.id) as { password_hash: string | null } | undefined;

    if (!row) {
      res.status(404).json({ ok: false, error: 'Account not found.', code: 'NOT_FOUND' });
      return;
    }

    if (row.password_hash) {
      if (!parsed.data.currentPassword) {
        res.status(400).json({ ok: false, error: 'Please enter your current password.', code: 'CURRENT_PASSWORD_REQUIRED' });
        return;
      }
      const valid = await bcrypt.compare(parsed.data.currentPassword, row.password_hash);
      if (!valid) {
        res.status(401).json({ ok: false, error: 'Current password is incorrect.', code: 'INVALID_CREDENTIALS' });
        return;
      }
    }

    const nextHash = await bcrypt.hash(parsed.data.newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(nextHash, req.user!.id);

    logAudit(db, {
      actorId: req.user!.id,
      action: 'PASSWORD_CHANGED',
      targetType: 'user',
      targetId: req.user!.id,
      ipAddress: req.ip,
    });

    res.json({ ok: true, message: 'Password updated successfully.' });
  });

  router.post('/forgot-password', async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Please enter a valid email address.', code: 'VALIDATION_ERROR' });
      return;
    }

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    const userRow = db
      .prepare('SELECT id, is_active FROM users WHERE email = ?')
      .get(normalizedEmail) as { id: string; is_active: number } | undefined;

    const emailDeliveryConfigured = isEmailDeliveryConfigured();
    const genericMessage = 'If an account matches that email, a password reset code has been generated.';

    if (!userRow || !userRow.is_active) {
      res.json({ ok: true, message: genericMessage, emailDeliveryConfigured, smtpConfigured: emailDeliveryConfigured });
      return;
    }

    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const resetId = `rst_${crypto.randomUUID()}`;

    db.prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
       VALUES (?, ?, ?, datetime('now', '+15 minutes'))`
    ).run(resetId, userRow.id, tokenHash);

    logAudit(db, {
      actorId: userRow.id,
      action: 'PASSWORD_RESET_REQUESTED',
      targetType: 'user',
      targetId: userRow.id,
      ipAddress: req.ip,
    });

    if (emailDeliveryConfigured) {
      const delivery = await sendPasswordResetEmail({ to: normalizedEmail, resetCode: rawToken }).catch(() => ({
        sent: false,
      }));
      if (!delivery.sent) {
        res.status(502).json({
          ok: false,
          error: 'Unable to send reset email right now. Please try again shortly or use Firebase password reset.',
          code: 'EMAIL_DELIVERY_FAILED',
        });
        return;
      }
      res.json({
        ok: true,
        message: 'If an account matches that email, we sent a password reset code to your inbox.',
        emailDeliveryConfigured: true,
        smtpConfigured: true,
      });
      return;
    }

    res.json({
      ok: true,
      message: `${genericMessage} Note: No email delivery service (RESEND_API_KEY) is configured in this environment.`,
      emailDeliveryConfigured: false,
      smtpConfigured: false,
      ...(process.env.NODE_ENV !== 'production' ? { devResetToken: rawToken } : {}),
    });
  });

  router.post('/reset-password', async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Valid reset code and password (8+ chars) are required.', code: 'VALIDATION_ERROR' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(parsed.data.token.trim()).digest('hex');
    const record = db
      .prepare(
        `SELECT id, user_id, expires_at, used_at
         FROM password_reset_tokens
         WHERE token_hash = ?`
      )
      .get(tokenHash) as { id: string; user_id: string; expires_at: string; used_at: string | null } | undefined;

    if (!record || record.used_at) {
      res.status(400).json({ ok: false, error: 'Reset code is invalid or already used.', code: 'INVALID_RESET_TOKEN' });
      return;
    }

    const isUnexpired = db
      .prepare("SELECT 1 as valid FROM password_reset_tokens WHERE id = ? AND expires_at > datetime('now')")
      .get(record.id) as { valid: number } | undefined;

    if (!isUnexpired) {
      res.status(400).json({ ok: false, error: 'Reset code has expired. Please request a new one.', code: 'EXPIRED_RESET_TOKEN' });
      return;
    }

    const nextHash = await bcrypt.hash(parsed.data.newPassword, 10);
    const tx = db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(nextHash, record.user_id);
      db.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?").run(record.id);
    });
    tx();

    logAudit(db, {
      actorId: record.user_id,
      action: 'PASSWORD_RESET_COMPLETED',
      targetType: 'user',
      targetId: record.user_id,
      ipAddress: req.ip,
    });

    res.json({ ok: true, message: 'Password has been reset. You can now sign in with your new password.' });
  });

  return router;
}
