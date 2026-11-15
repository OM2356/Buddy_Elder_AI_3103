import React, { useEffect, useState } from 'react';
import { Send, Shield, Users } from 'lucide-react';
import { Layout } from '../components/Layout';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { apiFetch } from '../lib/api';

interface SeniorOverview {
  connectionId: string;
  seniorId: string;
  seniorName: string;
  relationship: string;
  sharingLevel: 'PRIVATE' | 'LIMITED' | 'AUTHORIZED';
  accessNotice: string;
  wellnessSummary: { mood: string; energy_level: number; sleep_hours: number; water_glasses: number; created_at: string; notes?: string }[];
  reminders: { id: string; title: string; category: string; schedule_time: string; completed: number }[];
  learningStats: { completedLessons: number; avgQuizScore: number | null } | null;
  emergencyContacts: { id: string; name: string; phone: string; relationship: string }[];
  notes: { id: string; note: string; created_at: string }[];
}

export default function CaregiverDashboard() {
  const [seniors, setSeniors] = useState<SeniorOverview[]>([]);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await apiFetch<{ seniors: SeniorOverview[] }>('/api/caregiver/seniors');
      setSeniors(data.seniors);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load caregiver dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addNote = async (seniorId: string) => {
    const text = (noteInputs[seniorId] || '').trim();
    if (!text) return;
    await apiFetch('/api/caregiver/notes', {
      method: 'POST',
      body: JSON.stringify({ seniorId, note: text }),
    });
    setNoteInputs((prev) => ({ ...prev, [seniorId]: '' }));
    await load();
  };

  return (
    <Layout title="Caregiver Dashboard">
      <div className="space-y-6">
        {error && <ErrorBanner message={error} onRetry={load} />}

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#EFF6FF] dark:bg-slate-900 p-5 flex items-start gap-3">
          <Shield className="w-6 h-6 text-[#0F766E] shrink-0 mt-0.5" />
          <p className="text-lg">
            Every view below strictly honors the senior citizen’s Autonomy Engine consent settings. Private messages and unshared entries are never exposed.
          </p>
        </div>

        {loading ? (
          <LoadingSkeleton rows={3} />
        ) : seniors.length === 0 ? (
          <EmptyState
            title="No connected senior profiles yet"
            description="Accept a family invitation in Family Hub when a senior invites you to connect."
          />
        ) : (
          <div className="space-y-8">
            {seniors.map((s) => (
              <section
                key={s.connectionId}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <Users className="w-7 h-7 text-[#0F766E]" />
                    <div>
                      <h2 className="text-2xl font-bold">{s.seniorName}</h2>
                      <p className="text-base text-slate-600 dark:text-slate-300">
                        {s.relationship} · Sharing Level: <span className="font-bold">{s.sharingLevel}</span>
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-base text-slate-600 dark:text-slate-300">{s.accessNotice}</p>

                {s.sharingLevel !== 'PRIVATE' && (
                  <div className="grid md:grid-cols-3 gap-5">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                      <h3 className="font-bold text-lg">Approved Wellness</h3>
                      {s.wellnessSummary.length === 0 ? (
                        <p className="text-base text-slate-500">No shared check-ins yet.</p>
                      ) : (
                        <ul className="space-y-1 text-base">
                          {s.wellnessSummary.slice(0, 4).map((w, i) => (
                            <li key={i}>
                              {w.created_at.slice(0, 10)}: {w.mood} · {w.sleep_hours}h sleep · {w.water_glasses} water
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                      <h3 className="font-bold text-lg">Shared Reminders</h3>
                      {s.reminders.length === 0 ? (
                        <p className="text-base text-slate-500">No reminders found.</p>
                      ) : (
                        <ul className="space-y-1 text-base">
                          {s.reminders.slice(0, 5).map((r) => (
                            <li key={r.id}>
                              <span className="font-mono-tabular">{r.schedule_time}</span> · {r.title} ({r.completed ? 'Done' : 'Pending'})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2">
                      <h3 className="font-bold text-lg">Learning & Emergency</h3>
                      <p className="text-base">
                        Completed Lessons: <span className="font-mono-tabular font-bold">{s.learningStats?.completedLessons ?? 0}</span>
                      </p>
                      {s.learningStats?.avgQuizScore !== null && s.learningStats?.avgQuizScore !== undefined && (
                        <p className="text-base">
                          Avg Quiz Score: <span className="font-mono-tabular font-bold">{s.learningStats.avgQuizScore}%</span>
                        </p>
                      )}
                      {s.emergencyContacts.length > 0 && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                          <p className="font-semibold text-sm">Emergency Contacts:</p>
                          {s.emergencyContacts.map((ec) => (
                            <p key={ec.id} className="text-sm font-mono-tabular">
                              {ec.name}: {ec.phone}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Caregiver Communication Notes */}
                <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <h3 className="font-bold text-lg">Caregiver Notes</h3>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={noteInputs[s.seniorId] || ''}
                      onChange={(e) => setNoteInputs((prev) => ({ ...prev, [s.seniorId]: e.target.value }))}
                      placeholder="Write a helpful reminder or family update..."
                      aria-label={`Caregiver note for ${s.seniorName}`}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                    />
                    <button
                      type="button"
                      onClick={() => addNote(s.seniorId)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0F766E] text-white font-semibold cursor-pointer"
                    >
                      <Send className="w-4 h-4" /> Save Note
                    </button>
                  </div>
                  {s.notes.length > 0 && (
                    <ul className="space-y-2">
                      {s.notes.map((n) => (
                        <li key={n.id} className="text-base rounded-lg bg-slate-50 dark:bg-slate-900 p-3 flex justify-between gap-3">
                          <span>{n.note}</span>
                          <span className="font-mono-tabular text-sm text-slate-500 shrink-0">{n.created_at.slice(0, 10)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
