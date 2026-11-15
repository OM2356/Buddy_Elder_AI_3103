import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import type Database from 'better-sqlite3';
import { createAuthMiddleware, type AuthedRequest } from '../middleware/auth.ts';

const progressSchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  completed: z.boolean().optional(),
  bookmarked: z.boolean().optional(),
});

const quizSchema = z.object({
  courseId: z.string().min(1),
  answers: z.record(z.string(), z.number().int().min(0).max(10)),
});

export function createAcademyRouter(db: Database.Database) {
  const router = Router();
  const requireAuth = createAuthMiddleware(db);
  router.use(requireAuth);

  router.get('/courses', (req: AuthedRequest, res) => {
    interface CourseRow {
      id: string;
      slug: string;
      title: string;
      category: string;
      difficulty: string;
      description: string;
      estimated_minutes: number;
      sort_order: number;
      is_published: number;
      created_at: string;
    }

    const courses = db
      .prepare('SELECT * FROM courses WHERE is_published = 1 ORDER BY sort_order ASC')
      .all() as CourseRow[];

    const lessons = db.prepare('SELECT * FROM lessons ORDER BY sort_order ASC').all() as Record<string, unknown>[];
    const quizzes = db.prepare('SELECT * FROM quizzes').all() as Record<string, unknown>[];
    const progress = db
      .prepare('SELECT * FROM learning_progress WHERE user_id = ?')
      .all(req.user!.id) as {
      course_id: string;
      lesson_id: string;
      completed: number;
      bookmarked: number;
      quiz_score: number | null;
    }[];

    const progressMap = new Map(progress.map((p) => [p.lesson_id, p]));

    const enriched = courses.map((c) => {
      const courseLessons = lessons
        .filter((l) => l.course_id === c.id)
        .map((l) => {
          const p = progressMap.get(String(l.id));
          return {
            ...l,
            steps: JSON.parse(String(l.steps_json || '[]')),
            completed: Boolean(p?.completed),
            bookmarked: Boolean(p?.bookmarked),
          };
        });
      const courseQuizzes = quizzes
        .filter((q) => q.course_id === c.id)
        .map((q) => ({
          ...q,
          options: JSON.parse(String(q.options_json || '[]')),
        }));
      const completedCount = courseLessons.filter((l) => l.completed).length;
      const quizEntry = progress.find((p) => p.course_id === c.id && p.quiz_score !== null);

      return {
        ...c,
        lessons: courseLessons,
        quizzes: courseQuizzes,
        completedCount,
        totalLessons: courseLessons.length,
        quizScore: quizEntry?.quiz_score ?? null,
      };
    });

    // Personalized recommendations: prioritize safety/foundations not yet completed
    const recommendations = enriched
      .filter((c) => c.completedCount < c.totalLessons)
      .sort((a, b) => {
        const aSafety = String(a.category).includes('Safety') ? 0 : 1;
        const bSafety = String(b.category).includes('Safety') ? 0 : 1;
        return aSafety - bSafety;
      })
      .slice(0, 3)
      .map((c) => ({ id: c.id, title: c.title, category: c.category }));

    res.json({ ok: true, courses: enriched, recommendations });
  });

  router.post('/progress', (req: AuthedRequest, res) => {
    const parsed = progressSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid lesson progress payload.', code: 'VALIDATION_ERROR' });
      return;
    }

    const d = parsed.data;
    const lesson = db
      .prepare('SELECT id, course_id FROM lessons WHERE id = ? AND course_id = ?')
      .get(d.lessonId, d.courseId);
    if (!lesson) {
      res.status(404).json({ ok: false, error: 'Lesson not found.', code: 'NOT_FOUND' });
      return;
    }

    const existing = db
      .prepare('SELECT * FROM learning_progress WHERE user_id = ? AND lesson_id = ?')
      .get(req.user!.id, d.lessonId) as { completed: number; bookmarked: number } | undefined;

    const nextCompleted = d.completed === undefined ? existing?.completed ?? 0 : d.completed ? 1 : 0;
    const nextBookmarked = d.bookmarked === undefined ? existing?.bookmarked ?? 0 : d.bookmarked ? 1 : 0;

    db.prepare(
      `INSERT INTO learning_progress (id, user_id, course_id, lesson_id, completed, bookmarked, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(user_id, lesson_id) DO UPDATE SET
         completed = excluded.completed,
         bookmarked = excluded.bookmarked,
         updated_at = datetime('now')`
    ).run(`prg_${crypto.randomUUID()}`, req.user!.id, d.courseId, d.lessonId, nextCompleted, nextBookmarked);

    res.json({ ok: true, completed: Boolean(nextCompleted), bookmarked: Boolean(nextBookmarked) });
  });

  router.post('/quiz', (req: AuthedRequest, res) => {
    const parsed = quizSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid quiz submission.', code: 'VALIDATION_ERROR' });
      return;
    }

    const quizzes = db
      .prepare('SELECT * FROM quizzes WHERE course_id = ?')
      .all(parsed.data.courseId) as { id: string; correct_index: number; explanation: string }[];

    if (quizzes.length === 0) {
      res.status(404).json({ ok: false, error: 'Quiz not found for this course.', code: 'NOT_FOUND' });
      return;
    }

    let correctCount = 0;
    const feedback = quizzes.map((q) => {
      const selected = parsed.data.answers[q.id];
      const isCorrect = selected === q.correct_index;
      if (isCorrect) correctCount += 1;
      return {
        quizId: q.id,
        isCorrect,
        correctIndex: q.correct_index,
        explanation: q.explanation,
      };
    });

    const score = Math.round((correctCount / quizzes.length) * 100);
    const firstLesson = db
      .prepare('SELECT id FROM lessons WHERE course_id = ? ORDER BY sort_order ASC LIMIT 1')
      .get(parsed.data.courseId) as { id: string } | undefined;

    if (firstLesson) {
      db.prepare(
        `INSERT INTO learning_progress (id, user_id, course_id, lesson_id, completed, bookmarked, quiz_score, updated_at)
         VALUES (?, ?, ?, ?, 1, 0, ?, datetime('now'))
         ON CONFLICT(user_id, lesson_id) DO UPDATE SET quiz_score = excluded.quiz_score, updated_at = datetime('now')`
      ).run(`prg_${crypto.randomUUID()}`, req.user!.id, parsed.data.courseId, firstLesson.id, score);
    }

    res.json({ ok: true, score, correctCount, total: quizzes.length, feedback });
  });

  return router;
}
