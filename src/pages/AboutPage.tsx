import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, HeartHandshake, Lock, PhoneCall, ShieldCheck } from 'lucide-react';
import { SafeImage } from '../components/StateViews';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';

export default function AboutPage() {
  const { t } = useAccessibility();
  const { user } = useAuth();
  const navigate = useNavigate();

  const startPath = user
    ? user.role === 'admin'
      ? '/admin'
      : user.role === 'caregiver'
      ? '/caregiver'
      : '/dashboard'
    : '/login';

  return (
    <div className="min-h-screen bg-[#FAF7F0] dark:bg-[#0B1320] text-[#0F2544] dark:text-[#F4F7FB]">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#111A2B]/90 sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <Link to="/" className="font-display text-2xl font-bold tracking-tight whitespace-nowrap shrink-0">
            {t.brand}
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-lg font-medium text-slate-700 dark:text-slate-300" aria-label="Public navigation">
            <Link to="/features" className="hover:text-[#0F766E] dark:hover:text-teal-400 transition-colors whitespace-nowrap shrink-0">
              Features
            </Link>
            <Link to="/about" className="text-[#0F766E] dark:text-teal-400 font-semibold whitespace-nowrap shrink-0">
              About
            </Link>
            <Link to="/register" className="hover:text-[#0F766E] dark:hover:text-teal-400 transition-colors whitespace-nowrap shrink-0">
              Register
            </Link>
          </nav>
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => navigate(startPath)}
              className="px-6 py-2.5 rounded-xl bg-[#0F2544] dark:bg-teal-600 text-white text-lg font-semibold hover:opacity-90 cursor-pointer whitespace-nowrap"
            >
              {user ? 'Open Workspace' : 'Sign In'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto px-6 py-10 space-y-10">
        <Link to="/" className="inline-flex items-center gap-2 text-lg font-semibold text-[#0F766E] dark:text-teal-400 hover:underline">
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          Back to Home
        </Link>

        <section className="grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight">
              Built around dignity, digital independence, and family trust.
            </h1>
            <p className="text-[21px] text-slate-700 dark:text-slate-300 leading-relaxed">
              Buddy Elder AI is a unified digital companion created for older adults, caring families, and community administrators. Every feature is designed with clear typography, English, Hindi, and Marathi support, and strict consent boundaries.
            </p>
          </div>
          <div className="lg:col-span-5 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <SafeImage
              src="/images/family-hub-connection.jpg"
              alt="Older adults connecting cheerfully with family over video"
              width={1200}
              height={896}
              loading="eager"
              className="w-full h-full object-cover aspect-[4/3]"
            />
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6">
          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-3">
            <Lock className="w-7 h-7 text-[#0F766E] dark:text-teal-400" aria-hidden="true" />
            <h2 className="text-2xl font-bold">Autonomy First</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Caregivers never see private AI chats, personal journal notes, or health details unless the senior explicitly authorizes sharing via the Autonomy Engine.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-3">
            <ShieldCheck className="w-7 h-7 text-[#0F766E] dark:text-teal-400" aria-hidden="true" />
            <h2 className="text-2xl font-bold">Honest AI & Safety</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Buddy never fabricates medical diagnoses, never prescribes medicine, never guarantees suspicious URLs are safe, and never invents research citations.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-3">
            <HeartHandshake className="w-7 h-7 text-[#0F766E] dark:text-teal-400" aria-hidden="true" />
            <h2 className="text-2xl font-bold">Three Role Experiences</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Senior citizens get full daily tools, caregivers receive consent-filtered summaries and family notes, and admins manage courses and system health safely.
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/20 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-red-900 dark:text-red-300">
              <PhoneCall className="w-6 h-6" aria-hidden="true" />
              Verified Indian Emergency & Cyber Helplines
            </h2>
            <p className="text-lg text-slate-700 dark:text-slate-300">
              112 (National Emergency) · 108 (Ambulance) · 1930 (Cyber Financial Fraud Helpline & cybercrime.gov.in)
            </p>
          </div>
          <Link
            to="/register"
            className="px-6 py-3 rounded-xl bg-[#0F766E] text-white font-semibold text-lg whitespace-nowrap shrink-0"
          >
            Create Free Account
          </Link>
        </section>
      </main>
    </div>
  );
}
