import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import type Database from 'better-sqlite3';
import { getEnvConfig } from './config/env.ts';
import { isGeminiConfigured } from './services/gemini.ts';
import { createAuthRouter } from './routes/auth.ts';
import { createAssistantRouter } from './routes/assistant.ts';
import { createScamRouter } from './routes/scam.ts';
import { createWellnessRouter } from './routes/wellness.ts';
import { createFamilyAndAutonomyRouter } from './routes/family.ts';
import { createAcademyRouter } from './routes/academy.ts';
import { createResearchRouter } from './routes/research.ts';
import { createRemindersAndEmergencyRouter } from './routes/reminders.ts';
import { createRolesAndUtilityRouter } from './routes/roles.ts';

export function createApp(db: Database.Database) {
  const app = express();
  const env = getEnvConfig();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    })
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (env.allowedOrigins.includes(origin) || origin.endsWith('.run.app')) {
          return callback(null, true);
        }
        return callback(new Error('Origin not permitted by CORS policy'));
      },
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // Sensitive-data-redacted request logger
  app.use('/api', (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (process.env.NODE_ENV === 'test') return;
      const safePath = req.originalUrl.replace(/(token|password|idToken|secret)=[^&]+/gi, '$1=[REDACTED]');
      console.info(
        JSON.stringify({
          type: 'http_request',
          method: req.method,
          path: safePath,
          status: res.statusCode,
          durationMs: Date.now() - start,
          hasAuthHeader: Boolean(req.headers.authorization),
        })
      );
    });
    next();
  });

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
    message: { ok: false, error: 'Too many requests. Please pause briefly and try again.', code: 'RATE_LIMITED' },
  });

  app.use('/api', apiLimiter);

  app.get('/api/health', (_req, res) => {
    try {
      const row = db.prepare('SELECT 1 as ok').get() as { ok: number };
      res.json({
        ok: true,
        status: 'healthy',
        database: row?.ok === 1 ? 'connected' : 'error',
        geminiConfigured: isGeminiConfigured(),
        geminiModel: env.geminiModel,
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ ok: false, status: 'unhealthy', code: 'DB_ERROR' });
    }
  });

  const authRouter = createAuthRouter(db);
  app.use('/api/auth', authRouter);
  app.use('/api', authRouter); // Exposes /api/preferences cleanly

  app.use('/api/assistant', createAssistantRouter(db));
  app.use('/api/scam', createScamRouter(db));
  app.use('/api/wellness', createWellnessRouter(db));
  app.use('/api', createFamilyAndAutonomyRouter(db));
  app.use('/api/academy', createAcademyRouter(db));
  app.use('/api/research', createResearchRouter(db));
  app.use('/api', createRemindersAndEmergencyRouter(db));
  app.use('/api', createRolesAndUtilityRouter(db));

  app.use('/api/{*splat}', (_req, res) => {
    res.status(404).json({ ok: false, error: 'API endpoint not found.', code: 'NOT_FOUND' });
  });

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof Error && err.message.includes('CORS')) {
      res.status(403).json({ ok: false, error: err.message, code: 'CORS_FORBIDDEN' });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ ok: false, error: 'Malformed JSON request body.', code: 'INVALID_JSON' });
      return;
    }
    console.error('Unhandled server error:', err);
    res.status(500).json({ ok: false, error: 'An unexpected server error occurred.', code: 'INTERNAL_ERROR' });
  });

  return app;
}
