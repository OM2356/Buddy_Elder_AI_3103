import React, { useEffect, useState } from 'react';
import { CheckCircle2, Lock, Shield, SlidersHorizontal, XCircle } from 'lucide-react';
import { Layout } from '../components/Layout';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { apiFetch } from '../lib/api';

interface ConsentRecord {
  id: string;
  grantee_email: string;
  module_name: string;
  action_description: string;
  sharing_level: 'PRIVATE' | 'LIMITED' | 'AUTHORIZED';
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  created_at: string;
}

interface PrivacyAudit {
  id: string;
  action: string;
  target_type: string;
  created_at: string;
}

export default function AutonomyPage() {
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [history, setHistory] = useState<PrivacyAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [granteeEmail, setGranteeEmail] = useState('');
  const [moduleName, setModuleName] = useState<'wellness' | 'reminders' | 'academy' | 'emergency' | 'family_notes'>('wellness');
  const [sharingLevel, setSharingLevel] = useState<'PRIVATE' | 'LIMITED' | 'AUTHORIZED'>('LIMITED');
  const [actionDesc, setActionDesc] = useState('Share weekly wellness summary without private notes');

  const load = async () => {
    try {
      const data = await apiFetch<{ consents: ConsentRecord[]; privacyHistory: PrivacyAudit[] }>('/api/autonomy/consents');
      setConsents(data.consents);
      setHistory(data.privacyHistory);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Autonomy Engine.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/autonomy/consents', {
        method: 'POST',
        body: JSON.stringify({
          granteeEmail,
          moduleName,
          sharingLevel,
          actionDescription: actionDesc,
        }),
      });
      setGranteeEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record consent.');
    }
  };

  const decide = async (id: string, status: 'approved' | 'rejected' | 'revoked') => {
    await apiFetch(`/api/autonomy/consents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await load();
  };

  return (
    <Layout title="Autonomy Engine & Consent Control">
      <div className="space-y-8">
        {error && <ErrorBanner message={error} onRetry={load} />}

        {/* Explanation of Three Tiers */}
        <section className="grid md:grid-cols-3 gap-5">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-5 space-y-2">
            <div className="flex items-center gap-2 font-bold text-lg">
              <Lock className="w-5 h-5 text-[#0F2544] dark:text-teal-400" />
              PRIVATE
            </div>
            <p className="text-base text-slate-600 dark:text-slate-300">
              Only you can see this information. Caregivers and administrators cannot view it.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-5 space-y-2">
            <div className="flex items-center gap-2 font-bold text-lg">
              <SlidersHorizontal className="w-5 h-5 text-[#0F766E]" />
              LIMITED
            </div>
            <p className="text-base text-slate-600 dark:text-slate-300">
              Share only high-level summaries (like sleep hours or reminder status) while hiding personal notes.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-5 space-y-2">
            <div className="flex items-center gap-2 font-bold text-lg">
              <Shield className="w-5 h-5 text-[#0F766E]" />
              AUTHORIZED
            </div>
            <p className="text-base text-slate-600 dark:text-slate-300">
              Explicitly approved records shared with named caregivers. Private AI chats always remain private.
            </p>
          </div>
        </section>

        {/* Grant or Propose Consent */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
          <h2 className="text-2xl font-bold">Configure Module Sharing Permission</h2>
          <form onSubmit={createRule} className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="c-email" className="block text-base font-semibold mb-1">Caregiver Email</label>
                <input
                  id="c-email"
                  type="email"
                  required
                  value={granteeEmail}
                  onChange={(e) => setGranteeEmail(e.target.value)}
                  placeholder="caregiver@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                />
              </div>
              <div>
                <label htmlFor="c-mod" className="block text-base font-semibold mb-1">Module</label>
                <select
                  id="c-mod"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value as typeof moduleName)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                >
                  <option value="wellness">Wellness Summary</option>
                  <option value="reminders">Smart Reminders</option>
                  <option value="academy">Learning Progress</option>
                  <option value="emergency">Emergency Card</option>
                  <option value="family_notes">Family Notes</option>
                </select>
              </div>
              <div>
                <label htmlFor="c-level" className="block text-base font-semibold mb-1">Sharing Level</label>
                <select
                  id="c-level"
                  value={sharingLevel}
                  onChange={(e) => setSharingLevel(e.target.value as typeof sharingLevel)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                >
                  <option value="PRIVATE">PRIVATE</option>
                  <option value="LIMITED">LIMITED</option>
                  <option value="AUTHORIZED">AUTHORIZED</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="c-desc" className="block text-base font-semibold mb-1">Proposed Action Explanation</label>
              <input
                id="c-desc"
                type="text"
                required
                value={actionDesc}
                onChange={(e) => setActionDesc(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
              />
            </div>

            <button
              type="submit"
              className="px-7 py-3.5 rounded-xl bg-[#0F766E] text-white font-semibold text-lg cursor-pointer"
            >
              Save Consent Rule
            </button>
          </form>
        </section>

        {/* Active & Past Consent Records */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
          <h2 className="text-2xl font-bold">Your Consent Decisions</h2>
          {loading ? (
            <LoadingSkeleton rows={3} />
          ) : consents.length === 0 ? (
            <EmptyState
              title="All modules are currently private"
              description="You have not shared any module data yet. Everything stays strictly private until you approve a rule."
            />
          ) : (
            <div className="space-y-3">
              {consents.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <p className="font-bold text-lg">
                      {rec.module_name.toUpperCase()} · {rec.grantee_email}
                    </p>
                    <p className="text-base text-slate-600 dark:text-slate-300">
                      {rec.action_description} · Level: <span className="font-semibold">{rec.sharing_level}</span> · Status:{' '}
                      <span className="font-semibold uppercase">{rec.status}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {rec.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => decide(rec.id, 'approved')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F766E] text-white font-semibold cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => decide(rec.id, 'rejected')}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 font-semibold cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </>
                    )}
                    {rec.status === 'approved' && (
                      <button
                        type="button"
                        onClick={() => decide(rec.id, 'revoked')}
                        className="px-4 py-2 rounded-xl bg-red-700 text-white font-semibold cursor-pointer"
                      >
                        Revoke Permission
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Privacy History */}
        {history.length > 0 && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-3">
            <h2 className="text-2xl font-bold">Privacy Audit Trail</h2>
            <ul className="space-y-2 text-base">
              {history.map((h) => (
                <li key={h.id} className="flex justify-between border-b border-slate-100 dark:border-slate-800 py-2">
                  <span className="font-semibold">{h.action}</span>
                  <span className="font-mono-tabular text-slate-500">{h.created_at}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Layout>
  );
}
