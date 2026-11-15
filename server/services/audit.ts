import crypto from 'crypto';
import type Database from 'better-sqlite3';

export function logAudit(
  db: Database.Database,
  params: {
    actorId: string | null;
    action: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
  }
) {
  try {
    db.prepare(
      `INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, metadata_json, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `aud_${crypto.randomUUID()}`,
      params.actorId,
      params.action,
      params.targetType,
      params.targetId || '',
      JSON.stringify(params.metadata || {}),
      params.ipAddress || ''
    );
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
}
