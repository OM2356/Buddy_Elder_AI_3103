import React, { createContext, useContext, useEffect, useState } from 'react';
import { TRANSLATIONS, type SupportedLang } from '../i18n/translations';
import { apiFetch } from '../lib/api';

export type TextSize = 'normal' | 'large' | 'xlarge';
export type ThemeMode = 'light' | 'dark';

interface AccessibilityContextValue {
  language: SupportedLang;
  textSize: TextSize;
  theme: ThemeMode;
  speechRate: number;
  speechVolume: number;
  voiceLang: string;
  t: (typeof TRANSLATIONS)['en'];
  setLanguage: (lang: SupportedLang, persist?: boolean) => void;
  setTextSize: (size: TextSize, persist?: boolean) => void;
  setTheme: (theme: ThemeMode, persist?: boolean) => void;
  setSpeechSettings: (rate: number, volume: number, voiceLang: string, persist?: boolean) => void;
  hydrateFromServer: (prefs: {
    preferredLanguage?: SupportedLang;
    textSize?: TextSize;
    theme?: ThemeMode;
    speechRate?: number;
    speechVolume?: number;
    voiceLang?: string;
  }) => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

const VOICE_LANG_MAP: Record<SupportedLang, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
};

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [language, setLangState] = useState<SupportedLang>('en');
  const [textSize, setTextSizeState] = useState<TextSize>('large');
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [speechRate, setSpeechRate] = useState<number>(0.95);
  const [speechVolume, setSpeechVolume] = useState<number>(1.0);
  const [voiceLang, setVoiceLang] = useState<string>('en-IN');

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('dark', theme === 'dark');
    html.classList.remove('text-size-normal', 'text-size-large', 'text-size-xlarge');
    html.classList.add(`text-size-${textSize}`);
    html.lang = language;
  }, [theme, textSize, language]);

  const persistPatch = async (patch: Record<string, unknown>) => {
    try {
      await apiFetch('/api/preferences', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
    } catch {
      // Unauthenticated users can still toggle local preferences
    }
  };

  const setLanguage = (lang: SupportedLang, persist = true) => {
    setLangState(lang);
    const nextVoice = VOICE_LANG_MAP[lang];
    setVoiceLang(nextVoice);
    if (persist) {
      persistPatch({ preferredLanguage: lang, voiceLang: nextVoice });
    }
  };

  const setTextSize = (size: TextSize, persist = true) => {
    setTextSizeState(size);
    if (persist) {
      persistPatch({ textSize: size });
    }
  };

  const setTheme = (nextTheme: ThemeMode, persist = true) => {
    setThemeState(nextTheme);
    if (persist) {
      persistPatch({ theme: nextTheme });
    }
  };

  const setSpeechSettings = (rate: number, volume: number, vLang: string, persist = true) => {
    setSpeechRate(rate);
    setSpeechVolume(volume);
    setVoiceLang(vLang);
    if (persist) {
      persistPatch({ speechRate: rate, speechVolume: volume, voiceLang: vLang });
    }
  };

  const hydrateFromServer = (prefs: {
    preferredLanguage?: SupportedLang;
    textSize?: TextSize;
    theme?: ThemeMode;
    speechRate?: number;
    speechVolume?: number;
    voiceLang?: string;
  }) => {
    if (prefs.preferredLanguage) setLangState(prefs.preferredLanguage);
    if (prefs.textSize) setTextSizeState(prefs.textSize);
    if (prefs.theme) setThemeState(prefs.theme);
    if (typeof prefs.speechRate === 'number') setSpeechRate(prefs.speechRate);
    if (typeof prefs.speechVolume === 'number') setSpeechVolume(prefs.speechVolume);
    if (prefs.voiceLang) setVoiceLang(prefs.voiceLang);
  };

  return (
    <AccessibilityContext.Provider
      value={{
        language,
        textSize,
        theme,
        speechRate,
        speechVolume,
        voiceLang,
        t: TRANSLATIONS[language],
        setLanguage,
        setTextSize,
        setTheme,
        setSpeechSettings,
        hydrateFromServer,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return ctx;
}
