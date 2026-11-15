import React, { useEffect, useState } from 'react';
import { Bookmark, CheckCircle2, GraduationCap, Play, Square } from 'lucide-react';
import { Layout } from '../components/Layout';
import { PhoneSimulator } from '../components/PhoneSimulator';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { useAccessibility } from '../context/AccessibilityContext';
import { useSpeech } from '../hooks/useSpeech';
import { apiFetch } from '../lib/api';

interface Lesson {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  audio_script: string;
  practice_prompt: string;
  completed: boolean;
  bookmarked: boolean;
}

interface Quiz {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

interface Course {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  description: string;
  estimated_minutes: number;
  lessons: Lesson[];
  quizzes: Quiz[];
  completedCount: number;
  totalLessons: number;
  quizScore: number | null;
}

export default function AcademyPage() {
  const { voiceLang, speechRate, speechVolume } = useAccessibility();
  const speech = useSpeech(voiceLang, speechRate, speechVolume);

  const [courses, setCourses] = useState<Course[]>([]);
  const [recommendations, setRecommendations] = useState<{ id: string; title: string; category: string }[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizResult, setQuizResult] = useState<{
    score: number;
    feedback: { quizId: string; isCorrect: boolean; explanation: string }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCourses = async () => {
    try {
      const data = await apiFetch<{
        courses: Course[];
        recommendations: { id: string; title: string; category: string }[];
      }>('/api/academy/courses');
      setCourses(data.courses);
      setRecommendations(data.recommendations);
      if (data.courses.length > 0) {
        setSelectedCourseId((prev) => prev || data.courses[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load courses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const toggleProgress = async (courseId: string, lessonId: string, field: 'completed' | 'bookmarked', value: boolean) => {
    await apiFetch('/api/academy/progress', {
      method: 'POST',
      body: JSON.stringify({ courseId, lessonId, [field]: value }),
    });
    await loadCourses();
  };

  const submitQuiz = async (courseId: string) => {
    const res = await apiFetch<{
      score: number;
      feedback: { quizId: string; isCorrect: boolean; explanation: string }[];
    }>('/api/academy/quiz', {
      method: 'POST',
      body: JSON.stringify({ courseId, answers }),
    });
    setQuizResult(res);
    await loadCourses();
  };

  const categories = ['All', ...Array.from(new Set(courses.map((c) => c.category)))];
  const visibleCourses = courses.filter((c) => categoryFilter === 'All' || c.category === categoryFilter);
  const activeCourse = courses.find((c) => c.id === selectedCourseId) || visibleCourses[0] || null;

  const totalCompletedLessons = courses.reduce((s, c) => s + c.completedCount, 0);
  const totalLessons = courses.reduce((s, c) => s + c.totalLessons, 0);

  return (
    <Layout title="Digital Learning Academy">
      <div className="space-y-8">
        {error && <ErrorBanner message={error} onRetry={loadCourses} />}

        {/* Overall Progress & Recommendations */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 grid md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-6 space-y-2">
            <div className="flex items-center gap-2 text-[#0F766E] dark:text-teal-400 font-bold">
              <GraduationCap className="w-6 h-6" />
              <span>Your Learning Progress</span>
            </div>
            <p className="text-2xl font-bold font-mono-tabular">
              {totalCompletedLessons} / {totalLessons} Lessons Completed
            </p>
            <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-[#0F766E]"
                style={{ width: `${totalLessons ? Math.round((totalCompletedLessons / totalLessons) * 100) : 0}%` }}
              />
            </div>
          </div>

          <div className="md:col-span-6 space-y-2">
            <p className="font-bold text-lg">Recommended Next for You</p>
            <div className="flex flex-wrap gap-2">
              {recommendations.map((rec) => (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => {
                    setSelectedCourseId(rec.id);
                    setQuizResult(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#EFF6FF] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-base font-semibold cursor-pointer hover:border-[#0F766E]"
                >
                  {rec.title}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Course categories">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-4 py-2 rounded-xl font-semibold text-base cursor-pointer transition-colors ${
                categoryFilter === cat
                  ? 'bg-[#0F2544] dark:bg-teal-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : visibleCourses.length === 0 ? (
          <EmptyState title="No courses match this category" description="Choose 'All' to view all 13 courses." />
        ) : (
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            {/* Course Directory */}
            <aside className="lg:col-span-4 space-y-3 max-h-[680px] overflow-y-auto pr-1">
              {visibleCourses.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCourseId(c.id);
                    setQuizResult(null);
                  }}
                  className={`w-full text-left rounded-2xl border p-4 space-y-1 transition-colors cursor-pointer ${
                    activeCourse?.id === c.id
                      ? 'border-[#0F766E] bg-[#EFF6FF] dark:bg-slate-800'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B]'
                  }`}
                >
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {c.category} · {c.estimated_minutes} min
                  </p>
                  <h3 className="text-lg font-bold">{c.title}</h3>
                  <p className="text-sm font-mono-tabular text-[#0F766E] dark:text-teal-400">
                    {c.completedCount}/{c.totalLessons} lessons done
                    {c.quizScore !== null ? ` · Quiz ${c.quizScore}%` : ''}
                  </p>
                </button>
              ))}
            </aside>

            {/* Active Course & Lessons */}
            {activeCourse && (
              <section className="lg:col-span-8 space-y-6">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {activeCourse.category} · {activeCourse.difficulty} · {activeCourse.estimated_minutes} min
                  </p>
                  <h2 className="font-display text-3xl font-bold">{activeCourse.title}</h2>
                  <p className="text-xl text-slate-700 dark:text-slate-300">{activeCourse.description}</p>
                </div>

                {activeCourse.lessons.map((lesson, idx) => (
                  <article
                    key={lesson.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-2xl font-bold">
                        Lesson {idx + 1}: {lesson.title}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            speech.speaking ? speech.stopSpeaking() : speech.speak(lesson.audio_script)
                          }
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                        >
                          {speech.speaking ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {speech.speaking ? 'Stop Audio' : 'Listen'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            toggleProgress(activeCourse.id, lesson.id, 'bookmarked', !lesson.bookmarked)
                          }
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border font-semibold cursor-pointer ${
                            lesson.bookmarked
                              ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                              : 'border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <Bookmark className="w-4 h-4" />
                          {lesson.bookmarked ? 'Bookmarked' : 'Bookmark'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            toggleProgress(activeCourse.id, lesson.id, 'completed', !lesson.completed)
                          }
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold cursor-pointer ${
                            lesson.completed
                              ? 'bg-[#0F766E] text-white'
                              : 'border border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {lesson.completed ? 'Completed' : 'Mark Complete'}
                        </button>
                      </div>
                    </div>

                    <p className="text-lg text-slate-600 dark:text-slate-300">{lesson.summary}</p>

                    <ol className="list-decimal pl-6 space-y-2 text-lg">
                      {lesson.steps.map((step, sIdx) => (
                        <li key={sIdx}>{step}</li>
                      ))}
                    </ol>

                    <p className="text-base text-[#0F766E] dark:text-teal-400 font-semibold">
                      Practice Activity: {lesson.practice_prompt}
                    </p>
                  </article>
                ))}

                {/* Interactive Quiz */}
                {activeCourse.quizzes.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-5">
                    <h3 className="text-2xl font-bold">Quick Safety & Knowledge Quiz</h3>
                    {activeCourse.quizzes.map((q) => (
                      <div key={q.id} className="space-y-3">
                        <p className="text-xl font-semibold">{q.question}</p>
                        <div className="space-y-2">
                          {q.options.map((opt, oIdx) => (
                            <label
                              key={oIdx}
                              className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer ${
                                answers[q.id] === oIdx
                                  ? 'border-[#0F766E] bg-[#EFF6FF] dark:bg-slate-800'
                                  : 'border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <input
                                type="radio"
                                name={q.id}
                                checked={answers[q.id] === oIdx}
                                onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: oIdx }))}
                              />
                              <span className="text-lg">{opt}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => submitQuiz(activeCourse.id)}
                      className="px-6 py-3 rounded-xl bg-[#0F766E] text-white font-semibold text-lg cursor-pointer"
                    >
                      Check Quiz Answers
                    </button>

                    {quizResult && (
                      <div className="rounded-xl bg-[#EFF6FF] dark:bg-slate-900 p-4 space-y-2">
                        <p className="text-xl font-bold font-mono-tabular">Score: {quizResult.score}%</p>
                        {quizResult.feedback.map((f) => (
                          <p key={f.quizId} className="text-lg">
                            {f.isCorrect ? 'Correct: ' : 'Note: '}
                            {f.explanation}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {/* Virtual Smartphone Practice Simulator */}
        <PhoneSimulator />
      </div>
    </Layout>
  );
}
