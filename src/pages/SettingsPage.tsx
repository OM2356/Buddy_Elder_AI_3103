import React, { useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Save, UserCheck, Volume2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { ErrorBanner } from '../components/StateViews';
import { useAccessibility, type TextSize, type ThemeMode } from '../context/AccessibilityContext';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import type { SupportedLang } from '../i18n/translations';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const {
    language,
    setLanguage,
    textSize,
    setTextSize,
    theme,
    setTheme,
    speechRate,
    speechVolume,
    voiceLang,
    setSpeechSettings,
  } = useAccessibility();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [rate, setRate] = useState(speechRate);
  const [volume, setVolume] = useState(speechVolume);
  const [vLang, setVLang] = useState(voiceLang);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ user: { full_name: string }; profile?: { phone?: string; city?: string } }>('/api/auth/me')
      .then((d) => {
        if (d.user?.full_name) setFullName(d.user.full_name);
        if (d.profile?.phone) setPhone(d.profile.phone);
        if (d.profile?.city) setCity(d.profile.city);
      })
      .catch(() => {});
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ fullName, preferredLanguage: language, phone, city }),
      });
      await refreshUser();
      setNotice('Your profile details were updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveSpeech = () => {
    setSpeechSettings(rate, volume, vLang, true);
    setNotice('Accessibility and voice reading defaults saved.');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPassword(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setNotice('Your password has been updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <Layout title="Account & Accessibility Settings">
      <div className="space-y-8">
        {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
        {notice && (
          <div className="rounded-2xl border border-teal-300 dark:border-teal-800 bg-[#EFF6FF] dark:bg-slate-900 p-4 flex items-center gap-3 text-lg font-medium">
            <CheckCircle2 className="w-6 h-6 text-[#0F766E] shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Profile Information */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-[#0F766E]" />
            <h2 className="text-2xl font-bold">Personal Profile</h2>
          </div>

          <form onSubmit={saveProfile} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="set-name" className="block text-base font-semibold mb-1">Full Name</label>
                <input
                  id="set-name"
                  type="text"
                  required
                  minLength={2}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                />
              </div>
              <div>
                <label htmlFor="set-email" className="block text-base font-semibold mb-1">Account Email & Role</label>
                <input
                  id="set-email"
                  type="text"
                  disabled
                  value={`${user?.email || ''} (${user?.role || ''})`}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/60 text-lg opacity-80"
                />
              </div>
              <div>
                <label htmlFor="set-phone" className="block text-base font-semibold mb-1">Phone Number</label>
                <input
                  id="set-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 ..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                />
              </div>
              <div>
                <label htmlFor="set-city" className="block text-base font-semibold mb-1">City</label>
                <input
                  id="set-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Pune"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0F766E] text-white font-semibold text-lg cursor-pointer"
            >
              <Save className="w-5 h-5" />
              {savingProfile ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </section>

        {/* Display, Language & Voice Defaults */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Volume2 className="w-6 h-6 text-[#0F766E]" />
            <h2 className="text-2xl font-bold">Display, Language & Speech Defaults</h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="set-lang" className="block text-base font-semibold mb-1">Interface Language</label>
              <select
                id="set-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value as SupportedLang)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="mr">मराठी (Marathi)</option>
              </select>
            </div>

            <div>
              <label htmlFor="set-size" className="block text-base font-semibold mb-1">Text Size</label>
              <select
                id="set-size"
                value={textSize}
                onChange={(e) => setTextSize(e.target.value as TextSize)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
              >
                <option value="normal">Standard (20px)</option>
                <option value="large">Large (22px)</option>
                <option value="xlarge">Extra Large (24px)</option>
              </select>
            </div>

            <div>
              <label htmlFor="set-theme" className="block text-base font-semibold mb-1">Color Theme</label>
              <select
                id="set-theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeMode)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
              >
                <option value="light">Warm Daylight (Light)</option>
                <option value="dark">High-Contrast Night (Dark)</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            <div>
              <label htmlFor="set-rate" className="block text-base font-semibold mb-1">
                Voice Reading Speed: <span className="font-mono-tabular">{rate.toFixed(2)}x</span>
              </label>
              <input
                id="set-rate"
                type="range"
                min={0.6}
                max={1.4}
                step={0.05}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label htmlFor="set-vol" className="block text-base font-semibold mb-1">
                Voice Volume: <span className="font-mono-tabular">{Math.round(volume * 100)}%</span>
              </label>
              <input
                id="set-vol"
                type="range"
                min={0.1}
                max={1.0}
                step={0.1}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <label htmlFor="set-vlang" className="block text-base font-semibold mb-1">Default Voice Accent</label>
              <select
                id="set-vlang"
                value={vLang}
                onChange={(e) => setVLang(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
              >
                <option value="en-IN">English (India)</option>
                <option value="hi-IN">Hindi (India)</option>
                <option value="mr-IN">Marathi (India)</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={saveSpeech}
            className="px-6 py-3 rounded-xl bg-[#0F2544] dark:bg-teal-600 text-white font-semibold text-lg cursor-pointer"
          >
            Save Voice & Accessibility Defaults
          </button>
        </section>

        {/* Password Security */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-[#0F766E]" />
            <h2 className="text-2xl font-bold">Change Password</h2>
          </div>

          <form onSubmit={handlePasswordChange} className="grid sm:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="cur-pwd" className="block text-base font-semibold mb-1">Current Password</label>
              <input
                id="cur-pwd"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
              />
            </div>
            <div>
              <label htmlFor="new-pwd" className="block text-base font-semibold mb-1">New Password (8+ chars)</label>
              <input
                id="new-pwd"
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
              />
            </div>
            <button
              type="submit"
              disabled={savingPassword}
              className="px-6 py-3 rounded-xl bg-[#0F766E] text-white font-semibold text-lg cursor-pointer"
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </section>
      </div>
    </Layout>
  );
}
