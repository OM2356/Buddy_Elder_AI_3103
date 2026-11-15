import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { apiFetch, setApiToken } from '../lib/api';
import {
  auth,
  consumeGoogleRedirectResult,
  registerWithFirebaseEmail,
  signInWithFirebaseEmail,
  signInWithGooglePopup,
  signOutFirebase,
  syncElderProfileToFirestore,
  syncUserProfileToFirestore,
} from '../lib/firebase';
import { useAccessibility, type TextSize, type ThemeMode } from './AccessibilityContext';
import type { SupportedLang } from '../i18n/translations';

export type UserRole = 'senior' | 'caregiver' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  preferred_language: SupportedLang;
  created_at?: string;
}

interface AuthResponse {
  ok: true;
  token?: string;
  user: AuthUser;
  preferences?: {
    text_size?: TextSize;
    theme?: ThemeMode;
    speech_rate?: number;
    speech_volume?: number;
    voice_lang?: string;
  };
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  firebaseReady: boolean;
  redirectError: string | null;
  clearRedirectError: () => void;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (params: {
    email: string;
    password: string;
    fullName: string;
    role: 'senior' | 'caregiver';
    preferredLanguage: SupportedLang;
  }) => Promise<{ emailVerificationSent: boolean }>;
  loginWithGoogle: (role?: 'senior' | 'caregiver') => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const { hydrateFromServer, textSize, theme } = useAccessibility();

  const applyAuthBundle = useCallback(
    (data: AuthResponse) => {
      if (data.token) {
        setApiToken(data.token);
      }
      setUser(data.user);
      if (data.preferences || data.user) {
        hydrateFromServer({
          preferredLanguage: data.user.preferred_language,
          textSize: data.preferences?.text_size,
          theme: data.preferences?.theme,
          speechRate: data.preferences?.speech_rate,
          speechVolume: data.preferences?.speech_volume,
          voiceLang: data.preferences?.voice_lang,
        });
      }
    },
    [hydrateFromServer]
  );

  const syncVerifiedProfiles = useCallback(
    async (data: AuthResponse, emailOverride?: string, photoUrlOverride?: string) => {
      await Promise.all([
        syncUserProfileToFirestore({
          displayName: data.user.full_name || auth.currentUser?.displayName || 'Buddy User',
          role: data.user.role,
          preferredLanguage: data.user.preferred_language,
          textSize: data.preferences?.text_size || textSize,
          theme: data.preferences?.theme || theme,
          email: emailOverride || data.user.email,
          photoURL: photoUrlOverride ?? auth.currentUser?.photoURL ?? '',
        }),
        syncElderProfileToFirestore({
          fullName: data.user.full_name || auth.currentUser?.displayName || 'Buddy User',
          preferredLanguage: data.user.preferred_language,
        }),
      ]).catch((err) => {
        console.warn('Firestore profile sync skipped:', err);
      });
    },
    [textSize, theme]
  );

  const refreshUser = useCallback(async () => {
    try {
      const redirectResult = await consumeGoogleRedirectResult().catch((err) => {
        setRedirectError(err instanceof Error ? err.message : 'Google sign-in redirect failed.');
        return null;
      });
      if (redirectResult?.idToken) {
        const data = await apiFetch<AuthResponse>('/api/auth/firebase', {
          method: 'POST',
          body: JSON.stringify({ idToken: redirectResult.idToken, role: redirectResult.role }),
        });
        applyAuthBundle(data);
        await syncVerifiedProfiles(
          data,
          redirectResult.user.email || data.user.email,
          redirectResult.user.photoURL || ''
        );
        setLoading(false);
        return;
      }

      if (typeof auth.authStateReady === 'function') {
        await auth.authStateReady();
      }

      const data = await apiFetch<AuthResponse>('/api/auth/me');
      applyAuthBundle(data);
    } catch {
      // Recover session seamlessly using persisted Firebase Auth user (e.g. after serverless cold start)
      if (auth.currentUser) {
        try {
          const freshIdToken = await auth.currentUser.getIdToken();
          const data = await apiFetch<AuthResponse>('/api/auth/firebase', {
            method: 'POST',
            body: JSON.stringify({ idToken: freshIdToken }),
          });
          applyAuthBundle(data);
          await syncVerifiedProfiles(
            data,
            auth.currentUser.email || data.user.email,
            auth.currentUser.photoURL || ''
          );
          setLoading(false);
          return;
        } catch {
          // Fall through cleanly to unauthenticated state
        }
      }
      setUser(null);
      setApiToken(null);
    } finally {
      setLoading(false);
    }
  }, [applyAuthBundle, syncVerifiedProfiles]);

  useEffect(() => {
    refreshUser();
    const unsub = onAuthStateChanged(auth, () => {
      setFirebaseReady(true);
    });
    return () => unsub();
  }, [refreshUser]);

  const loginWithEmail = async (email: string, password: string) => {
    try {
      const fbCred = await signInWithFirebaseEmail(email, password);
      const data = await apiFetch<AuthResponse>('/api/auth/firebase', {
        method: 'POST',
        body: JSON.stringify({ idToken: fbCred.idToken }),
      });
      applyAuthBundle(data);
      await syncVerifiedProfiles(
        data,
        fbCred.user.email || data.user.email,
        fbCred.user.photoURL || ''
      );
      return;
    } catch (fbErr) {
      const code =
        typeof fbErr === 'object' && fbErr !== null && 'code' in fbErr
          ? String((fbErr as { code?: unknown }).code || '')
          : '';
      // Allow fallback to backend password hash only when user record might exist strictly in SQLite
      const canTryBackendFallback =
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/operation-not-allowed';

      if (!canTryBackendFallback) {
        throw fbErr;
      }

      try {
        const data = await apiFetch<AuthResponse>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        applyAuthBundle(data);
      } catch (apiErr) {
        throw code === 'auth/operation-not-allowed' ? apiErr : fbErr;
      }
    }
  };

  const registerWithEmail = async (params: {
    email: string;
    password: string;
    fullName: string;
    role: 'senior' | 'caregiver';
    preferredLanguage: SupportedLang;
  }) => {
    let firebaseUid: string | undefined;
    let firebaseIdToken: string | undefined;
    let emailVerificationSent = false;

    try {
      const fbCred = await registerWithFirebaseEmail(params.email, params.password, params.fullName);
      firebaseUid = fbCred.user.uid;
      firebaseIdToken = fbCred.idToken;
      emailVerificationSent = true;
    } catch (fbErr) {
      const code =
        typeof fbErr === 'object' && fbErr !== null && 'code' in fbErr
          ? String((fbErr as { code?: unknown }).code || '')
          : '';
      // If Firebase Email/Password is disabled in Console, fall back to backend SQLite registration only if not a user input error
      if (code !== 'auth/operation-not-allowed') {
        throw fbErr;
      }
    }

    try {
      const data = await apiFetch<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...params, ...(firebaseUid ? { firebaseUid } : {}) }),
      });
      applyAuthBundle(data);
      return { emailVerificationSent };
    } catch (apiErr) {
      // If backend SQLite already has the email while Firebase just created/verified it, exchange Firebase token cleanly
      if (firebaseIdToken && apiErr instanceof Error && apiErr.message.toLowerCase().includes('already exists')) {
        const data = await apiFetch<AuthResponse>('/api/auth/firebase', {
          method: 'POST',
          body: JSON.stringify({ idToken: firebaseIdToken, role: params.role }),
        });
        applyAuthBundle(data);
        return { emailVerificationSent };
      }
      throw apiErr;
    }
  };

  const loginWithGoogle = async (role: 'senior' | 'caregiver' = 'senior') => {
    const res = await signInWithGooglePopup(role);
    if (res.redirected || !res.idToken || !res.user) {
      return;
    }
    const data = await apiFetch<AuthResponse>('/api/auth/firebase', {
      method: 'POST',
      body: JSON.stringify({ idToken: res.idToken, role }),
    });
    applyAuthBundle(data);
    await syncVerifiedProfiles(data, res.user.email || data.user.email, res.user.photoURL || '');
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    await signOutFirebase().catch(() => {});
    setApiToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        firebaseReady,
        redirectError,
        clearRedirectError: () => setRedirectError(null),
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
