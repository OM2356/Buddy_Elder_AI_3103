import React, { useEffect, useRef, useState } from 'react';
import Tesseract from 'tesseract.js';
import { Camera, FileText, Pause, Play, Repeat, Square, Upload, Volume2, X } from 'lucide-react';
import { Layout } from '../components/Layout';
import { ErrorBanner } from '../components/StateViews';
import { useAccessibility } from '../context/AccessibilityContext';
import { useSpeech } from '../hooks/useSpeech';

export default function AudioReaderPage() {
  const { speechRate, speechVolume, voiceLang } = useAccessibility();

  const [ocrLang, setOcrLang] = useState<'eng' | 'hin' | 'mar'>('eng');
  const [ttsLang, setTtsLang] = useState(voiceLang);
  const [rate, setRate] = useState(speechRate);
  const [volume, setVolume] = useState(speechVolume);
  const [extractedText, setExtractedText] = useState(
    'Paste or extract text from any prescription, electricity bill, or letter.\n\nTap any paragraph below or press Read Aloud to hear it clearly at your own pace.'
  );
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeParaIndex, setActiveParaIndex] = useState<number | null>(null);
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const speech = useSpeech(ttsLang, rate, volume);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const runOcr = async (source: File | Blob | string) => {
    setError(null);
    setProgress(0);
    try {
      const result = await Tesseract.recognize(source, ocrLang, {
        logger: (m) => {
          if (m.status === 'recognizing text' && typeof m.progress === 'number') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      const text = result.data.text?.trim();
      if (!text) {
        setError('No readable text could be detected in that image. Try brighter lighting or a clearer photo.');
      } else {
        setExtractedText(text);
        setActiveParaIndex(0);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `OCR extraction failed (${err.message}). If using Hindi or Marathi, ensure internet connectivity for language data.`
          : 'OCR extraction failed.'
      );
    } finally {
      setProgress(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > 10 * 1024 * 1024) {
      setError('File exceeds 10 MB limit. Please choose a smaller image or document.');
      return;
    }

    if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
      const txt = await file.text();
      setExtractedText(txt.trim());
      setActiveParaIndex(0);
      return;
    }

    if (file.type.startsWith('image/')) {
      await runOcr(file);
      return;
    }

    setError('Unsupported file format. Please upload an image (PNG, JPG, WebP) or a plain text (.txt) document.');
  };

  const startCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera capture is unavailable in this browser. Please upload an image file instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      setError('Camera permission was denied or no camera was detected.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();
    canvas.toBlob((blob) => {
      if (blob) runOcr(blob);
    }, 'image/png');
  };

  const paragraphs = extractedText
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const speakFromIndex = (idx: number) => {
    if (idx >= paragraphs.length) {
      if (repeatEnabled && paragraphs.length > 0) {
        speakFromIndex(0);
      } else {
        setActiveParaIndex(null);
      }
      return;
    }
    setActiveParaIndex(idx);
    speech.speak(paragraphs[idx], {
      lang: ttsLang,
      rate,
      volume,
      onEnd: () => speakFromIndex(idx + 1),
    });
  };

  return (
    <Layout title="Audio Reader & OCR">
      <div className="space-y-6">
        {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
        {speech.speechError && <ErrorBanner message={speech.speechError} onRetry={speech.clearSpeechError} />}

        {/* Capture & Upload Controls */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="ocr-lang" className="block text-base font-semibold mb-1">
                Document Language (OCR)
              </label>
              <select
                id="ocr-lang"
                value={ocrLang}
                onChange={(e) => {
                  const val = e.target.value as 'eng' | 'hin' | 'mar';
                  setOcrLang(val);
                  setTtsLang(val === 'hin' ? 'hi-IN' : val === 'mar' ? 'mr-IN' : 'en-IN');
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
              >
                <option value="eng">English (eng)</option>
                <option value="hin">Hindi (hin)</option>
                <option value="mar">Marathi (mar)</option>
              </select>
            </div>

            <label className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#0F2544] dark:bg-teal-600 text-white font-semibold text-lg cursor-pointer hover:opacity-90">
              <Upload className="w-5 h-5" aria-hidden="true" />
              <span>Upload Image or .TXT</span>
              <input type="file" accept="image/*,.txt,.md" onChange={handleFileUpload} className="sr-only" />
            </label>

            <button
              type="button"
              onClick={cameraOpen ? stopCamera : startCamera}
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Camera className="w-5 h-5" aria-hidden="true" />
              <span>{cameraOpen ? 'Close Camera' : 'Capture with Camera'}</span>
            </button>
          </div>

          {progress !== null && (
            <div className="space-y-2">
              <p className="font-semibold">Extracting text from image: <span className="font-mono-tabular">{progress}%</span></p>
              <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-[#0F766E] transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {cameraOpen && (
            <div className="rounded-2xl border border-slate-300 dark:border-slate-700 p-4 space-y-4 bg-black/5">
              <video ref={videoRef} className="w-full max-h-[360px] rounded-xl bg-black object-contain" playsInline muted />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="px-6 py-3 rounded-xl bg-[#0F766E] text-white font-semibold text-lg cursor-pointer"
                >
                  Capture & Read Text
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Playback Controls */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => speakFromIndex(activeParaIndex ?? 0)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0F766E] text-white font-semibold text-lg cursor-pointer"
            >
              <Play className="w-5 h-5" />
              Read Aloud
            </button>
            <button
              type="button"
              onClick={speech.paused ? speech.resumeSpeaking : speech.pauseSpeaking}
              disabled={!speech.speaking}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-lg disabled:opacity-40 cursor-pointer"
            >
              <Pause className="w-5 h-5" />
              {speech.paused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              onClick={() => {
                speech.stopSpeaking();
                setActiveParaIndex(null);
              }}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-lg cursor-pointer"
            >
              <Square className="w-5 h-5" />
              Stop
            </button>
            <button
              type="button"
              onClick={() => setRepeatEnabled((r) => !r)}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl border font-semibold text-lg cursor-pointer ${
                repeatEnabled
                  ? 'border-[#0F766E] bg-[#EFF6FF] dark:bg-slate-800 text-[#0F766E] dark:text-teal-400'
                  : 'border-slate-300 dark:border-slate-700'
              }`}
            >
              <Repeat className="w-5 h-5" />
              Repeat: {repeatEnabled ? 'On' : 'Off'}
            </button>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            <div>
              <label htmlFor="speech-rate" className="block text-base font-semibold mb-1">
                Reading Speed: <span className="font-mono-tabular">{rate.toFixed(2)}x</span>
              </label>
              <input
                id="speech-rate"
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
              <label htmlFor="speech-vol" className="block text-base font-semibold mb-1">
                Volume: <span className="font-mono-tabular">{Math.round(volume * 100)}%</span>
              </label>
              <input
                id="speech-vol"
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
              <label htmlFor="tts-lang" className="block text-base font-semibold mb-1">
                Voice Language
              </label>
              <select
                id="tts-lang"
                value={ttsLang}
                onChange={(e) => setTtsLang(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
              >
                <option value="en-IN">English (India)</option>
                <option value="hi-IN">Hindi (हिन्दी)</option>
                <option value="mr-IN">Marathi (मराठी)</option>
              </select>
            </div>
          </div>
        </section>

        {/* Editable Text & Paragraph Highlighter */}
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-3">
            <div className="flex items-center gap-2 font-bold text-xl">
              <FileText className="w-5 h-5 text-[#0F766E]" />
              <label htmlFor="ocr-editor">Edit Extracted Text</label>
            </div>
            <textarea
              id="ocr-editor"
              rows={10}
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg leading-relaxed"
            />
          </section>

          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-3">
            <div className="flex items-center gap-2 font-bold text-xl">
              <Volume2 className="w-5 h-5 text-[#0F766E]" />
              <h2>Select a Paragraph to Listen</h2>
            </div>
            <div className="space-y-3 max-h-[360px] overflow-y-auto">
              {paragraphs.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => speakFromIndex(idx)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors text-lg cursor-pointer ${
                    activeParaIndex === idx
                      ? 'border-[#0F766E] bg-[#EFF6FF] dark:bg-slate-800 font-medium'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
