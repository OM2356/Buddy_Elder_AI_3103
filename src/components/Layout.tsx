import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  FileSearch,
  GraduationCap,
  HeartPulse,
  Home,
  Lock,
  LogOut,
  Menu,
  MessageSquareHeart,
  Moon,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Users,
  Volume2,
  X,
  UserCog,
  PhoneCall,
  Settings,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAccessibility, type TextSize } from '../context/AccessibilityContext';
import type { SupportedLang } from '../i18n/translations';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: 'emergency';
}

export function Layout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const { t, language, setLanguage, textSize, setTextSize, theme, setTheme } = useAccessibility();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const seniorNav: NavItem[] = [
    { to: '/dashboard', label: t.nav.home, icon: Home },
    { to: '/assistant', label: t.nav.assistant, icon: MessageSquareHeart },
    { to: '/scam-shield', label: t.nav.scamShield, icon: ShieldAlert },
    { to: '/ocr-reader', label: t.nav.ocrReader, icon: Volume2 },
    { to: '/wellness', label: t.nav.wellness, icon: HeartPulse },
    { to: '/academy', label: t.nav.academy, icon: GraduationCap },
    { to: '/research', label: t.nav.research, icon: FileSearch },
    { to: '/reminders', label: t.nav.reminders, icon: Bell },
    { to: '/family', label: t.nav.family, icon: Users },
    { to: '/autonomy', label: t.nav.autonomy, icon: SlidersHorizontal },
    { to: '/emergency', label: t.nav.emergency, icon: PhoneCall, highlight: 'emergency' },
    { to: '/backup', label: t.nav.backup, icon: Lock },
    { to: '/settings', label: t.nav.settings, icon: Settings },
  ];

  const caregiverNav: NavItem[] = [
    { to: '/caregiver', label: t.nav.caregiver, icon: Users },
    { to: '/family', label: t.nav.family, icon: ShieldCheck },
    { to: '/assistant', label: t.nav.assistant, icon: MessageSquareHeart },
    { to: '/research', label: t.nav.research, icon: BookOpen },
    { to: '/emergency', label: t.nav.emergency, icon: PhoneCall, highlight: 'emergency' },
    { to: '/backup', label: t.nav.backup, icon: Lock },
    { to: '/settings', label: t.nav.settings, icon: Settings },
  ];

  const adminNav: NavItem[] = [
    { to: '/admin', label: t.nav.admin, icon: UserCog },
    { to: '/academy', label: t.nav.academy, icon: GraduationCap },
    { to: '/research', label: t.nav.research, icon: BookOpen },
    { to: '/assistant', label: t.nav.assistant, icon: MessageSquareHeart },
    { to: '/scam-shield', label: t.nav.scamShield, icon: ShieldAlert },
    { to: '/settings', label: t.nav.settings, icon: Settings },
  ];

  const navItems =
    user?.role === 'admin' ? adminNav : user?.role === 'caregiver' ? caregiverNav : seniorNav;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between p-4 gap-5">
      <div className="space-y-4">
        <div className="px-2 pt-1 pb-3 border-b border-slate-200 dark:border-slate-800">
          <p className="font-display text-2xl font-bold text-[#0F2544] dark:text-white tracking-tight">
            {t.brand}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            {user?.full_name} · {user?.role}
          </p>
        </div>

        <nav aria-label="Primary navigation" className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-[18px] transition-colors whitespace-nowrap ${
                    item.highlight === 'emergency'
                      ? isActive
                        ? 'bg-red-700 text-white'
                        : 'text-red-800 dark:text-red-300 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50'
                      : isActive
                      ? 'bg-[#0F2544] dark:bg-teal-600 text-white'
                      : 'text-[#0F2544] dark:text-slate-200 hover:bg-[#EFF6FF] dark:hover:bg-slate-800'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="space-y-2">
          <label htmlFor="a11y-lang" className="block text-sm font-semibold text-slate-600 dark:text-slate-300">
            {t.common.language}
          </label>
          <select
            id="a11y-lang"
            value={language}
            onChange={(e) => setLanguage(e.target.value as SupportedLang)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[#0F2544] dark:text-white text-base"
          >
            <option value="en">English</option>
            <option value="hi">हिन्दी (Hindi)</option>
            <option value="mr">मराठी (Marathi)</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl" role="group" aria-label={t.common.textSize}>
            {(['normal', 'large', 'xlarge'] as TextSize[]).map((sz, i) => (
              <button
                key={sz}
                type="button"
                onClick={() => setTextSize(sz)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold cursor-pointer transition-colors ${
                  textSize === sz
                    ? 'bg-white dark:bg-slate-700 text-[#0F2544] dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
                aria-label={`Set text size ${sz}`}
              >
                {i === 0 ? 'A' : i === 1 ? 'A+' : 'A++'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 text-base font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <LogOut className="w-5 h-5" aria-hidden="true" />
          {t.nav.signOut}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#FAF7F0] dark:bg-[#0B1320] text-[#0F2544] dark:text-[#F4F7FB]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-[#0F766E] focus:text-white"
      >
        Skip to main content
      </a>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[280px] shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B]">
        <div className="sticky top-0 h-screen overflow-y-auto">{sidebarContent}</div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white dark:bg-[#111A2B] border-b border-slate-200 dark:border-slate-800">
        <span className="font-display text-xl font-bold whitespace-nowrap">{t.brand}</span>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          <span>Menu</span>
        </button>
      </header>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="w-[300px] max-w-[85vw] h-full bg-white dark:bg-[#111A2B] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#111A2B]/70 px-6 py-4 flex items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">{title}</h1>
          <button
            type="button"
            onClick={() => navigate('/emergency')}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-700 text-white text-base font-semibold hover:bg-red-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PhoneCall className="w-4 h-4" aria-hidden="true" />
            SOS Help
          </button>
        </div>

        <main id="main-content" className="flex-1 p-5 sm:p-8 max-w-[1200px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
