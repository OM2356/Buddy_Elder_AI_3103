import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { createAuthMiddleware, type AuthedRequest } from '../middleware/auth.ts';
import { GeminiServiceError } from '../services/gemini.ts';
import { orchestrator } from '../services/orchestrator.ts';

const createConvSchema = z.object({
  title: z.string().min(1).max(160).default('New Companion Chat'),
  language: z.enum(['en', 'hi', 'mr']).default('en'),
});

const renameConvSchema = z.object({
  title: z.string().min(1).max(160),
});

const chatSchema = z.object({
  conversationId: z.string().min(1).max(128).optional(),
  message: z.string().min(1).max(4000),
  language: z.enum(['en', 'hi', 'mr']).default('en'),
  stream: z.boolean().optional(),
  regenerate: z.boolean().optional(),
});

const transformSchema = z.object({
  text: z.string().min(1).max(8000),
  mode: z.enum(['simplify', 'shorten', 'examples', 'translate_hi', 'translate_mr']),
  conversationId: z.string().optional(),
});

export function createAssistantRouter(db: Database.Database) {
  const router = Router();
  const requireAuth = createAuthMiddleware(db);
  router.use(requireAuth);

  router.get('/conversations', (req: AuthedRequest, res) => {
    const q = String(req.query.q || '').trim();
    const rows = q
      ? db
          .prepare(
            `SELECT * FROM conversations
             WHERE user_id = ? AND title LIKE ?
             ORDER BY updated_at DESC`
          )
          .all(req.user!.id, `%${q}%`)
      : db
          .prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC')
          .all(req.user!.id);
    res.json({ ok: true, conversations: rows });
  });

  router.post('/conversations', (req: AuthedRequest, res) => {
    const parsed = createConvSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid conversation title.', code: 'VALIDATION_ERROR' });
      return;
    }
    const id = `conv_${crypto.randomUUID()}`;
    db.prepare('INSERT INTO conversations (id, user_id, title, language) VALUES (?, ?, ?, ?)').run(
      id,
      req.user!.id,
      parsed.data.title.trim(),
      parsed.data.language
    );
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
    res.status(201).json({ ok: true, conversation });
  });

  router.patch('/conversations/:id', (req: AuthedRequest, res) => {
    const parsed = renameConvSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid title.', code: 'VALIDATION_ERROR' });
      return;
    }
    const result = db
      .prepare('UPDATE conversations SET title = ?, updated_at = datetime(\'now\') WHERE id = ? AND user_id = ?')
      .run(parsed.data.title.trim(), req.params.id, req.user!.id);
    if (result.changes === 0) {
      res.status(404).json({ ok: false, error: 'Conversation not found.', code: 'NOT_FOUND' });
      return;
    }
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
    res.json({ ok: true, conversation });
  });

  router.delete('/conversations/:id', (req: AuthedRequest, res) => {
    const result = db
      .prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);
    if (result.changes === 0) {
      res.status(404).json({ ok: false, error: 'Conversation not found.', code: 'NOT_FOUND' });
      return;
    }
    res.json({ ok: true });
  });

  router.get('/conversations/:id/messages', (req: AuthedRequest, res) => {
    const conv = db
      .prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id);
    if (!conv) {
      res.status(404).json({ ok: false, error: 'Conversation not found.', code: 'NOT_FOUND' });
      return;
    }
    const messages = db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC')
      .all(req.params.id, req.user!.id);
    res.json({ ok: true, conversation: conv, messages });
  });

  router.post('/chat', async (req: AuthedRequest, res) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Please enter a valid message.', code: 'VALIDATION_ERROR' });
      return;
    }

    let conversationId = parsed.data.conversationId;
    if (!conversationId) {
      conversationId = `conv_${crypto.randomUUID()}`;
      const autoTitle = parsed.data.message.trim().slice(0, 48) || 'Buddy Conversation';
      db.prepare('INSERT INTO conversations (id, user_id, title, language) VALUES (?, ?, ?, ?)').run(
        conversationId,
        req.user!.id,
        autoTitle,
        parsed.data.language
      );
    } else {
      const conv = db
        .prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
        .get(conversationId, req.user!.id);
      if (!conv) {
        res.status(404).json({ ok: false, error: 'Conversation not found.', code: 'NOT_FOUND' });
        return;
      }
    }

    const ctx = {
      db,
      userId: req.user!.id,
      userRole: req.user!.role,
      userName: req.user!.fullName,
      language: parsed.data.language,
      conversationId,
    };

    if (parsed.data.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const userMsgId = `msg_${crypto.randomUUID()}`;
      if (!parsed.data.regenerate) {
        db.prepare(
          'INSERT INTO messages (id, conversation_id, user_id, role, content) VALUES (?, ?, ?, \'user\', ?)'
        ).run(userMsgId, conversationId, req.user!.id, parsed.data.message.trim());
      }

      let fullReply = '';
      let capability = 'general_conversation';
      let verificationNote = '';

      try {
        for await (const event of orchestrator.streamRespond(ctx, parsed.data.message.trim())) {
          capability = event.capability;
          if (event.chunk) {
            fullReply += event.chunk;
            res.write(`data: ${JSON.stringify({ type: 'chunk', text: event.chunk, conversationId, capability })}\n\n`);
          }
          if (event.done) {
            verificationNote = event.verificationNote || '';
          }
        }

        const assistantMsgId = `msg_${crypto.randomUUID()}`;
        db.prepare(
          `INSERT INTO messages (id, conversation_id, user_id, role, content, capability_used, verification_note)
           VALUES (?, ?, ?, 'assistant', ?, ?, ?)`
        ).run(assistantMsgId, conversationId, req.user!.id, fullReply, capability, verificationNote);
        db.prepare('UPDATE conversations SET updated_at = datetime(\'now\') WHERE id = ?').run(conversationId);

        res.write(
          `data: ${JSON.stringify({
            type: 'done',
            conversationId,
            messageId: assistantMsgId,
            capability,
            verificationNote,
          })}\n\n`
        );
        res.end();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Streaming failed.';
        res.write(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`);
        res.end();
      }
      return;
    }

    try {
      const result = await orchestrator.respond(ctx, parsed.data.message.trim());
      const assistantMsgId = `msg_${crypto.randomUUID()}`;

      const tx = db.transaction(() => {
        if (!parsed.data.regenerate) {
          db.prepare(
            'INSERT INTO messages (id, conversation_id, user_id, role, content) VALUES (?, ?, ?, \'user\', ?)'
          ).run(`msg_${crypto.randomUUID()}`, conversationId!, req.user!.id, parsed.data.message.trim());
        }
        db.prepare(
          `INSERT INTO messages (id, conversation_id, user_id, role, content, capability_used, verification_note)
           VALUES (?, ?, ?, 'assistant', ?, ?, ?)`
        ).run(
          assistantMsgId,
          conversationId!,
          req.user!.id,
          result.reply,
          result.capability,
          result.verificationNote
        );
        db.prepare('UPDATE conversations SET updated_at = datetime(\'now\') WHERE id = ?').run(conversationId!);
      });
      tx();

      const savedMessage = db.prepare('SELECT * FROM messages WHERE id = ?').get(assistantMsgId);
      res.json({
        ok: true,
        conversationId,
        message: savedMessage,
        capability: result.capability,
        verificationNote: result.verificationNote,
      });
    } catch (err) {
      if (err instanceof GeminiServiceError) {
        res.status(err.status).json({ ok: false, error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ ok: false, error: 'Failed to generate assistant response.', code: 'ASSISTANT_ERROR' });
    }
  });

  router.post('/transform', async (req: AuthedRequest, res) => {
    const parsed = transformSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid transform request.', code: 'VALIDATION_ERROR' });
      return;
    }

    try {
      const result = await orchestrator.transformMessage(
        {
          db,
          userId: req.user!.id,
          userRole: req.user!.role,
          userName: req.user!.fullName,
          language: req.user!.preferredLanguage,
        },
        parsed.data.text,
        parsed.data.mode
      );

      if (parsed.data.conversationId) {
        db.prepare(
          `INSERT INTO messages (id, conversation_id, user_id, role, content, capability_used, verification_note)
           VALUES (?, ?, ?, 'assistant', ?, ?, 'Transformed for clarity/language')`
        ).run(
          `msg_${crypto.randomUUID()}`,
          parsed.data.conversationId,
          req.user!.id,
          result.text,
          result.capability
        );
      }

      res.json({ ok: true, text: result.text, capability: result.capability });
    } catch (err) {
      if (err instanceof GeminiServiceError) {
        res.status(err.status).json({ ok: false, error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ ok: false, error: 'Could not transform message.', code: 'TRANSFORM_ERROR' });
    }
  });

  return router;
}
