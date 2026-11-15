import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, HeartPulse, PhoneCall, ShieldCheck, Volume2 } from 'lucide-react';
import { SafeImage } from '../components/StateViews';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const { user } = useAuth();
  const { t } = useAccessibility();
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
      {/* Top Bar Contract: 3 zones only */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#111A2B]/90 sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <Link to="/" className="font-display text-2xl font-bold tracking-tight whitespace-nowrap shrink-0">
            {t.brand}
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-lg font-medium text-slate-700 dark:text-slate-300" aria-label="Landing navigation">
            <Link to="/features" className="hover:text-[#0F766E] dark:hover:text-teal-400 transition-colors whitespace-nowrap shrink-0">
              Features
            </Link>
            <Link to="/about" className="hover:text-[#0F766E] dark:hover:text-teal-400 transition-colors whitespace-nowrap shrink-0">
              About
            </Link>
            <a href="#safety" className="hover:text-[#0F766E] dark:hover:text-teal-400 transition-colors whitespace-nowrap shrink-0">
              Scam Shield
            </a>
            <a href="#academy" className="hover:text-[#0F766E] dark:hover:text-teal-400 transition-colors whitespace-nowrap shrink-0">
              Academy
            </a>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => navigate(startPath)}
              className="px-6 py-2.5 rounded-xl bg-[#0F2544] dark:bg-teal-600 text-white text-lg font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
            >
              {user ? 'Open Workspace' : 'Sign In'}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Split */}
      <section className="max-w-[1200px] mx-auto px-6 py-12 lg:py-16 grid lg:grid-cols-12 gap-10 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
          <p className="text-base font-semibold text-[#0F766E] dark:text-teal-400 tracking-wide">
            {t.tagline} · English · हिन्दी · मराठी
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight text-[#0F2544] dark:text-white">
            Technology that respects your pace, privacy, and independence.
          </h1>
          <p className="text-[21px] text-slate-700 dark:text-slate-300 leading-relaxed max-w-2xl">
            Buddy Elder AI brings together a patient voice-friendly assistant, Scam Shield fraud protection, paper-to-audio reading, daily wellness tracking, and consent-controlled family connection in one clear workspace.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => navigate(startPath)}
              className="inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-[#0F766E] text-white text-xl font-semibold hover:bg-[#0D635D] transition-colors cursor-pointer"
            >
              <span>{user ? 'Go to My Dashboard' : 'Get Started Free'}</span>
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </button>
            <a
              href="#safety"
              className="inline-flex items-center gap-2 px-6 py-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Explore Safety Tools
            </a>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="h-full min-h-[300px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <SafeImage
              src="/src/assets/images/hero_elder_companion_1794748934555.jpg"
              alt="Senior couple smiling together while using a tablet at a sunlit wooden table"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Core Pillars */}
      <section id="features" className="max-w-[1200px] mx-auto px-6 py-10">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
            <Volume2 className="w-7 h-7 text-[#0F766E] dark:text-teal-400" aria-hidden="true" />
            <h2 className="text-xl font-bold">Multilingual Voice AI</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Speak or type in English, Hindi, or Marathi. Adjust text size, reading speed, and simplify answers anytime.
            </p>
          </div>
          <div id="safety" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
            <ShieldCheck className="w-7 h-7 text-[#0F766E] dark:text-teal-400" aria-hidden="true" />
            <h2 className="text-xl font-bold">Scam Shield</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Inspect suspicious SMS, WhatsApp forwards, UPI PIN requests, and links with India 1930 reporting guidance.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
            <HeartPulse className="w-7 h-7 text-[#0F766E] dark:text-teal-400" aria-hidden="true" />
            <h2 className="text-xl font-bold">Daily Wellness & OCR</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Scan printed prescriptions or bills to hear them read aloud, and track sleep, water, and mood privately.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
            <PhoneCall className="w-7 h-7 text-red-700 dark:text-red-400" aria-hidden="true" />
            <h2 className="text-xl font-bold">Senior-Controlled SOS</h2>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Quick access to 112, 108, and 1930 with strict double confirmation—never dials or shares location silently.
            </p>
          </div>
        </div>
      </section>

      {/* Academy & Family Visual Showcase */}
      <section id="academy" className="max-w-[1200px] mx-auto px-6 py-10 grid md:grid-cols-3 gap-6">
        <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="aspect-[4/3]">
            <SafeImage
              src="/src/assets/images/academy_digital_learning_1794748934330.jpg"
              alt="Smartphone on an oak desk next to reading glasses and notebook"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-6 space-y-2 flex-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">13 Courses · Virtual Phone Simulator</p>
            <h3 className="text-2xl font-bold">Digital Learning Academy</h3>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Practice WhatsApp, UPI safety, Google Maps, and video calls in a safe step-by-step simulator.
            </p>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="aspect-[4/3]">
            <SafeImage
              src="/src/assets/images/wellness_morning_routine_1794748935028.jpg"
              alt="Herbal tea, glass of water, and wellness journal on linen table"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-6 space-y-2 flex-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">Daily Check-ins · Verified Research</p>
            <h3 className="text-2xl font-bold">Wellness & Knowledge Hub</h3>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Gentle hydration and routine reminders paired with WHO, RBI, and CERT-In evidence summaries.
            </p>
          </div>
        </article>

        <article id="family" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col">
          <div className="aspect-[4/3]">
            <SafeImage
              src="/src/assets/images/family_hub_connection_1794748937129.jpg"
              alt="Senior couple smiling on a family video call"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-6 space-y-2 flex-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">Private · Limited · Authorized</p>
            <h3 className="text-2xl font-bold">Autonomy & Family Hub</h3>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              You decide exactly what family caregivers can view and can revoke any permission with one tap.
            </p>
          </div>
        </article>
      </section>

      <footer className="border-t border-slate-200 dark:border-slate-800 mt-10 py-8 px-6">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-base text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#0F766E]" aria-hidden="true" />
            <span>Buddy Elder AI · Verified Indian Helplines: 112 (Emergency) · 108 (Ambulance) · 1930 (Cyber Fraud)</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link to="/features" className="hover:underline">Features</Link>
            <Link to="/about" className="hover:underline">About</Link>
            <Link to="/register" className="font-semibold text-[#0F2544] dark:text-teal-400 hover:underline">
              Create Account
            </Link>
            <Link to="/login" className="font-semibold text-[#0F2544] dark:text-teal-400 hover:underline">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
