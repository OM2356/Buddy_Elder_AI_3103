import React, { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Edit3, Plus, Trash2, X } from 'lucide-react';
import { Layout } from '../components/Layout';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { apiFetch } from '../lib/api';
import { syncReminderToFirestore } from '../lib/firebase';

interface Reminder {
  id: string;
  title: string;
  category: 'medication' | 'water' | 'exercise' | 'appointment' | 'learning' | 'family' | 'custom';
  schedule_time: string;
  recurring: 'none' | 'daily' | 'weekly';
  timezone: string;
  completed: number;
  last_completed_at?: string | null;
}

interface ReminderNotification {
  id: string;
  title: string;
  body: string;
  scheduled_for: string;
  status: string;
}

export default function RemindersPage() {
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notifications, setNotifications] = useState<ReminderNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Reminder['category']>('medication');
  const [scheduleTime, setScheduleTime] = useState('08:30');
  const [recurring, setRecurring] = useState<'none' | 'daily' | 'weekly'>('daily');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTime, setEditTime] = useState('08:30');
  const [editCategory, setEditCategory] = useState<Reminder['category']>('medication');
  const [editRecurring, setEditRecurring] = useState<'none' | 'daily' | 'weekly'>('daily');

  const [notifPermission, setNotifPermission] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const load = async () => {
    try {
      const data = await apiFetch<{ reminders: Reminder[]; notifications: ReminderNotification[] }>('/api/reminders');
      setReminders(data.reminders);
      setNotifications(data.notifications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reminders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const requestNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setNotifPermission('unsupported');
      return;
    }
    const res = await Notification.requestPermission();
    setNotifPermission(res);
  };

  const createReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const data = await apiFetch<{ reminder: Reminder }>('/api/reminders', {
      method: 'POST',
      body: JSON.stringify({ title, category, scheduleTime, recurring, timezone: browserTz }),
    });
    await syncReminderToFirestore({
      id: data.reminder.id,
      title,
      category,
      scheduleTime,
      recurring,
      completed: false,
      timezone: browserTz,
    }).catch(() => {});
    setTitle('');
    await load();
  };

  const startEdit = (r: Reminder) => {
    setEditingId(r.id);
    setEditTitle(r.title);
    setEditTime(r.schedule_time);
    setEditCategory(r.category);
    setEditRecurring(r.recurring);
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    await apiFetch(`/api/reminders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: editTitle,
        category: editCategory,
        scheduleTime: editTime,
        recurring: editRecurring,
      }),
    });
    setEditingId(null);
    await load();
  };

  const toggleComplete = async (r: Reminder) => {
    await apiFetch(`/api/reminders/${r.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: !r.completed }),
    });
    await load();
  };

  const removeReminder = async (id: string) => {
    await apiFetch(`/api/reminders/${id}`, { method: 'DELETE' });
    await load();
  };

  const dismissNotification = async (id: string) => {
    await apiFetch(`/api/reminders/notifications/${id}/dismiss`, { method: 'PATCH' });
    await load();
  };

  const filteredReminders = reminders.filter((r) => {
    if (filter === 'active') return r.completed === 0;
    if (filter === 'completed') return r.completed === 1;
    return true;
  });

  return (
    <Layout title="Smart Reminders">
      <div className="space-y-6">
        {error && <ErrorBanner message={error} onRetry={load} />}

        {/* Notification Permission Banner (Truthful delivery notice) */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-[#EFF6FF] dark:bg-slate-900 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="font-bold text-lg flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#0F766E]" />
              Browser Notifications: {notifPermission} · Timezone: <span className="font-mono-tabular">{browserTz}</span>
            </p>
            <p className="text-base text-slate-600 dark:text-slate-300">
              Note: Browser alerts can only display while this web page is open and notification permission is granted. Due reminders also appear below as in-app alerts.
            </p>
          </div>
          {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
            <button
              type="button"
              onClick={requestNotifications}
              className="px-5 py-2.5 rounded-xl bg-[#0F2544] dark:bg-teal-600 text-white font-semibold cursor-pointer"
            >
              Allow Browser Alerts
            </button>
          )}
        </section>

        {/* Due In-App Notifications */}
        {notifications.length > 0 && (
          <section className="rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-5 space-y-3">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-700 dark:text-amber-400" />
              Due Reminder Alerts (<span className="font-mono-tabular">{notifications.length}</span>)
            </h2>
            <div className="space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="rounded-xl bg-white dark:bg-[#111A2B] border border-amber-200 dark:border-amber-900 p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-lg">{n.title}</p>
                    <p className="text-base text-slate-600 dark:text-slate-300">{n.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissNotification(n.id)}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold text-sm cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Create Reminder */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
          <h2 className="text-2xl font-bold">Add a New Reminder</h2>
          <form onSubmit={createReminder} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div className="lg:col-span-2">
              <label htmlFor="rem-title" className="block text-base font-semibold mb-1">Reminder Title</label>
              <input
                id="rem-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Morning blood pressure tablet"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
              />
            </div>

            <div>
              <label htmlFor="rem-cat" className="block text-base font-semibold mb-1">Category</label>
              <select
                id="rem-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as Reminder['category'])}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
              >
                <option value="medication">Medication</option>
                <option value="water">Water / Hydration</option>
                <option value="exercise">Exercise / Walk</option>
                <option value="appointment">Appointment</option>
                <option value="learning">Learning</option>
                <option value="family">Family Event</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label htmlFor="rem-time" className="block text-base font-semibold mb-1">Time & Repeat</label>
              <div className="flex gap-2">
                <input
                  id="rem-time"
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                />
                <select
                  aria-label="Repeat schedule"
                  value={recurring}
                  onChange={(e) => setRecurring(e.target.value as 'none' | 'daily' | 'weekly')}
                  className="px-3 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-base"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="none">Once</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#0F766E] text-white font-semibold text-lg cursor-pointer"
            >
              <Plus className="w-5 h-5" /> Add
            </button>
          </form>
        </section>

        {/* Reminder List */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold">Your Schedule</h2>
            <div className="flex gap-2">
              {(['all', 'active', 'completed'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  className={`px-4 py-2 rounded-xl text-base font-semibold capitalize cursor-pointer ${
                    filter === tab
                      ? 'bg-[#0F2544] dark:bg-teal-600 text-white'
                      : 'border border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {tab === 'completed' ? 'Completed History' : tab}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <LoadingSkeleton rows={3} />
          ) : filteredReminders.length === 0 ? (
            <EmptyState
              title="No reminders in this view"
              description="Add a medication, hydration, walk, or family reminder above."
            />
          ) : (
            <div className="space-y-3">
              {filteredReminders.map((r) => (
                <div
                  key={r.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
                >
                  {editingId === r.id ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                      <input
                        type="text"
                        aria-label="Edit reminder title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="lg:col-span-2 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                      />
                      <select
                        aria-label="Edit category"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as Reminder['category'])}
                        className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-base"
                      >
                        <option value="medication">Medication</option>
                        <option value="water">Water</option>
                        <option value="exercise">Exercise</option>
                        <option value="appointment">Appointment</option>
                        <option value="learning">Learning</option>
                        <option value="family">Family</option>
                        <option value="custom">Custom</option>
                      </select>
                      <div className="flex gap-2">
                        <input
                          type="time"
                          aria-label="Edit time"
                          value={editTime}
                          onChange={(e) => setEditTime(e.target.value)}
                          className="px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-base"
                        />
                        <select
                          aria-label="Edit repeat"
                          value={editRecurring}
                          onChange={(e) => setEditRecurring(e.target.value as 'none' | 'daily' | 'weekly')}
                          className="px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-base"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="none">Once</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveEdit(r.id)}
                          className="px-4 py-2 rounded-xl bg-[#0F766E] text-white font-semibold cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer"
                          aria-label="Cancel edit"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className={`text-xl font-bold ${r.completed ? 'line-through opacity-60' : ''}`}>
                          {r.title}
                        </p>
                        <p className="text-base text-slate-600 dark:text-slate-300">
                          <span className="font-mono-tabular font-semibold">{r.schedule_time}</span> · {r.recurring} · {r.category} · {r.timezone}
                          {r.last_completed_at ? ` · Last done: ${r.last_completed_at.slice(0, 10)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleComplete(r)}
                          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold cursor-pointer ${
                            r.completed
                              ? 'bg-[#0F766E] text-white'
                              : 'border border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {r.completed ? 'Done' : 'Mark Done'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit ${r.title}`}
                          onClick={() => startEdit(r)}
                          className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer"
                        >
                          <Edit3 className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${r.title}`}
                          onClick={() => removeReminder(r.id)}
                          className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-red-700 dark:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
