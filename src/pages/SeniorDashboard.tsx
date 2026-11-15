import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  GraduationCap,
  HeartPulse,
  MessageSquareHeart,
  PhoneCall,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Volume2,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { syncFeedbackToFirestore } from '../lib/firebase';

export default function SeniorDashboard() {
  const { user } = useAuth();
  const { t } = useAccessibility();
  const navigate = useNavigate();

  const [remindersDue, setRemindersDue] = useState<number>(0);
  const [recentScams, setRecentScams] = useState<number>(0);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackCategory, setFeedbackCategory] = useState<'suggestion' | 'accessibility' | 'bug' | 'praise'>('praise');
  const [feedbackSent, setFeedbackSent] = useState(false);

  useEffect(() => {
    apiFetch<{ reminders: { completed: number }[] }>('/api/reminders')
      .then((d) => setRemindersDue(d.reminders.filter((r) => !r.completed).length))
      .catch(() => {});
    apiFetch<{ history: unknown[] }>('/api/scam/history')
      .then((d) => setRecentScams(d.history.length))
      .catch(() => {});
  }, []);

  const submitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMsg.trim()) return;
    const res = await apiFetch<{ feedback?: { id: string } }>('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ category: feedbackCategory, rating: 5, message: feedbackMsg }),
    });
    await syncFeedbackToFirestore({
      id: res.feedback?.id || `fbk_${Date.now()}`,
      category: feedbackCategory,
      rating: 5,
      message: feedbackMsg,
    }).catch(() => {});
    setFeedbackMsg('');
    setFeedbackSent(true);
    setTimeout(() => setFeedbackSent(false), 4000);
  };

  const quickActions = [
    {
      title: t.home.ctaAssistant,
      desc: 'Chat by typing or voice in English, Hindi, or Marathi.',
      to: '/assistant',
      icon: MessageSquareHeart,
      accent: 'bg-[#0F2544] text-white dark:bg-teal-600',
    },
    {
      title: t.home.ctaScam,
      desc: `Analyze suspicious SMS, WhatsApp, or UPI messages (${recentScams} checked).`,
      to: '/scam-shield',
      icon: ShieldAlert,
      accent: 'bg-[#0F766E] text-white',
    },
    {
      title: 'Read Printed Page Aloud',
      desc: 'Upload or capture a letter, medicine label, or bill with OCR.',
      to: '/ocr-reader',
      icon: Volume2,
      accent: 'bg-[#EFF6FF] text-[#0F2544] dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700',
    },
    {
      title: 'Daily Wellness Check-In',
      desc: 'Log mood, water, and sleep with private sharing settings.',
      to: '/wellness',
      icon: HeartPulse,
      accent: 'bg-[#EFF6FF] text-[#0F2544] dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700',
    },
    {
      title: 'Digital Learning Academy',
      desc: '13 step-by-step courses with virtual smartphone simulator.',
      to: '/academy',
      icon: GraduationCap,
      accent: 'bg-white text-[#0F2544] dark:bg-slate-900 dark:text-white border border-slate-200 dark:border-slate-800',
    },
    {
      title: `Smart Reminders (${remindersDue} active)`,
      desc: 'Track medications, hydration, walks, and family events.',
      to: '/reminders',
      icon: Bell,
      accent: 'bg-white text-[#0F2544] dark:bg-slate-900 dark:text-white border border-slate-200 dark:border-slate-800',
    },
    {
      title: 'Autonomy & Privacy Control',
      desc: 'Review or revoke what family caregivers can view.',
      to: '/autonomy',
      icon: SlidersHorizontal,
      accent: 'bg-white text-[#0F2544] dark:bg-slate-900 dark:text-white border border-slate-200 dark:border-slate-800',
    },
    {
      title: t.home.ctaEmergency,
      desc: '112 / 108 / 1930 helplines and confirmed emergency contacts.',
      to: '/emergency',
      icon: PhoneCall,
      accent: 'bg-red-700 text-white',
    },
  ];

  return (
    <Layout title={`Welcome, ${user?.full_name || 'Friend'}`}>
      <div className="space-y-8">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 sm:p-8 space-y-2">
          <h2 className="font-display text-3xl font-bold">{t.home.greeting}</h2>
          <p className="text-xl text-slate-600 dark:text-slate-300">{t.home.subtitle}</p>
        </section>

        <section aria-label="Quick Actions" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => navigate(item.to)}
                className={`text-left rounded-2xl p-6 space-y-3 transition-transform hover:-translate-y-0.5 cursor-pointer ${item.accent}`}
              >
                <Icon className="w-8 h-8" aria-hidden="true" />
                <h3 className="text-2xl font-bold">{item.title}</h3>
                <p className="text-lg opacity-90">{item.desc}</p>
              </button>
            );
          })}
        </section>

        {/* Simple Feedback Box */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
          <h3 className="text-2xl font-bold">Share Feedback with Our Team</h3>
          <form onSubmit={submitFeedback} className="flex flex-col sm:flex-row gap-3">
            <select
              aria-label="Feedback category"
              value={feedbackCategory}
              onChange={(e) => setFeedbackCategory(e.target.value as typeof feedbackCategory)}
              className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
            >
              <option value="praise">Appreciation</option>
              <option value="suggestion">Suggestion</option>
              <option value="accessibility">Accessibility</option>
              <option value="bug">Issue Report</option>
            </select>
            <input
              type="text"
              value={feedbackMsg}
              onChange={(e) => setFeedbackMsg(e.target.value)}
              placeholder="Tell us how we can make Buddy easier to use..."
              className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0F766E] text-white font-semibold hover:bg-[#0D635D] cursor-pointer"
            >
              <Send className="w-5 h-5" aria-hidden="true" />
              Send
            </button>
          </form>
          {feedbackSent && <p className="text-teal-700 dark:text-teal-400 font-semibold">Thank you! Your feedback has been recorded.</p>}
        </section>
      </div>
    </Layout>
  );
}
