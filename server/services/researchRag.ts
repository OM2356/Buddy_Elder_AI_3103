import crypto from 'crypto';
import type Database from 'better-sqlite3';

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'with',
  'by', 'as', 'from', 'that', 'this', 'what', 'how', 'when', 'where', 'who', 'why', 'are',
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'can',
  'could', 'should', 'would', 'about', 'into', 'than', 'then', 'their', 'they', 'it', 'its',
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

export function splitIntoChunks(text: string, maxChars = 360): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= maxChars) {
      chunks.push(para);
      continue;
    }

    const sentences = para.split(/(?<=[.!?।])\s+/);
    let current = '';

    for (const sentence of sentences) {
      if (!sentence.trim()) continue;
      if (current && current.length + sentence.length + 1 > maxChars) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current = current ? `${current} ${sentence}` : sentence;
      }
    }

    if (current.trim()) {
      if (current.length <= maxChars) {
        chunks.push(current.trim());
      } else {
        // Hard wrap extremely long sentence without breaking words
        const words = current.split(/\s+/);
        let buf = '';
        for (const w of words) {
          if (buf && buf.length + w.length + 1 > maxChars) {
            chunks.push(buf.trim());
            buf = w;
          } else {
            buf = buf ? `${buf} ${w}` : w;
          }
        }
        if (buf.trim()) chunks.push(buf.trim());
      }
    }
  }

  return chunks;
}

export function indexDocumentChunks(db: Database.Database, documentId: string, fullText: string) {
  const chunks = splitIntoChunks(fullText);
  const insert = db.prepare(
    `INSERT INTO research_chunks (id, document_id, chunk_index, chunk_text, keywords)
     VALUES (?, ?, ?, ?, ?)`
  );

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM research_chunks WHERE document_id = ?').run(documentId);
    chunks.forEach((chunkText, idx) => {
      const keywords = Array.from(new Set(tokenize(chunkText))).slice(0, 30).join(' ');
      insert.run(`chk_${crypto.randomUUID().slice(0, 12)}`, documentId, idx, chunkText, keywords);
    });
  });
  tx();
  return chunks.length;
}

export function seedResearchChunksIfNeeded(db: Database.Database) {
  const docsWithoutChunks = db
    .prepare(
      `SELECT d.id, d.summary, d.content_excerpt
       FROM research_documents d
       LEFT JOIN research_chunks c ON c.document_id = d.id
       WHERE c.id IS NULL`
    )
    .all() as { id: string; summary: string; content_excerpt: string }[];

  for (const doc of docsWithoutChunks) {
    const combined = `${doc.summary}\n\n${doc.content_excerpt}`;
    indexDocumentChunks(db, doc.id, combined);
  }
}

export interface RetrievedChunk {
  id: string;
  chunkIndex: number;
  chunkText: string;
  score: number;
}

export function retrieveRelevantChunks(
  db: Database.Database,
  documentId: string,
  question: string,
  topK = 3
): { chunks: RetrievedChunk[]; hasLexicalMatch: boolean } {
  const rows = db
    .prepare('SELECT id, chunk_index, chunk_text, keywords FROM research_chunks WHERE document_id = ? ORDER BY chunk_index ASC')
    .all(documentId) as { id: string; chunk_index: number; chunk_text: string; keywords: string }[];

  if (rows.length === 0) {
    return { chunks: [], hasLexicalMatch: false };
  }

  const queryTokens = tokenize(question);
  const queryLower = question.toLowerCase();

  const scored: RetrievedChunk[] = rows.map((row) => {
    const chunkLower = row.chunk_text.toLowerCase();
    const chunkTokens = new Set(tokenize(row.chunk_text));
    let score = 0;

    for (const qt of queryTokens) {
      if (chunkTokens.has(qt)) {
        score += 2;
      } else if (chunkLower.includes(qt)) {
        score += 1;
      }
    }

    // Bonus for multi-word phrase match
    if (queryTokens.length >= 2) {
      for (let i = 0; i < queryTokens.length - 1; i++) {
        const bigram = `${queryTokens[i]} ${queryTokens[i + 1]}`;
        if (chunkLower.includes(bigram) || queryLower.includes(bigram)) {
          score += 2;
        }
      }
    }

    return {
      id: row.id,
      chunkIndex: row.chunk_index,
      chunkText: row.chunk_text,
      score,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex);
  const bestScore = scored[0]?.score ?? 0;

  return {
    chunks: scored.slice(0, topK),
    hasLexicalMatch: bestScore > 0,
  };
}
