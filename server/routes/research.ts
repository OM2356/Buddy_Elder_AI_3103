import crypto from 'crypto';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { createAuthMiddleware, type AuthedRequest } from '../middleware/auth.ts';
import { GeminiServiceError } from '../services/gemini.ts';
import { orchestrator } from '../services/orchestrator.ts';
import { indexDocumentChunks, retrieveRelevantChunks } from '../services/researchRag.ts';
import { logAudit } from '../services/audit.ts';

const askSchema = z.object({
  documentId: z.string().min(1),
  question: z.string().min(3).max(1000),
  language: z.enum(['en', 'hi', 'mr']).default('en'),
});

const uploadMetaSchema = z.object({
  title: z.string().min(3).max(180),
  authors: z.string().min(2).max(160).default('Personal Reference'),
  topic: z.string().min(2).max(80).default('Uploaded Document'),
  publishedYear: z.coerce.number().int().min(1950).max(2035).default(new Date().getFullYear()),
  sourceUrl: z.string().max(300).optional().default(''),
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 }, // 1 MB max text document
});

export function createResearchRouter(db: Database.Database) {
  const router = Router();
  const requireAuth = createAuthMiddleware(db);
  router.use(requireAuth);

  router.get('/', (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const topic = String(req.query.topic || '').trim();
    const all = db
      .prepare(
        `SELECT d.*, (SELECT COUNT(*) FROM research_chunks c WHERE c.document_id = d.id) as chunk_count
         FROM research_documents d
         ORDER BY d.is_user_uploaded DESC, d.published_year DESC`
      )
      .all() as Record<string, unknown>[];

    const filtered = all.filter((doc) => {
      const matchesTopic = !topic || topic === 'All' || doc.topic === topic;
      const matchesQ =
        !q ||
        String(doc.title).toLowerCase().includes(q) ||
        String(doc.authors).toLowerCase().includes(q) ||
        String(doc.summary).toLowerCase().includes(q) ||
        String(doc.content_excerpt).toLowerCase().includes(q);
      return matchesTopic && matchesQ;
    });

    const topics = Array.from(new Set(all.map((d) => String(d.topic))));
    res.json({ ok: true, documents: filtered, topics });
  });

  router.post('/upload', upload.single('file'), (req: AuthedRequest, res) => {
    const file = req.file;
    const rawBodyText = typeof req.body?.textContent === 'string' ? req.body.textContent : '';

    let extractedText = '';
    if (file) {
      const allowedExt = /\.(txt|md|csv)$/i.test(file.originalname);
      const allowedMime = file.mimetype.startsWith('text/') || file.mimetype === 'application/octet-stream';
      if (!allowedExt && !allowedMime) {
        res.status(400).json({
          ok: false,
          error: 'Unsupported file format. Please upload a plain text (.txt or .md) document.',
          code: 'INVALID_FILE_TYPE',
        });
        return;
      }
      extractedText = file.buffer.toString('utf8').replace(/\0/g, '').trim();
    } else if (rawBodyText.trim()) {
      extractedText = rawBodyText.trim();
    }

    if (extractedText.length < 40) {
      res.status(400).json({
        ok: false,
        error: 'Document must contain at least 40 characters of readable text.',
        code: 'TEXT_TOO_SHORT',
      });
      return;
    }

    if (extractedText.length > 50000) {
      extractedText = extractedText.slice(0, 50000);
    }

    const parsedMeta = uploadMetaSchema.safeParse(req.body);
    if (!parsedMeta.success) {
      res.status(400).json({
        ok: false,
        error: parsedMeta.error.issues[0]?.message || 'Invalid document details.',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const d = parsedMeta.data;
    const docId = `doc_${crypto.randomUUID().slice(0, 10)}`;
    const summary = extractedText.slice(0, 260) + (extractedText.length > 260 ? '...' : '');
    const sourceUrl = d.sourceUrl?.trim() || 'https://buddyelder.local/uploaded-document';

    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO research_documents (id, title, authors, topic, published_year, source_url, summary, content_excerpt, is_user_uploaded, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
      ).run(docId, d.title.trim(), d.authors.trim(), d.topic.trim(), d.publishedYear, sourceUrl, summary, extractedText, req.user!.id);
    });
    tx();

    const chunkCount = indexDocumentChunks(db, docId, extractedText);

    logAudit(db, {
      actorId: req.user!.id,
      action: 'RESEARCH_DOCUMENT_UPLOADED',
      targetType: 'research_document',
      targetId: docId,
      metadata: { chunkCount, title: d.title.trim() },
      ipAddress: req.ip,
    });

    const document = db.prepare('SELECT * FROM research_documents WHERE id = ?').get(docId);
    res.status(201).json({ ok: true, document, chunkCount });
  });

  router.delete('/:id', (req: AuthedRequest, res) => {
    const doc = db
      .prepare('SELECT id, is_user_uploaded, uploaded_by FROM research_documents WHERE id = ?')
      .get(req.params.id) as { id: string; is_user_uploaded: number; uploaded_by: string | null } | undefined;

    if (!doc) {
      res.status(404).json({ ok: false, error: 'Research document not found.', code: 'NOT_FOUND' });
      return;
    }

    if (doc.is_user_uploaded !== 1 || (doc.uploaded_by !== req.user!.id && req.user!.role !== 'admin')) {
      res.status(403).json({ ok: false, error: 'You can only remove documents you uploaded.', code: 'FORBIDDEN' });
      return;
    }

    db.prepare('DELETE FROM research_documents WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  });

  router.post('/ask', async (req: AuthedRequest, res) => {
    const parsed = askSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Please select a paper and enter your question.', code: 'VALIDATION_ERROR' });
      return;
    }

    const doc = db
      .prepare('SELECT * FROM research_documents WHERE id = ?')
      .get(parsed.data.documentId) as
      | {
          id: string;
          title: string;
          authors: string;
          published_year: number;
          source_url: string;
          content_excerpt: string;
        }
      | undefined;

    if (!doc) {
      res.status(404).json({ ok: false, error: 'Research paper not found.', code: 'NOT_FOUND' });
      return;
    }

    const { chunks, hasLexicalMatch } = retrieveRelevantChunks(db, doc.id, parsed.data.question, 3);

    try {
      const result = await orchestrator.answerResearchQuestion({
        title: doc.title,
        authors: doc.authors,
        publishedYear: doc.published_year,
        sourceUrl: doc.source_url,
        contentExcerpt: doc.content_excerpt,
        retrievedChunks: chunks,
        hasLexicalMatch,
        question: parsed.data.question,
        language: parsed.data.language,
      });

      res.json({
        ok: true,
        answer: result.answer,
        usedGemini: result.usedGemini,
        retrievedChunks: chunks,
        hasLexicalMatch,
        citation: {
          title: doc.title,
          authors: doc.authors,
          publishedYear: doc.published_year,
          sourceUrl: doc.source_url,
        },
      });
    } catch (err) {
      if (err instanceof GeminiServiceError) {
        res.status(err.status).json({ ok: false, error: err.message, code: err.code });
        return;
      }
      res.status(500).json({ ok: false, error: 'Unable to answer research question.', code: 'RESEARCH_ERROR' });
    }
  });

  return router;
}
