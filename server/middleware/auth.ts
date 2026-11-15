import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type Database from 'better-sqlite3';
import { getEnvConfig } from '../config/env.ts';

export type UserRole = 'senior' | 'caregiver' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  preferredLanguage: 'en' | 'hi' | 'mr';
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

const COOKIE_NAME = 'buddy_session';

export function signSessionToken(user: AuthUser): string {
  const { jwtSecret } = getEnvConfig();
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    jwtSecret,
    { expiresIn: '7d' }
  );
}

export function setSessionCookie(res: Response, token: string) {
  const { nodeEnv } = getEnvConfig();
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: nodeEnv === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function createAuthMiddleware(db: Database.Database) {
  return function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
    const cookieToken = req.cookies?.[COOKIE_NAME];
    const header = req.headers.authorization;
    const bearerToken = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const token = cookieToken || bearerToken;

    if (!token) {
      res.status(401).json({ ok: false, error: 'Authentication required. Please sign in.', code: 'UNAUTHORIZED' });
      return;
    }

    try {
      const { jwtSecret } = getEnvConfig();
      const payload = jwt.verify(token, jwtSecret) as { sub?: string };
      if (!payload.sub) {
        res.status(401).json({ ok: false, error: 'Invalid session token.', code: 'INVALID_TOKEN' });
        return;
      }

      const row = db
        .prepare('SELECT id, email, full_name, role, preferred_language, is_active FROM users WHERE id = ?')
        .get(payload.sub) as
        | {
            id: string;
            email: string;
            full_name: string;
            role: UserRole;
            preferred_language: 'en' | 'hi' | 'mr';
            is_active: number;
          }
        | undefined;

      if (!row || !row.is_active) {
        res.status(401).json({ ok: false, error: 'Account inactive or not found.', code: 'ACCOUNT_INACTIVE' });
        return;
      }

      req.user = {
        id: row.id,
        email: row.email,
        fullName: row.full_name,
        role: row.role,
        preferredLanguage: row.preferred_language,
      };
      next();
    } catch {
      res.status(401).json({ ok: false, error: 'Your session expired. Please sign in again.', code: 'SESSION_EXPIRED' });
    }
  };
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ ok: false, error: 'Authentication required.', code: 'UNAUTHORIZED' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        ok: false,
        error: `Access denied. Required role: ${roles.join(' or ')}.`,
        code: 'FORBIDDEN',
      });
      return;
    }
    next();
  };
}
