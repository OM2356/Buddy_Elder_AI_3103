import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ephemeralJwtSecret = crypto.randomBytes(48).toString('hex');
const ephemeralBackupSecret = crypto.randomBytes(48).toString('hex');

export function getEnvConfig() {
  const jwtSecret = process.env.JWT_SECRET?.trim() || ephemeralJwtSecret;
  let backupSecret = process.env.BACKUP_ENCRYPTION_SECRET?.trim() || ephemeralBackupSecret;

  if (backupSecret === jwtSecret) {
    // Enforce rule: never reuse JWT_SECRET as the backup encryption key
    backupSecret = crypto.createHash('sha512').update(`backup-domain-sep:${jwtSecret}`).digest('hex');
  }

  const appUrl = process.env.APP_URL?.trim() || 'http://localhost:3000';
  const rawOrigins = process.env.ALLOWED_ORIGINS?.trim() || '';
  const allowedOrigins = Array.from(
    new Set(
      [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        appUrl,
        ...rawOrigins.split(',').map((o) => o.trim()).filter(Boolean),
      ].filter(Boolean)
    )
  );

  const rawModel = process.env.GEMINI_MODEL?.trim() || '';
  const geminiModel = /^gemini-[a-z0-9.-]+$/i.test(rawModel) ? rawModel : 'gemini-4-hydrogen';

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 3000),
    databasePath: process.env.DATABASE_PATH?.trim() || './data/buddy_elder.db',
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || '',
    geminiModel,
    jwtSecret,
    backupEncryptionSecret: backupSecret,
    appUrl,
    allowedOrigins,
    bootstrappedAdminEmail: 'omkarsathe3103@gmail.com',
  };
}
