import React, { useEffect, useState } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Flag, ShieldAlert, Volume2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { useAccessibility } from '../context/AccessibilityContext';
import { useSpeech } from '../hooks/useSpeech';
import { apiFetch } from '../lib/api';
import { syncScamReportToFirestore } from '../lib/firebase';

type ScamChannel = 'sms' | 'whatsapp' | 'email' | 'url' | 'payment' | 'phone';

interface AnalysisResponse {
  ok: true;
  recordId: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  indicators: string[];
  safetyGuidance: string[];
  aiSummary: string | null;
  cybercrimeHelp: {
    helpline: string;
    portal: string;
    disclaimer: string;
  };
}

interface HistoryItem {
  id: string;
  channel: ScamChannel;
  content_preview: string;
  risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  indicators: string[];
  reported_flag: number;
  created_at: string;
}

export default function ScamShieldPage() {
  const { voiceLang, speechRate, speechVolume } = useAccessibility();
  const speech = useSpeech(voiceLang, speechRate, speechVolume);

  const [channel, setChannel] = useState<ScamChannel>('sms');
  const [content, setContent] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportNotice, setReportNotice] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      const data = await apiFetch<{ history: HistoryItem[] }>('/api/scam/history');
      setHistory(data.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setError(null);
    setReportNotice(null);
    setAnalyzing(true);
    try {
      const data = await apiFetch<AnalysisResponse>('/api/scam/analyze', {
        method: 'POST',
        body: JSON.stringify({ channel, content, includeAiExplanation: true }),
      });
      setResult(data);
      await syncScamReportToFirestore({
        id: data.recordId,
        channel,
        riskLevel: data.riskLevel,
        riskScore: data.riskScore,
        summary: data.indicators.join('; ') || 'No deterministic warning flags matched.',
      }).catch(() => {});
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReport = async (id: string) => {
    const data = await apiFetch<{ guidance: { message: string } }>(`/api/scam/report/${id}`, {
      method: 'POST',
    });
    setReportNotice(data.guidance.message);
    await loadHistory();
  };

  const riskBadge = (level: 'LOW' | 'MEDIUM' | 'HIGH') => {
    if (level === 'HIGH') {
      return (
        <span className="inline-flex items-center gap-2 font-bold text-red-700 dark:text-red-400">
          <AlertOctagon className="w-6 h-6" aria-hidden="true" />
          HIGH RISK
        </span>
      );
    }
    if (level === 'MEDIUM') {
      return (
        <span className="inline-flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          MEDIUM RISK
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="w-6 h-6" aria-hidden="true" />
        LOW DETECTED RISK
      </span>
    );
  };

  return (
    <Layout title="Scam Shield Protection">
      <div className="space-y-8">
        {error && <ErrorBanner message={error} />}
        {reportNotice && (
          <div className="rounded-2xl border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/40 p-5 text-lg font-medium">
            {reportNotice}
          </div>
        )}

        {/* Analyzer Form */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-7 h-7 text-[#0F766E] dark:text-teal-400" aria-hidden="true" />
              <h2 className="text-2xl font-bold">Check a Message, Link, UPI Request, or Phone Number</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setChannel('sms');
                  setContent('URGENT: Your bank KYC is suspended today. Click http://bit.ly/kyc-verify-now and share OTP within 10 minutes or account will freeze.');
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold cursor-pointer"
              >
                Sample Fake KYC SMS
              </button>
              <button
                type="button"
                onClick={() => {
                  setChannel('payment');
                  setContent('To receive your Rs 5,000 refund on UPI, scan this QR code and enter your 6-digit UPI PIN immediately.');
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold cursor-pointer"
              >
                Sample UPI Refund Trap
              </button>
            </div>
          </div>

          <form onSubmit={handleAnalyze} className="space-y-4">
            <div>
              <label htmlFor="scam-channel" className="block text-base font-semibold mb-1.5">
                What are you checking?
              </label>
              <select
                id="scam-channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as ScamChannel)}
                className="w-full sm:w-80 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
              >
                <option value="sms">SMS Text Message</option>
                <option value="whatsapp">WhatsApp Message</option>
                <option value="email">Email Message</option>
                <option value="url">Website Link (URL)</option>
                <option value="payment">UPI / Payment Request</option>
                <option value="phone">Customer-Care / Unknown Phone</option>
              </select>
            </div>

            <div>
              <label htmlFor="scam-content" className="block text-base font-semibold mb-1.5">
                Paste the suspicious message, link, or phone number
              </label>
              <textarea
                id="scam-content"
                rows={4}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste the exact text, URL, or payment prompt here..."
                className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
              />
            </div>

            <button
              type="submit"
              disabled={analyzing || content.trim().length < 3}
              className="px-7 py-3.5 rounded-xl bg-[#0F766E] text-white text-xl font-semibold hover:bg-[#0D635D] disabled:opacity-50 cursor-pointer"
            >
              {analyzing ? 'Checking Safety...' : 'Analyze for Scam Signs'}
            </button>
          </form>
        </section>

        {/* Result Panel */}
        {result && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="text-2xl">{riskBadge(result.riskLevel)}</div>
                <p className="text-lg text-slate-600 dark:text-slate-300">
                  Deterministic Risk Score: <span className="font-mono-tabular font-bold">{result.riskScore} / 100</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    speech.speak(
                      `Risk assessment is ${result.riskLevel}. Score ${result.riskScore} out of 100. ${
                        result.indicators.join('. ') || 'No obvious red flags matched.'
                      } ${result.safetyGuidance[0]}`
                    )
                  }
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  <Volume2 className="w-5 h-5" />
                  Read Result Aloud
                </button>
                <button
                  type="button"
                  onClick={() => handleReport(result.recordId)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-700 text-white font-semibold hover:bg-red-800 cursor-pointer"
                >
                  <Flag className="w-5 h-5" />
                  Mark & Report Fraud
                </button>
              </div>
            </div>

            {result.aiSummary && (
              <div className="rounded-xl bg-[#EFF6FF] dark:bg-slate-900 p-4 text-lg">
                <p className="font-semibold mb-1">Safety Explanation:</p>
                <p>{result.aiSummary}</p>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-bold mb-2">Detected Warning Signs</h3>
                {result.indicators.length === 0 ? (
                  <p className="text-lg text-slate-600 dark:text-slate-300">
                    No common scam patterns matched our rules, but always verify unknown senders independently.
                  </p>
                ) : (
                  <ul className="list-disc pl-6 space-y-2 text-lg">
                    {result.indicators.map((ind, i) => (
                      <li key={i}>{ind}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="text-xl font-bold mb-2">What to Do Safely</h3>
                <ul className="list-disc pl-6 space-y-2 text-lg">
                  {result.safetyGuidance.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-xl bg-[#FAF7F0] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 space-y-1 text-base">
              <p className="font-bold">
                Indian Cybercrime Reporting: Dial {result.cybercrimeHelp.helpline} · Portal: {result.cybercrimeHelp.portal}
              </p>
              <p className="text-slate-600 dark:text-slate-400">{result.cybercrimeHelp.disclaimer}</p>
            </div>
          </section>
        )}

        {/* History */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
          <h2 className="text-2xl font-bold">Recent Scam Checks</h2>
          {loadingHistory ? (
            <LoadingSkeleton rows={2} />
          ) : history.length === 0 ? (
            <EmptyState
              title="No scam checks yet"
              description="Any SMS, WhatsApp forward, URL, or payment prompt you inspect will be saved here for your reference."
            />
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 text-base">
                      {riskBadge(item.risk_level)}
                      <span className="font-mono-tabular text-slate-500">Score {item.risk_score}/100</span>
                      <span className="text-slate-500">· {item.channel.toUpperCase()}</span>
                    </div>
                    <p className="text-lg truncate">{item.content_preview}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleReport(item.id)}
                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-base font-semibold shrink-0 cursor-pointer"
                  >
                    {item.reported_flag ? 'Reported' : 'Flag for 1930'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
