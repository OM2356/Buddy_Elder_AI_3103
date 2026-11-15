import React, { useEffect, useState } from 'react';
import { BookOpen, ExternalLink, FileUp, Search, Send, Trash2 } from 'lucide-react';
import { Layout } from '../components/Layout';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { useAccessibility } from '../context/AccessibilityContext';
import { apiFetch } from '../lib/api';

interface ResearchDoc {
  id: string;
  title: string;
  authors: string;
  topic: string;
  published_year: number;
  source_url: string;
  summary: string;
  content_excerpt: string;
  is_user_uploaded?: number;
  chunk_count?: number;
}

interface RetrievedChunk {
  id: string;
  chunkIndex: number;
  chunkText: string;
  score: number;
}

export default function ResearchPage() {
  const { language } = useAccessibility();

  const [documents, setDocuments] = useState<ResearchDoc[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDoc, setActiveDoc] = useState<ResearchDoc | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{
    text: string;
    sourceUrl: string;
    title: string;
    chunks: RetrievedChunk[];
  } | null>(null);
  const [asking, setAsking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Document upload state
  const [showUpload, setShowUpload] = useState(false);
  const [upTitle, setUpTitle] = useState('');
  const [upAuthors, setUpAuthors] = useState('Personal Reference');
  const [upTopic, setUpTopic] = useState('Personal Notes');
  const [upFile, setUpFile] = useState<File | null>(null);
  const [upText, setUpText] = useState('');
  const [uploading, setUploading] = useState(false);

  const loadPapers = async (q = '', topic = 'All') => {
    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (topic && topic !== 'All') params.set('topic', topic);
      const data = await apiFetch<{ documents: ResearchDoc[]; topics: string[] }>(
        `/api/research?${params.toString()}`
      );
      setDocuments(data.documents);
      setTopics(['All', ...data.topics]);
      if (data.documents.length > 0) {
        setActiveDoc((prev) => data.documents.find((d) => d.id === prev?.id) || data.documents[0]);
      } else {
        setActiveDoc(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load research library.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPapers();
  }, []);

  const askPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoc || !question.trim()) return;
    setAsking(true);
    setError(null);
    try {
      const data = await apiFetch<{
        answer: string;
        retrievedChunks?: RetrievedChunk[];
        citation: { title: string; sourceUrl: string };
      }>('/api/research/ask', {
        method: 'POST',
        body: JSON.stringify({
          documentId: activeDoc.id,
          question,
          language,
        }),
      });
      setAnswer({
        text: data.answer,
        title: data.citation.title,
        sourceUrl: data.citation.sourceUrl,
        chunks: data.retrievedChunks || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not answer question.');
    } finally {
      setAsking(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('title', upTitle);
      formData.append('authors', upAuthors);
      formData.append('topic', upTopic);
      if (upFile) {
        formData.append('file', upFile);
      } else {
        formData.append('textContent', upText);
      }

      const data = await apiFetch<{ document: ResearchDoc }>('/api/research/upload', {
        method: 'POST',
        body: formData,
      });

      setUpTitle('');
      setUpText('');
      setUpFile(null);
      setShowUpload(false);
      await loadPapers(searchQuery, selectedTopic);
      setActiveDoc(data.document);
      setAnswer(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload document.');
    } finally {
      setUploading(false);
    }
  };

  const removeUploadedDoc = async (id: string) => {
    await apiFetch(`/api/research/${id}`, { method: 'DELETE' });
    setAnswer(null);
    await loadPapers(searchQuery, selectedTopic);
  };

  return (
    <Layout title="Research Knowledge Hub">
      <div className="space-y-6">
        {error && <ErrorBanner message={error} onRetry={() => loadPapers(searchQuery, selectedTopic)} />}

        {/* Search, Filter & Upload Toggle */}
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-5 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-3.5 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                loadPapers(e.target.value, selectedTopic);
              }}
              placeholder="Search WHO, RBI, CERT-In, NIH papers..."
              aria-label="Search research papers"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
            />
          </div>
          <select
            aria-label="Filter by research topic"
            value={selectedTopic}
            onChange={(e) => {
              setSelectedTopic(e.target.value);
              loadPapers(searchQuery, e.target.value);
            }}
            className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
          >
            {topics.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowUpload((v) => !v)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0F2544] dark:bg-teal-600 text-white font-semibold text-lg cursor-pointer whitespace-nowrap"
          >
            <FileUp className="w-5 h-5" />
            {showUpload ? 'Close Upload' : 'Upload .TXT / .MD'}
          </button>
        </section>

        {showUpload && (
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
            <h2 className="text-2xl font-bold">Upload Document for Grounded Q&A</h2>
            <p className="text-base text-slate-600 dark:text-slate-300">
              Upload a plain text (.txt or .md, max 1 MB) document or paste verified notes below. Buddy splits it into indexed sections and answers strictly from those sections.
            </p>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="up-title" className="block text-base font-semibold mb-1">Document Title</label>
                  <input
                    id="up-title"
                    type="text"
                    required
                    minLength={3}
                    value={upTitle}
                    onChange={(e) => setUpTitle(e.target.value)}
                    placeholder="e.g. Clinic Discharge Instructions"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                  />
                </div>
                <div>
                  <label htmlFor="up-authors" className="block text-base font-semibold mb-1">Source / Author</label>
                  <input
                    id="up-authors"
                    type="text"
                    required
                    value={upAuthors}
                    onChange={(e) => setUpAuthors(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                  />
                </div>
                <div>
                  <label htmlFor="up-topic" className="block text-base font-semibold mb-1">Topic</label>
                  <input
                    id="up-topic"
                    type="text"
                    required
                    value={upTopic}
                    onChange={(e) => setUpTopic(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="up-file" className="block text-base font-semibold mb-1">Select .txt or .md File (optional if pasting text)</label>
                <input
                  id="up-file"
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  onChange={(e) => setUpFile(e.target.files?.[0] || null)}
                  className="block text-base"
                />
              </div>

              {!upFile && (
                <div>
                  <label htmlFor="up-text" className="block text-base font-semibold mb-1">Or Paste Document Text (min 40 chars)</label>
                  <textarea
                    id="up-text"
                    rows={4}
                    required={!upFile}
                    value={upText}
                    onChange={(e) => setUpText(e.target.value)}
                    placeholder="Paste verified reference paragraphs here..."
                    className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={uploading}
                className="px-6 py-3 rounded-xl bg-[#0F766E] text-white font-semibold text-lg cursor-pointer"
              >
                {uploading ? 'Indexing Chunks...' : 'Index & Add to Knowledge Hub'}
              </button>
            </form>
          </section>
        )}

        {loading ? (
          <LoadingSkeleton rows={3} />
        ) : documents.length === 0 ? (
          <EmptyState title="No matching research papers" description="Try clearing the search query or selecting All topics." />
        ) : (
          <div className="grid lg:grid-cols-12 gap-6 items-start">
            <aside className="lg:col-span-5 space-y-3">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => {
                    setActiveDoc(doc);
                    setAnswer(null);
                  }}
                  className={`w-full text-left rounded-2xl border p-5 space-y-2 cursor-pointer transition-colors ${
                    activeDoc?.id === doc.id
                      ? 'border-[#0F766E] bg-[#EFF6FF] dark:bg-slate-800'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B]'
                  }`}
                >
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {doc.topic} · {doc.published_year}
                    {doc.chunk_count ? ` · ${doc.chunk_count} sections` : ''}
                  </p>
                  <h3 className="text-xl font-bold">{doc.title}</h3>
                  <p className="text-base text-slate-600 dark:text-slate-300">{doc.authors}</p>
                </button>
              ))}
            </aside>

            {activeDoc && (
              <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {activeDoc.topic} · Published <span className="font-mono-tabular">{activeDoc.published_year}</span>
                    </p>
                    <h2 className="font-display text-2xl font-bold">{activeDoc.title}</h2>
                    <p className="text-base font-semibold text-[#0F766E] dark:text-teal-400">{activeDoc.authors}</p>
                    {activeDoc.source_url && !activeDoc.source_url.includes('buddyelder.local') && (
                      <a
                        href={activeDoc.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-base font-semibold underline"
                      >
                        Official Source Link <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  {activeDoc.is_user_uploaded === 1 && (
                    <button
                      type="button"
                      onClick={() => removeUploadedDoc(activeDoc.id)}
                      aria-label={`Remove ${activeDoc.title}`}
                      className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-red-700 dark:text-red-400 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#0F766E]" /> Summary & Verified Excerpt
                  </h3>
                  <p className="text-lg text-slate-700 dark:text-slate-300">{activeDoc.summary}</p>
                  <blockquote className="rounded-xl bg-[#FAF7F0] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 text-lg leading-relaxed max-h-60 overflow-y-auto">
                    {activeDoc.content_excerpt}
                  </blockquote>
                </div>

                <form onSubmit={askPaper} className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <label htmlFor="rag-q" className="block text-xl font-bold">
                    Ask a Question Grounded in This Paper
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      id="rag-q"
                      type="text"
                      required
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="e.g. What does this report say about UPI QR codes?"
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                    />
                    <button
                      type="submit"
                      disabled={asking}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#0F766E] text-white font-semibold cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      {asking ? 'Checking...' : 'Ask'}
                    </button>
                  </div>
                </form>

                {answer && (
                  <div className="rounded-xl bg-[#EFF6FF] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 space-y-4">
                    <p className="text-sm font-bold text-[#0F766E] dark:text-teal-400">
                      Source Attribution: {answer.title}
                    </p>
                    <p className="text-lg whitespace-pre-line">{answer.text}</p>
                    {answer.chunks.length > 0 && (
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                          Retrieved Grounding Sections:
                        </p>
                        {answer.chunks.map((c) => (
                          <div key={c.id} className="text-base bg-white dark:bg-slate-800 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                            <span className="font-mono-tabular text-xs font-bold mr-2">[Section {c.chunkIndex + 1}]</span>
                            {c.chunkText}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
