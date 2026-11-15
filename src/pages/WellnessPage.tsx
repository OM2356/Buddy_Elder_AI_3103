import React, { useEffect, useState } from 'react';
import { HeartPulse, Lock, ShieldCheck, Trash2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { apiFetch } from '../lib/api';
import { syncWellnessToFirestore } from '../lib/firebase';

interface Checkin {
  id: string;
  mood: 'great' | 'good' | 'okay' | 'low' | 'stressed';
  energy_level: number;
  sleep_hours: number;
  water_glasses: number;
  activity_done: string;
  notes: string;
  sharing_level: 'PRIVATE' | 'LIMITED' | 'AUTHORIZED';
  created_at: string;
}

interface WeeklySummary {
  entriesCount: number;
  avgSleep: number;
  avgWater: number;
  avgEnergy: number;
  disclaimer: string;
}

export default function WellnessPage() {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mood, setMood] = useState<'great' | 'good' | 'okay' | 'low' | 'stressed'>('good');
  const [energyLevel, setEnergyLevel] = useState(7);
  const [sleepHours, setSleepHours] = useState(7.5);
  const [waterGlasses, setWaterGlasses] = useState(6);
  const [activityDone, setActivityDone] = useState('Morning walk');
  const [notes, setNotes] = useState('');
  const [sharingLevel, setSharingLevel] = useState<'PRIVATE' | 'LIMITED' | 'AUTHORIZED'>('PRIVATE');
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const data = await apiFetch<{ checkins: Checkin[]; weeklySummary: WeeklySummary }>('/api/wellness/checkins');
      setCheckins(data.checkins);
      setSummary(data.weeklySummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load wellness history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const submitCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const resp = await apiFetch<{ checkin: Checkin }>('/api/wellness/checkins', {
        method: 'POST',
        body: JSON.stringify({
          mood,
          energyLevel,
          sleepHours,
          waterGlasses,
          activityDone,
          notes,
          sharingLevel,
        }),
      });
      await syncWellnessToFirestore({
        id: resp.checkin.id,
        mood,
        energyLevel,
        sleepHours,
        waterGlasses,
        notes,
        sharingLevel,
      }).catch(() => {});
      setNotes('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save wellness check-in.');
    } finally {
      setSaving(false);
    }
  };

  const updatePrivacy = async (id: string, nextLevel: 'PRIVATE' | 'LIMITED' | 'AUTHORIZED') => {
    await apiFetch(`/api/wellness/checkins/${id}/privacy`, {
      method: 'PATCH',
      body: JSON.stringify({ sharingLevel: nextLevel }),
    });
    await loadData();
  };

  const deleteCheckin = async (id: string) => {
    await apiFetch(`/api/wellness/checkins/${id}`, { method: 'DELETE' });
    await loadData();
  };

  return (
    <Layout title="Wellness Center">
      <div className="space-y-8">
        {error && <ErrorBanner message={error} onRetry={loadData} />}

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#EFF6FF] dark:bg-slate-900 p-5 flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-[#0F766E] dark:text-teal-400 shrink-0 mt-0.5" />
          <p className="text-lg">
            Wellness Center tracks daily mood, sleep, hydration, and light activity for your personal reflection. It never provides medical diagnoses or medication prescriptions.
          </p>
        </div>

        {/* Weekly Summary */}
        {summary && (
          <section className="grid sm:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-5">
              <p className="text-sm text-slate-500">Check-ins (7 days)</p>
              <p className="text-3xl font-bold font-mono-tabular mt-1">{summary.entriesCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-5">
              <p className="text-sm text-slate-500">Avg Sleep</p>
              <p className="text-3xl font-bold font-mono-tabular mt-1">{summary.avgSleep} hrs</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-5">
              <p className="text-sm text-slate-500">Avg Water</p>
              <p className="text-3xl font-bold font-mono-tabular mt-1">{summary.avgWater} glasses</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-5">
              <p className="text-sm text-slate-500">Avg Energy</p>
              <p className="text-3xl font-bold font-mono-tabular mt-1">{summary.avgEnergy} / 10</p>
            </div>
          </section>
        )}

        {/* Log Form */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-5">
          <div className="flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-[#0F766E]" />
            <h2 className="text-2xl font-bold">Today’s Check-In</h2>
          </div>

          <form onSubmit={submitCheckin} className="space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="w-mood" className="block text-base font-semibold mb-1">How do you feel?</label>
                <select
                  id="w-mood"
                  value={mood}
                  onChange={(e) => setMood(e.target.value as typeof mood)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                >
                  <option value="great">Great</option>
                  <option value="good">Good</option>
                  <option value="okay">Okay</option>
                  <option value="low">Low</option>
                  <option value="stressed">Stressed</option>
                </select>
              </div>

              <div>
                <label htmlFor="w-energy" className="block text-base font-semibold mb-1">
                  Energy (<span className="font-mono-tabular">{energyLevel}/10</span>)
                </label>
                <input
                  id="w-energy"
                  type="number"
                  min={1}
                  max={10}
                  value={energyLevel}
                  onChange={(e) => setEnergyLevel(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                />
              </div>

              <div>
                <label htmlFor="w-sleep" className="block text-base font-semibold mb-1">Sleep (hours)</label>
                <input
                  id="w-sleep"
                  type="number"
                  step={0.5}
                  min={0}
                  max={24}
                  value={sleepHours}
                  onChange={(e) => setSleepHours(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                />
              </div>

              <div>
                <label htmlFor="w-water" className="block text-base font-semibold mb-1">Water (glasses)</label>
                <input
                  id="w-water"
                  type="number"
                  min={0}
                  max={30}
                  value={waterGlasses}
                  onChange={(e) => setWaterGlasses(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="w-activity" className="block text-base font-semibold mb-1">Daily Activity</label>
                <input
                  id="w-activity"
                  type="text"
                  value={activityDone}
                  onChange={(e) => setActivityDone(e.target.value)}
                  placeholder="e.g. 20 min walk, yoga, gardening"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                />
              </div>

              <div>
                <label htmlFor="w-privacy" className="block text-base font-semibold mb-1">Who can see this entry?</label>
                <select
                  id="w-privacy"
                  value={sharingLevel}
                  onChange={(e) => setSharingLevel(e.target.value as typeof sharingLevel)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                >
                  <option value="PRIVATE">PRIVATE (Only me)</option>
                  <option value="LIMITED">LIMITED (Summary only, hide notes)</option>
                  <option value="AUTHORIZED">AUTHORIZED (Approved family caregivers)</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="w-notes" className="block text-base font-semibold mb-1">Optional Personal Notes</label>
              <textarea
                id="w-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any thoughts you would like to remember..."
                className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-7 py-3.5 rounded-xl bg-[#0F766E] text-white text-xl font-semibold hover:bg-[#0D635D] cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Today’s Check-In'}
            </button>
          </form>
        </section>

        {/* History */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
          <h2 className="text-2xl font-bold">Mood & Routine History</h2>
          {loading ? (
            <LoadingSkeleton rows={3} />
          ) : checkins.length === 0 ? (
            <EmptyState
              title="No check-ins recorded yet"
              description="Log your first daily mood, water, and sleep entry above to see your weekly patterns."
            />
          ) : (
            <div className="space-y-3">
              {checkins.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <p className="font-bold text-lg capitalize">
                      Mood: {c.mood} · Energy <span className="font-mono-tabular">{c.energy_level}/10</span> · Sleep{' '}
                      <span className="font-mono-tabular">{c.sleep_hours}h</span> · Water{' '}
                      <span className="font-mono-tabular">{c.water_glasses}</span> glasses
                    </p>
                    <p className="text-base text-slate-600 dark:text-slate-400">
                      {c.created_at.slice(0, 10)} {c.activity_done ? `· ${c.activity_done}` : ''} {c.notes ? `· "${c.notes}"` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Lock className="w-4 h-4 text-slate-500" aria-hidden="true" />
                    <select
                      aria-label={`Privacy for ${c.created_at}`}
                      value={c.sharing_level}
                      onChange={(e) => updatePrivacy(c.id, e.target.value as Checkin['sharing_level'])}
                      className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold"
                    >
                      <option value="PRIVATE">PRIVATE</option>
                      <option value="LIMITED">LIMITED</option>
                      <option value="AUTHORIZED">AUTHORIZED</option>
                    </select>
                    <button
                      type="button"
                      aria-label={`Delete check-in ${c.created_at}`}
                      onClick={() => deleteCheckin(c.id)}
                      className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
