import crypto from 'crypto';
import type Database from 'better-sqlite3';
import { getEnvConfig } from '../config/env.ts';

export interface EncryptedBackupEnvelope {
  version: 1;
  algorithm: 'AES-256-GCM';
  salt: string;
  iv: string;
  authTag: string;
  ciphertext: string;
  checksumSha256: string;
  exportedAt: string;
}

export interface BackupPayload {
  exportedAt: string;
  userId: string;
  profile: Record<string, unknown> | undefined;
  preferences: Record<string, unknown> | undefined;
  wellnessCheckins: Record<string, unknown>[];
  reminders: Record<string, unknown>[];
  trustedContacts: Record<string, unknown>[];
  consentRecords: Record<string, unknown>[];
  conversations: Record<string, unknown>[];
  messages: Record<string, unknown>[];
}

function deriveKey(salt: Buffer): Buffer {
  const { backupEncryptionSecret } = getEnvConfig();
  return crypto.scryptSync(backupEncryptionSecret, salt, 32);
}

export function encryptBackupData(payload: BackupPayload): EncryptedBackupEnvelope {
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(salt);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const checksumSha256 = crypto.createHash('sha256').update(plaintext).digest('hex');

  return {
    version: 1,
    algorithm: 'AES-256-GCM',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    checksumSha256,
    exportedAt: payload.exportedAt,
  };
}

export function decryptBackupData(envelope: EncryptedBackupEnvelope): BackupPayload {
  if (!envelope || envelope.version !== 1 || envelope.algorithm !== 'AES-256-GCM') {
    throw new Error('Unsupported or corrupted backup envelope.');
  }

  const salt = Buffer.from(envelope.salt, 'base64');
  const iv = Buffer.from(envelope.iv, 'base64');
  const authTag = Buffer.from(envelope.authTag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

  if (iv.length !== 12 || authTag.length !== 16 || salt.length < 16) {
    throw new Error('Invalid cryptographic parameters in backup envelope.');
  }

  const key = deriveKey(salt);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const checksum = crypto.createHash('sha256').update(decrypted).digest('hex');
  if (checksum !== envelope.checksumSha256) {
    throw new Error('Backup integrity checksum verification failed.');
  }

  const parsed = JSON.parse(decrypted.toString('utf8')) as BackupPayload;
  if (!parsed || typeof parsed.userId !== 'string') {
    throw new Error('Invalid backup payload structure.');
  }
  return parsed;
}

export function exportUserBackup(db: Database.Database, userId: string): {
  envelope: EncryptedBackupEnvelope;
  recordCount: number;
} {
  const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
  const preferences = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
  const wellnessCheckins = db.prepare('SELECT * FROM wellness_checkins WHERE user_id = ?').all(userId) as Record<string, unknown>[];
  const reminders = db.prepare('SELECT * FROM reminders WHERE user_id = ?').all(userId) as Record<string, unknown>[];
  const trustedContacts = db.prepare('SELECT * FROM trusted_contacts WHERE user_id = ?').all(userId) as Record<string, unknown>[];
  const consentRecords = db.prepare('SELECT * FROM consent_records WHERE senior_id = ?').all(userId) as Record<string, unknown>[];
  const conversations = db.prepare('SELECT * FROM conversations WHERE user_id = ?').all(userId) as Record<string, unknown>[];
  const messages = db.prepare('SELECT * FROM messages WHERE user_id = ?').all(userId) as Record<string, unknown>[];

  const payload: BackupPayload = {
    exportedAt: new Date().toISOString(),
    userId,
    profile,
    preferences,
    wellnessCheckins,
    reminders,
    trustedContacts,
    consentRecords,
    conversations,
    messages,
  };

  const recordCount =
    wellnessCheckins.length +
    reminders.length +
    trustedContacts.length +
    consentRecords.length +
    conversations.length +
    messages.length;

  const envelope = encryptBackupData(payload);
  db.prepare(
    `INSERT INTO backup_metadata (id, user_id, filename, cipher_alg, checksum_sha256, record_count)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    `bak_${crypto.randomUUID()}`,
    userId,
    `buddy-elder-backup-${new Date().toISOString().slice(0, 10)}.enc.json`,
    'AES-256-GCM',
    envelope.checksumSha256,
    recordCount
  );

  return { envelope, recordCount };
}

export function restoreUserBackup(
  db: Database.Database,
  userId: string,
  envelope: EncryptedBackupEnvelope
): { restoredCount: number } {
  const payload = decryptBackupData(envelope);
  if (payload.userId !== userId) {
    throw new Error('Backup ownership mismatch: you can only restore backups belonging to your account.');
  }

  let restoredCount = 0;
  const tx = db.transaction(() => {
    for (const r of payload.reminders || []) {
      db.prepare(
        `INSERT OR IGNORE INTO reminders (id, user_id, title, category, schedule_time, recurring, timezone, completed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        String(r.id),
        userId,
        String(r.title),
        String(r.category || 'custom'),
        String(r.schedule_time || '09:00'),
        String(r.recurring || 'none'),
        String(r.timezone || 'Asia/Kolkata'),
        Number(r.completed ? 1 : 0),
        String(r.created_at || new Date().toISOString()),
        String(r.updated_at || new Date().toISOString())
      );
      restoredCount += 1;
    }

    for (const c of payload.trustedContacts || []) {
      db.prepare(
        `INSERT OR IGNORE INTO trusted_contacts (id, user_id, name, phone, relationship, is_emergency, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        String(c.id),
        userId,
        String(c.name),
        String(c.phone),
        String(c.relationship || 'Family'),
        Number(c.is_emergency ? 1 : 0),
        String(c.notes || ''),
        String(c.created_at || new Date().toISOString())
      );
      restoredCount += 1;
    }

    for (const w of payload.wellnessCheckins || []) {
      db.prepare(
        `INSERT OR IGNORE INTO wellness_checkins (id, user_id, mood, energy_level, sleep_hours, water_glasses, activity_done, notes, sharing_level, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        String(w.id),
        userId,
        String(w.mood || 'good'),
        Number(w.energy_level || 7),
        Number(w.sleep_hours || 7),
        Number(w.water_glasses || 4),
        String(w.activity_done || ''),
        String(w.notes || ''),
        String(w.sharing_level || 'PRIVATE'),
        String(w.created_at || new Date().toISOString())
      );
      restoredCount += 1;
    }
  });
  tx();

  return { restoredCount };
}
