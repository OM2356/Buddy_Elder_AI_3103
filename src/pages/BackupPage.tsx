import React, { useEffect, useState } from 'react';
import { Download, Lock, Upload } from 'lucide-react';
import { Layout } from '../components/Layout';
import { ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { apiFetch } from '../lib/api';

interface BackupMeta {
  id: string;
  filename: string;
  cipher_alg: string;
  checksum_sha256: string;
  record_count: number;
  created_at: string;
}

export default function BackupPage() {
  const [history, setHistory] = useState<BackupMeta[]>([]);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await apiFetch<{ history: BackupMeta[]; backupConsent: boolean }>('/api/backup/history');
      setHistory(data.history);
      setConsent(data.backupConsent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load backup records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleExport = async () => {
    setError(null);
    setStatusMsg(null);
    try {
      const data = await apiFetch<{ envelope: Record<string, unknown>; recordCount: number }>('/api/backup/export', {
        method: 'POST',
        body: JSON.stringify({ explicitConsent: consent }),
      });

      const blob = new Blob([JSON.stringify(data.envelope, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `buddy-elder-backup-${new Date().toISOString().slice(0, 10)}.enc.json`;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMsg(`Encrypted AES-256-GCM backup exported (${data.recordCount} records).`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setStatusMsg(null);
    try {
      const raw = await file.text();
      const envelope = JSON.parse(raw);
      const res = await apiFetch<{ restoredCount: number }>('/api/backup/restore', {
        method: 'POST',
        body: JSON.stringify({ envelope }),
      });
      setStatusMsg(`Backup verified and restored (${res.restoredCount} records processed).`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore verification failed.');
    }
  };

  return (
    <Layout title="Encrypted Backup & Restore">
      <div className="space-y-6">
        {error && <ErrorBanner message={error} onRetry={load} />}
        {statusMsg && (
          <div className="rounded-2xl border border-teal-400 bg-teal-50 dark:bg-teal-950/40 p-5 text-lg font-semibold">
            {statusMsg}
          </div>
        )}

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-5">
          <div className="flex items-center gap-3">
            <Lock className="w-7 h-7 text-[#0F766E]" />
            <h2 className="text-2xl font-bold">AES-256-GCM Personal Data Backup</h2>
          </div>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Backups are encrypted on the server using AES-256-GCM with a unique random IV, scrypt-derived key, and authentication tag verification. Nothing is exported without your consent.
          </p>

          <label className="flex items-center gap-3 p-4 rounded-xl bg-[#FAF7F0] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="w-5 h-5"
            />
            <span className="text-lg font-medium">
              I consent to exporting an encrypted copy of my reminders, wellness entries, contacts, and conversations.
            </span>
          </label>

          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              disabled={!consent}
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#0F766E] text-white font-semibold text-lg disabled:opacity-40 cursor-pointer"
            >
              <Download className="w-5 h-5" />
              Export Encrypted Backup
            </button>

            <label className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
              <Upload className="w-5 h-5" />
              <span>Restore from .enc.json File</span>
              <input type="file" accept=".json,.enc.json" onChange={handleRestoreFile} className="sr-only" />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
          <h2 className="text-2xl font-bold">Backup History</h2>
          {loading ? (
            <LoadingSkeleton rows={2} />
          ) : history.length === 0 ? (
            <p className="text-lg text-slate-500">No encrypted backups exported yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap justify-between gap-3"
                >
                  <div>
                    <p className="font-bold text-lg">{h.filename}</p>
                    <p className="font-mono-tabular text-sm text-slate-500">
                      {h.cipher_alg} · {h.record_count} records · SHA256 {h.checksum_sha256.slice(0, 12)}...
                    </p>
                  </div>
                  <span className="font-mono-tabular text-sm text-slate-500">{h.created_at}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
