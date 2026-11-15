import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { apiFetch, setApiToken } from '../lib/api';
import {
  auth,
  signInWithGooglePopup,
  signOutFirebase,
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
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (params: {
    email: string;
    password: string;
    fullName: string;
    role: 'senior' | 'caregiver';
    preferredLanguage: SupportedLang;
  }) => Promise<void>;
  loginWithGoogle: (role?: 'senior' | 'caregiver') => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [firebaseReady, setFirebaseReady] = useState(false);
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

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<AuthResponse>('/api/auth/me');
      applyAuthBundle(data);
    } catch {
      setUser(null);
      setApiToken(null);
    } finally {
      setLoading(false);
    }
  }, [applyAuthBundle]);

  useEffect(() => {
    refreshUser();
    const unsub = onAuthStateChanged(auth, () => {
      setFirebaseReady(true);
    });
    return () => unsub();
  }, [refreshUser]);

  const loginWithEmail = async (email: string, password: string) => {
    const data = await apiFetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    applyAuthBundle(data);
  };

  const registerWithEmail = async (params: {
    email: string;
    password: string;
    fullName: string;
    role: 'senior' | 'caregiver';
    preferredLanguage: SupportedLang;
  }) => {
    const data = await apiFetch<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    applyAuthBundle(data);
  };

  const loginWithGoogle = async (role: 'senior' | 'caregiver' = 'senior') => {
    const { idToken, user: fbUser } = await signInWithGooglePopup();
    const data = await apiFetch<AuthResponse>('/api/auth/firebase', {
      method: 'POST',
      body: JSON.stringify({ idToken, role }),
    });
    applyAuthBundle(data);

    // Sync profile safely to Firestore
    await syncUserProfileToFirestore({
      displayName: data.user.full_name || fbUser.displayName || 'Buddy User',
      role: data.user.role,
      preferredLanguage: data.user.preferred_language,
      textSize: data.preferences?.text_size || textSize,
      theme: data.preferences?.theme || theme,
      email: fbUser.email || data.user.email,
    }).catch((err) => {
      console.warn('Firestore profile sync skipped:', err);
    });
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
