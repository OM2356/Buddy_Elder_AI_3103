import React, { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Copy,
  Edit3,
  Mic,
  MicOff,
  Plus,
  RefreshCw,
  Search,
  Send,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { useAccessibility } from '../context/AccessibilityContext';
import { useSpeech } from '../hooks/useSpeech';
import { apiFetch, getApiToken } from '../lib/api';

interface Conversation {
  id: string;
  title: string;
  language: 'en' | 'hi' | 'mr';
  updated_at: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  capability_used?: string;
  verification_note?: string;
}

const SUGGESTED_QUESTIONS = [
  'How do I tell if a bank KYC SMS is a scam?',
  'Explain step by step how to send a WhatsApp voice message.',
  'Give me a gentle morning hydration and stretching routine.',
  'How do I join a family video call clearly?',
];

export default function AssistantPage() {
  const { language, speechRate, speechVolume, voiceLang } = useAccessibility();
  const speech = useSpeech(voiceLang, speechRate, speechVolume);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [input, setInput] = useState('');
  const [streamingReply, setStreamingReply] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadConversations = useCallback(async (q = '') => {
    try {
      const data = await apiFetch<{ conversations: Conversation[] }>(
        `/api/assistant/conversations${q ? `?q=${encodeURIComponent(q)}` : ''}`
      );
      setConversations(data.conversations);
      if (data.conversations.length > 0) {
        setActiveId((prev) => prev || data.conversations[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load conversations.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    try {
      const data = await apiFetch<{ messages: Message[] }>(`/api/assistant/conversations/${convId}/messages`);
      setMessages(data.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load messages.');
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeId) {
      loadMessages(activeId);
    } else {
      setMessages([]);
    }
  }, [activeId, loadMessages]);

  const createConversation = async () => {
    const data = await apiFetch<{ conversation: Conversation }>('/api/assistant/conversations', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Companion Chat', language }),
    });
    setConversations((prev) => [data.conversation, ...prev]);
    setActiveId(data.conversation.id);
    setMessages([]);
  };

  const renameConversation = async (id: string) => {
    if (!editingTitle.trim()) return;
    const data = await apiFetch<{ conversation: Conversation }>(`/api/assistant/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title: editingTitle }),
    });
    setConversations((prev) => prev.map((c) => (c.id === id ? data.conversation : c)));
    setEditingId(null);
  };

  const deleteConversation = async (id: string) => {
    await apiFetch(`/api/assistant/conversations/${id}`, { method: 'DELETE' });
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (activeId === id) {
        setActiveId(next[0]?.id || null);
      }
      return next;
    });
  };

  const sendMessage = async (promptText: string, regenerate = false) => {
    const trimmed = promptText.trim();
    if (!trimmed || sending) return;
    setError(null);
    setSending(true);
    setStreamingReply('');

    if (!regenerate) {
      setMessages((prev) => [...prev, { id: `temp_${Date.now()}`, role: 'user', content: trimmed }]);
      setInput('');
    }

    try {
      const token = getApiToken();
      const resp = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          conversationId: activeId || undefined,
          message: trimmed,
          language,
          stream: true,
          regenerate,
        }),
      });

      const contentType = resp.headers.get('content-type') || '';
      if (!resp.ok && contentType.includes('application/json')) {
        const errJson = await resp.json();
        throw new Error(errJson.error || 'AI Assistant could not respond.');
      }

      if (contentType.includes('text/event-stream') && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let resolvedConvId = activeId;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const ev = JSON.parse(line.slice(6));
            if (ev.type === 'chunk') {
              resolvedConvId = ev.conversationId;
              setStreamingReply((prev) => prev + ev.text);
            } else if (ev.type === 'error') {
              throw new Error(ev.error);
            } else if (ev.type === 'done') {
              resolvedConvId = ev.conversationId;
            }
          }
        }

        if (resolvedConvId) {
          setActiveId(resolvedConvId);
          await loadConversations(searchQuery);
          await loadMessages(resolvedConvId);
        }
        setStreamingReply('');
      } else {
        const data = await resp.json();
        if (!data.ok) throw new Error(data.error || 'Assistant failed');
        setActiveId(data.conversationId);
        await loadConversations(searchQuery);
        await loadMessages(data.conversationId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach AI Buddy right now.');
    } finally {
      setSending(false);
    }
  };

  const transformLastAssistant = async (
    text: string,
    mode: 'simplify' | 'shorten' | 'examples' | 'translate_hi' | 'translate_mr'
  ) => {
    setError(null);
    setSending(true);
    try {
      await apiFetch('/api/assistant/transform', {
        method: 'POST',
        body: JSON.stringify({ text, mode, conversationId: activeId || undefined }),
      });
      if (activeId) await loadMessages(activeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not transform message.');
    } finally {
      setSending(false);
    }
  };

  const copyMessage = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const lastUserPrompt = [...messages].reverse().find((m) => m.role === 'user')?.content;

  return (
    <Layout title="AI Buddy Assistant">
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Conversation Sidebar */}
        <section className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-4 space-y-4">
          <button
            type="button"
            onClick={createConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0F2544] dark:bg-teal-600 text-white font-semibold hover:opacity-90 cursor-pointer"
          >
            <Plus className="w-5 h-5" aria-hidden="true" />
            New Conversation
          </button>

          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-3.5 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                loadConversations(e.target.value);
              }}
              placeholder="Search past chats..."
              aria-label="Search past conversations"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-base"
            />
          </div>

          {loading ? (
            <LoadingSkeleton rows={3} />
          ) : conversations.length === 0 ? (
            <p className="text-base text-slate-500 dark:text-slate-400 py-4 text-center">
              No conversations yet. Ask Buddy a question to start.
            </p>
          ) : (
            <ul className="space-y-2 max-h-[420px] overflow-y-auto">
              {conversations.map((conv) => (
                <li
                  key={conv.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    conv.id === activeId
                      ? 'border-[#0F766E] bg-[#EFF6FF] dark:bg-slate-800'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {editingId === conv.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="flex-1 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-base"
                      />
                      <button
                        type="button"
                        onClick={() => renameConversation(conv.id)}
                        className="px-3 py-1 rounded bg-[#0F766E] text-white text-sm font-semibold cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveId(conv.id)}
                        className="text-left font-semibold truncate flex-1 cursor-pointer"
                      >
                        {conv.title}
                      </button>
                      <button
                        type="button"
                        aria-label={`Rename ${conv.title}`}
                        onClick={() => {
                          setEditingId(conv.id);
                          setEditingTitle(conv.title);
                        }}
                        className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${conv.title}`}
                        onClick={() => deleteConversation(conv.id)}
                        className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Chat Workspace */}
        <section className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-5 sm:p-6 space-y-5">
          {error && <ErrorBanner message={error} onRetry={lastUserPrompt ? () => sendMessage(lastUserPrompt, true) : undefined} />}
          {speech.speechError && <ErrorBanner message={speech.speechError} onRetry={speech.clearSpeechError} />}

          {/* Messages */}
          <div className="space-y-4 min-h-[340px] max-h-[520px] overflow-y-auto pr-1">
            {messages.length === 0 && !streamingReply ? (
              <div className="space-y-5 py-4">
                <EmptyState
                  title="Ask Buddy Anything"
                  description="Choose one of the common questions below or speak/type your own question in plain words."
                />
                <div className="grid sm:grid-cols-2 gap-3">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-[#EFF6FF] dark:hover:bg-slate-800 text-lg font-medium cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-2xl p-5 space-y-3 ${
                      m.role === 'user'
                        ? 'bg-[#0F2544] text-white ml-6'
                        : 'bg-[#FAF7F0] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 mr-2'
                    }`}
                  >
                    <div className="text-sm opacity-75">
                      {m.role === 'user' ? 'You' : `Buddy Elder AI · ${m.capability_used || 'assistant'}`}
                    </div>
                    <div className="prose prose-lg dark:prose-invert max-w-none">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                    {m.verification_note && (
                      <p className="text-sm text-[#0F766E] dark:text-teal-400 font-medium">
                        {m.verification_note}
                      </p>
                    )}

                    {m.role === 'assistant' && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() => (speech.speaking ? speech.stopSpeaking() : speech.speak(m.content))}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold cursor-pointer"
                        >
                          {speech.speaking ? <Square className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                          {speech.speaking ? 'Stop' : 'Read Aloud'}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyMessage(m.id, m.content)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold cursor-pointer"
                        >
                          <Copy className="w-4 h-4" />
                          {copiedId === m.id ? 'Copied' : 'Copy'}
                        </button>
                        {lastUserPrompt && (
                          <button
                            type="button"
                            disabled={sending}
                            onClick={() => sendMessage(lastUserPrompt, true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold cursor-pointer"
                          >
                            <RefreshCw className="w-4 h-4" />
                            Regenerate
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => transformLastAssistant(m.content, 'simplify')}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold cursor-pointer"
                        >
                          Simplify
                        </button>
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => transformLastAssistant(m.content, 'shorten')}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold cursor-pointer"
                        >
                          Shorten
                        </button>
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => transformLastAssistant(m.content, 'examples')}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold cursor-pointer"
                        >
                          Give Examples
                        </button>
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => transformLastAssistant(m.content, 'translate_hi')}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold cursor-pointer"
                        >
                          हिन्दी
                        </button>
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => transformLastAssistant(m.content, 'translate_mr')}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-semibold cursor-pointer"
                        >
                          मराठी
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {streamingReply && (
                  <div className="rounded-2xl p-5 bg-[#FAF7F0] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 mr-2 space-y-2">
                    <div className="text-sm opacity-75">Buddy Elder AI is writing...</div>
                    <div className="prose prose-lg dark:prose-invert max-w-none">
                      <ReactMarkdown>{streamingReply}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Input Composer with Editable Voice Transcription */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800"
          >
            <textarea
              rows={3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question here, or tap Speak Now to dictate and edit before sending..."
              aria-label="Message to AI Buddy"
              className="w-full p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  speech.listening
                    ? speech.stopListening()
                    : speech.startListening((transcript) =>
                        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
                      )
                }
                className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-lg cursor-pointer ${
                  speech.listening
                    ? 'bg-red-700 text-white'
                    : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                {speech.listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                {speech.listening ? 'Stop Listening' : 'Speak Now'}
              </button>

              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-[#0F766E] text-white font-semibold text-lg hover:bg-[#0D635D] disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-5 h-5" aria-hidden="true" />
                {sending ? 'Thinking...' : 'Send to Buddy'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </Layout>
  );
}
