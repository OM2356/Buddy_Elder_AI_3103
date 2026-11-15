import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ErrorBanner } from '../components/StateViews';
import { apiFetch } from '../lib/api';
import { sendFirebasePasswordReset } from '../lib/firebase';
import type { SupportedLang } from '../i18n/translations';

export default function LoginPage({ initialMode = 'login' }: { initialMode?: 'login' | 'register' }) {
  const {
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    user,
    redirectError,
    clearRedirectError,
  } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'senior' | 'caregiver'>('senior');
  const [preferredLanguage, setPreferredLanguage] = useState<SupportedLang>('en');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetRequested, setResetRequested] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (redirectError) {
      setError(redirectError);
      clearRedirectError();
    }
  }, [redirectError, clearRedirectError]);

  useEffect(() => {
    if (user) {
      const dest = user.role === 'admin' ? '/admin' : user.role === 'caregiver' ? '/caregiver' : '/dashboard';
      navigate(dest, { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else if (mode === 'register') {
        const res = await registerWithEmail({ email, password, fullName, role, preferredLanguage });
        if (res.emailVerificationSent) {
          setNotice('Account created! A verification email was sent to your inbox for cloud sync.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please verify your details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const [fbReset, backendData] = await Promise.all([
        sendFirebasePasswordReset(email).catch(() => ({ sent: false as const })),
        apiFetch<{
          message: string;
          devResetToken?: string;
          emailDeliveryConfigured?: boolean;
        }>('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        }).catch(() => null),
      ]);

      setResetRequested(Boolean(backendData));

      if (fbReset.sent && backendData?.emailDeliveryConfigured) {
        setNotice('Password reset instructions have been sent to your email inbox.');
      } else if (fbReset.sent) {
        setNotice(
          'A Firebase password reset link has been sent to your email inbox. Check your spam folder if you do not see it within a minute.'
        );
      } else if (backendData?.devResetToken) {
        setNotice(`${backendData.message} Local reset code: ${backendData.devResetToken}`);
      } else if (backendData?.message) {
        setNotice(backendData.message);
      } else {
        throw new Error('Unable to request password reset right now.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to request password reset.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const data = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      setNotice(data.message);
      setResetRequested(false);
      setResetToken('');
      setNewPassword('');
      setMode('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await loginWithGoogle(role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sign-In could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F0] dark:bg-[#0B1320] text-[#0F2544] dark:text-[#F4F7FB] flex flex-col justify-center p-6">
      <div className="max-w-xl w-full mx-auto space-y-6">
        <Link to="/" className="inline-flex items-center gap-2 text-lg font-semibold text-[#0F766E] dark:text-teal-400 hover:underline">
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          Back to Buddy Elder AI
        </Link>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-8 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#0F766E] dark:text-teal-400 font-semibold">
              <ShieldCheck className="w-6 h-6" aria-hidden="true" />
              <span>Protected Account Access</span>
            </div>
            <h1 className="font-display text-3xl font-bold">
              {mode === 'login'
                ? 'Sign in to Buddy Elder AI'
                : mode === 'register'
                ? 'Create your Buddy Elder AI account'
                : 'Reset your password'}
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300">
              Any valid Google account holder can register or sign in for cloud sync across devices, or use a private email & password account.
            </p>
          </div>

          {error && <ErrorBanner message={error} />}
          {notice && (
            <div className="rounded-xl border border-teal-300 dark:border-teal-800 bg-[#EFF6FF] dark:bg-slate-900 p-4 flex items-start gap-2.5 text-base font-medium break-all">
              <CheckCircle2 className="w-5 h-5 text-[#0F766E] shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          {/* Mode Tabs */}
          <div className="grid grid-cols-3 gap-2 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setNotice(null);
              }}
              className={`py-2.5 rounded-lg font-semibold text-base cursor-pointer transition-colors ${
                mode === 'login' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setNotice(null);
              }}
              className={`py-2.5 rounded-lg font-semibold text-base cursor-pointer transition-colors ${
                mode === 'register' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Create Account
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setError(null);
                setNotice(null);
              }}
              className={`py-2.5 rounded-lg font-semibold text-base cursor-pointer transition-colors ${
                mode === 'forgot' ? 'bg-white dark:bg-slate-900 shadow-sm' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              Reset Password
            </button>
          </div>

          {mode !== 'forgot' ? (
            <>
              {/* Google Sign-In */}
              <div className="space-y-3">
                {mode === 'register' && (
                  <div>
                    <label htmlFor="google-role" className="block text-base font-semibold mb-1">
                      I am joining as a:
                    </label>
                    <select
                      id="google-role"
                      value={role}
                      onChange={(e) => setRole(e.target.value as 'senior' | 'caregiver')}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                    >
                      <option value="senior">Senior Citizen</option>
                      <option value="caregiver">Caregiver / Family Member</option>
                    </select>
                  </div>
                )}

                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 font-semibold text-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z" />
                    <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z" />
                  </svg>
                  <span>Continue with Google (Firebase Auth)</span>
                </button>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
                <span className="shrink mx-4 text-base text-slate-500 dark:text-slate-400">or with email & password</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-700" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'register' && (
                  <>
                    <div>
                      <label htmlFor="fullName" className="block text-base font-semibold mb-1">
                        Full Name
                      </label>
                      <input
                        id="fullName"
                        type="text"
                        required
                        minLength={2}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Asha Kulkarni"
                        className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="roleSelect" className="block text-base font-semibold mb-1">
                          Account Role
                        </label>
                        <select
                          id="roleSelect"
                          value={role}
                          onChange={(e) => setRole(e.target.value as 'senior' | 'caregiver')}
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                        >
                          <option value="senior">Senior Citizen</option>
                          <option value="caregiver">Caregiver / Family</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="langSelect" className="block text-base font-semibold mb-1">
                          Preferred Language
                        </label>
                        <select
                          id="langSelect"
                          value={preferredLanguage}
                          onChange={(e) => setPreferredLanguage(e.target.value as SupportedLang)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                        >
                          <option value="en">English</option>
                          <option value="hi">हिन्दी (Hindi)</option>
                          <option value="mr">मराठी (Marathi)</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="email" className="block text-base font-semibold mb-1">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-base font-semibold mb-1">
                    Password {mode === 'register' && '(minimum 8 characters)'}
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    minLength={mode === 'register' ? 8 : 1}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 rounded-xl bg-[#0F2544] dark:bg-teal-600 text-white text-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              </form>
            </>
          ) : (
            <div className="space-y-5">
              <form onSubmit={handleRequestReset} className="space-y-4">
                <div>
                  <label htmlFor="reset-email" className="block text-base font-semibold mb-1">
                    Account Email Address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-[#0F766E] text-white text-lg font-semibold cursor-pointer"
                >
                  {submitting ? 'Generating...' : 'Request Reset Code'}
                </button>
              </form>

              {resetRequested && (
                <form onSubmit={handleCompleteReset} className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div>
                    <label htmlFor="reset-code" className="block text-base font-semibold mb-1">
                      Reset Code
                    </label>
                    <input
                      id="reset-code"
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Paste reset code"
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg font-mono-tabular"
                    />
                  </div>
                  <div>
                    <label htmlFor="reset-new-pwd" className="block text-base font-semibold mb-1">
                      New Password (minimum 8 characters)
                    </label>
                    <input
                      id="reset-new-pwd"
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
                    disabled={submitting}
                    className="w-full py-3.5 rounded-xl bg-[#0F2544] dark:bg-teal-600 text-white text-lg font-semibold cursor-pointer"
                  >
                    {submitting ? 'Updating...' : 'Set New Password'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
