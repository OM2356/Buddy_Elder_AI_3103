import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function useSpeech(defaultLang = 'en-IN', defaultRate = 0.95, defaultVolume = 1.0) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const sttSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const stopSpeaking = useCallback(() => {
    if (ttsSupported) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setPaused(false);
  }, [ttsSupported]);

  const speak = useCallback(
    (text: string, opts?: { lang?: string; rate?: number; volume?: number; onEnd?: () => void }) => {
      if (!ttsSupported) {
        setSpeechError('Text-to-speech is not supported by this browser.');
        return;
      }
      setSpeechError(null);
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = opts?.lang || defaultLang;
      utterance.rate = opts?.rate ?? defaultRate;
      utterance.volume = opts?.volume ?? defaultVolume;
      utterance.onstart = () => {
        setSpeaking(true);
        setPaused(false);
      };
      utterance.onend = () => {
        setSpeaking(false);
        setPaused(false);
        opts?.onEnd?.();
      };
      utterance.onerror = () => {
        setSpeaking(false);
        setPaused(false);
      };
      window.speechSynthesis.speak(utterance);
    },
    [ttsSupported, defaultLang, defaultRate, defaultVolume]
  );

  const pauseSpeaking = useCallback(() => {
    if (ttsSupported && speaking) {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  }, [ttsSupported, speaking]);

  const resumeSpeaking = useCallback(() => {
    if (ttsSupported && paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    }
  }, [ttsSupported, paused]);

  const startListening = useCallback(
    (onTranscript: (text: string) => void, lang = defaultLang) => {
      if (!sttSupported) {
        setSpeechError('Voice typing (microphone speech recognition) is not supported in this browser. You can type directly instead.');
        return;
      }
      setSpeechError(null);
      const win = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionInstance;
        webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
      };
      const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (!Ctor) return;

      try {
        const recognition = new Ctor();
        recognition.lang = lang;
        recognition.interimResults = false;
        recognition.continuous = false;

        recognition.onresult = (event) => {
          const transcript = event.results?.[0]?.[0]?.transcript || '';
          if (transcript) {
            onTranscript(transcript);
          }
        };
        recognition.onerror = (ev) => {
          if (ev.error === 'not-allowed') {
            setSpeechError('Microphone permission was denied. Please allow microphone access in your browser bar or type your question.');
          } else {
            setSpeechError(`Voice input error (${ev.error}). You can retry or type directly.`);
          }
          setListening(false);
        };
        recognition.onend = () => {
          setListening(false);
        };

        recognitionRef.current = recognition;
        setListening(true);
        recognition.start();
      } catch {
        setListening(false);
        setSpeechError('Could not start microphone listening.');
      }
    },
    [sttSupported, defaultLang]
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => {
    return () => {
      if (ttsSupported) window.speechSynthesis.cancel();
      recognitionRef.current?.stop();
    };
  }, [ttsSupported]);

  return {
    ttsSupported,
    sttSupported,
    speaking,
    paused,
    listening,
    speechError,
    clearSpeechError: () => setSpeechError(null),
    speak,
    stopSpeaking,
    pauseSpeaking,
    resumeSpeaking,
    startListening,
    stopListening,
  };
}
