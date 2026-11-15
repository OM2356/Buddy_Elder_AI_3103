import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Layout } from '../components/Layout';
import { ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { apiFetch } from '../lib/api';

interface AdminOverview {
  privacyNotice: string;
  systemHealth: { database: string; geminiConfigured: boolean; uptimeSeconds: number };
  stats: {
    totalUsers: number;
    seniors: number;
    caregivers: number;
    totalScamChecks: number;
    totalCourses: number;
    totalResearchPapers: number;
    totalConsentGrants: number;
  };
  users: { id: string; email: string; full_name: string; role: 'senior' | 'caregiver' | 'admin'; is_active: number }[];
  courses: { id: string; title: string; category: string; difficulty: string }[];
  research: { id: string; title: string; authors: string; topic: string; published_year: number }[];
  feedback: { id: string; full_name: string; category: string; rating: number; message: string; status: string }[];
  auditLogs: { id: string; action: string; target_type: string; target_id: string; created_at: string }[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add Course form
  const [courseTitle, setCourseTitle] = useState('');
  const [courseCategory, setCourseCategory] = useState('Safety & Privacy');
  const [courseDesc, setCourseDesc] = useState('');

  const load = async () => {
    try {
      const res = await apiFetch<AdminOverview & { ok: true }>('/api/admin/overview');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleUserActive = async (id: string, currentActive: number) => {
    await apiFetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !currentActive }),
    });
    await load();
  };

  const resolveFeedback = async (id: string) => {
    await apiFetch(`/api/admin/feedback/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'resolved', adminReply: 'Reviewed by administration.' }),
    });
    await load();
  };

  const addCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/admin/courses', {
      method: 'POST',
      body: JSON.stringify({
        title: courseTitle,
        category: courseCategory,
        difficulty: 'Beginner',
        description: courseDesc,
        estimatedMinutes: 15,
      }),
    });
    setCourseTitle('');
    setCourseDesc('');
    await load();
  };

  return (
    <Layout title="Administrator Operations Console">
      <div className="space-y-8">
        {error && <ErrorBanner message={error} onRetry={load} />}

        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : (
          data && (
            <>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#EFF6FF] dark:bg-slate-900 p-5 flex items-start gap-3">
                <ShieldCheck className="w-6 h-6 text-[#0F766E] shrink-0 mt-0.5" />
                <p className="text-lg">{data.privacyNotice}</p>
              </div>

              {/* System Health & Analytics */}
              <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-5">
                  <p className="text-sm text-slate-500">Total Users</p>
                  <p className="text-3xl font-bold font-mono-tabular mt-1">{data.stats.totalUsers}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    {data.stats.seniors} seniors · {data.stats.caregivers} caregivers
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-5">
                  <p className="text-sm text-slate-500">Scam Checks</p>
                  <p className="text-3xl font-bold font-mono-tabular mt-1">{data.stats.totalScamChecks}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-5">
                  <p className="text-sm text-slate-500">Published Courses & Papers</p>
                  <p className="text-3xl font-bold font-mono-tabular mt-1">
                    {data.stats.totalCourses} / {data.stats.totalResearchPapers}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-5">
                  <p className="text-sm text-slate-500">System Health</p>
                  <p className="text-xl font-bold mt-1">DB: {data.systemHealth.database}</p>
                  <p className="text-sm font-mono-tabular text-slate-500">
                    Gemini: {data.systemHealth.geminiConfigured ? 'Configured' : 'Unconfigured'} · Uptime {data.systemHealth.uptimeSeconds}s
                  </p>
                </div>
              </section>

              {/* User Directory */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4 overflow-x-auto">
                <h2 className="text-2xl font-bold">User & Caregiver Accounts</h2>
                <table className="w-full text-left border-collapse text-base">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((u) => (
                      <tr key={u.id} className="border-b border-slate-100 dark:border-slate-800/60">
                        <td className="py-2.5 pr-4 font-semibold">{u.full_name}</td>
                        <td className="py-2.5 pr-4">{u.email}</td>
                        <td className="py-2.5 pr-4 uppercase text-sm font-mono-tabular">{u.role}</td>
                        <td className="py-2.5 pr-4">{u.is_active ? 'Active' : 'Suspended'}</td>
                        <td className="py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleUserActive(u.id, u.is_active)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold cursor-pointer"
                          >
                            {u.is_active ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* Publish Course */}
              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
                <h2 className="text-2xl font-bold">Add Academy Course</h2>
                <form onSubmit={addCourse} className="grid sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={courseTitle}
                    onChange={(e) => setCourseTitle(e.target.value)}
                    placeholder="Course title"
                    className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <input
                    type="text"
                    required
                    value={courseCategory}
                    onChange={(e) => setCourseCategory(e.target.value)}
                    placeholder="Category"
                    className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <input
                    type="text"
                    required
                    minLength={10}
                    value={courseDesc}
                    onChange={(e) => setCourseDesc(e.target.value)}
                    placeholder="Course description"
                    className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-[#0F766E] text-white font-semibold cursor-pointer"
                    >
                      Publish Course
                    </button>
                  </div>
                </form>
              </section>

              {/* Feedback & Security Audit Logs */}
              <div className="grid lg:grid-cols-2 gap-6">
                <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-3">
                  <h2 className="text-2xl font-bold">User Feedback</h2>
                  {data.feedback.length === 0 ? (
                    <p className="text-base text-slate-500">No feedback submitted yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {data.feedback.map((f) => (
                        <li key={f.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-2">
                          <div className="flex justify-between text-sm text-slate-500">
                            <span>{f.full_name} · {f.category}</span>
                            <span>Status: {f.status}</span>
                          </div>
                          <p className="text-base">{f.message}</p>
                          {f.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => resolveFeedback(f.id)}
                              className="px-3 py-1 rounded-lg bg-[#0F2544] text-white text-sm font-semibold cursor-pointer"
                            >
                              Mark Resolved
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-3">
                  <h2 className="text-2xl font-bold">Security Audit Logs</h2>
                  <ul className="space-y-2 max-h-[340px] overflow-y-auto text-sm">
                    {data.auditLogs.map((log) => (
                      <li key={log.id} className="flex justify-between gap-3 border-b border-slate-100 dark:border-slate-800 py-1.5">
                        <span className="font-mono-tabular font-semibold">{log.action}</span>
                        <span className="font-mono-tabular text-slate-500">{log.created_at}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </>
          )
        )}
      </div>
    </Layout>
  );
}
