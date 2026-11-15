import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  FileSearch,
  GraduationCap,
  HeartPulse,
  Lock,
  MessageSquareHeart,
  PhoneCall,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  Volume2,
} from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';

const MODULES = [
  {
    icon: MessageSquareHeart,
    title: 'AI Buddy Assistant',
    desc: 'Voice-friendly multilingual companion in English, Hindi, and Marathi with Simplify, Shorten, Examples, and Read Aloud controls.',
  },
  {
    icon: ShieldAlert,
    title: 'Scam Shield',
    desc: 'Inspect suspicious SMS, WhatsApp forwards, UPI QR requests, and customer-care numbers with India 1930 reporting guidance.',
  },
  {
    icon: Volume2,
    title: 'Audio & OCR Reader',
    desc: 'Capture printed letters or prescriptions via camera or upload, extract text with Tesseract OCR, and listen paragraph by paragraph.',
  },
  {
    icon: HeartPulse,
    title: 'Wellness Center',
    desc: 'Private daily mood, sleep, hydration, and light activity check-ins with weekly averages and non-diagnostic boundaries.',
  },
  {
    icon: Users,
    title: 'Family Hub',
    desc: 'Manage emergency trusted contacts, invite family caregivers by email, and review active family connections.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Autonomy Engine',
    desc: 'Centralized consent center where seniors approve, downgrade, or revoke PRIVATE / LIMITED / AUTHORIZED permissions with audit logs.',
  },
  {
    icon: GraduationCap,
    title: 'Digital Learning Academy',
    desc: '13 beginner-friendly courses with audio scripts, quizzes, progress tracking, and an interactive Virtual Smartphone Simulator.',
  },
  {
    icon: FileSearch,
    title: 'Research Knowledge Hub',
    desc: 'Curated WHO, RBI, CERT-In, NIH, HelpAge, and W3C library plus custom document upload with chunked RAG grounding.',
  },
  {
    icon: Bell,
    title: 'Smart Reminders',
    desc: 'Timezone-aware medication, hydration, walk, and appointment reminders with due-alert tracking and honest browser alert notices.',
  },
  {
    icon: PhoneCall,
    title: 'Emergency SOS',
    desc: 'Double-confirmed emergency screen with verified 112 / 108 / 1930 numbers, voluntary medical card, and permission-gated GPS.',
  },
  {
    icon: Lock,
    title: 'AES-256-GCM Backup',
    desc: 'Consent-gated encrypted JSON export and verified restore using per-export random IVs and SHA-256 integrity checks.',
  },
  {
    icon: BookOpen,
    title: 'Caregiver & Admin Portals',
    desc: 'Dedicated role dashboards that isolate private senior chats and notes while empowering family care and course administration.',
  },
];

export default function FeaturesPage() {
  const { t } = useAccessibility();
  const { user } = useAuth();
  const navigate = useNavigate();

  const startPath = user
    ? user.role === 'admin'
      ? '/admin'
      : user.role === 'caregiver'
      ? '/caregiver'
      : '/dashboard'
    : '/register';

  return (
    <div className="min-h-screen bg-[#FAF7F0] dark:bg-[#0B1320] text-[#0F2544] dark:text-[#F4F7FB]">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#111A2B]/90 sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <Link to="/" className="font-display text-2xl font-bold tracking-tight whitespace-nowrap shrink-0">
            {t.brand}
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-lg font-medium text-slate-700 dark:text-slate-300" aria-label="Public navigation">
            <Link to="/features" className="text-[#0F766E] dark:text-teal-400 font-semibold whitespace-nowrap shrink-0">
              Features
            </Link>
            <Link to="/about" className="hover:text-[#0F766E] dark:hover:text-teal-400 transition-colors whitespace-nowrap shrink-0">
              About
            </Link>
            <Link to="/register" className="hover:text-[#0F766E] dark:hover:text-teal-400 transition-colors whitespace-nowrap shrink-0">
              Register
            </Link>
          </nav>
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => navigate(user ? startPath : '/login')}
              className="px-6 py-2.5 rounded-xl bg-[#0F2544] dark:bg-teal-600 text-white text-lg font-semibold hover:opacity-90 cursor-pointer whitespace-nowrap"
            >
              {user ? 'Open Workspace' : 'Sign In'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-10 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link to="/" className="inline-flex items-center gap-2 text-lg font-semibold text-[#0F766E] dark:text-teal-400 hover:underline">
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            Back to Home
          </Link>
          <button
            type="button"
            onClick={() => navigate(startPath)}
            className="px-6 py-3 rounded-xl bg-[#0F766E] text-white text-lg font-semibold hover:bg-[#0D635D] cursor-pointer"
          >
            {user ? 'Go to Dashboard' : 'Create Free Account'}
          </button>
        </div>

        <div className="space-y-3 max-w-3xl">
          <h1 className="font-display text-4xl sm:text-5xl font-bold">
            Everything built for everyday senior confidence.
          </h1>
          <p className="text-[21px] text-slate-700 dark:text-slate-300">
            Explore all 12 integrated modules in Buddy Elder AI—accessible with large typography, voice reading, and high-contrast light or dark themes.
          </p>
        </div>

        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <article
                key={m.title}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-3"
              >
                <Icon className="w-7 h-7 text-[#0F766E] dark:text-teal-400" aria-hidden="true" />
                <h2 className="text-2xl font-bold">{m.title}</h2>
                <p className="text-lg text-slate-600 dark:text-slate-300 leading-relaxed">{m.desc}</p>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
