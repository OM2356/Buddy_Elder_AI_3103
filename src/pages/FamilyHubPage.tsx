import React, { useEffect, useState } from 'react';
import { Check, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { Layout } from '../components/Layout';
import { EmptyState, ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { apiFetch } from '../lib/api';

interface OverviewData {
  contacts: { id: string; name: string; phone: string; relationship: string; is_emergency: number }[];
  connections: {
    id: string;
    senior_name: string;
    caregiver_name: string;
    caregiver_email: string;
    relationship: string;
    sharing_level: 'PRIVATE' | 'LIMITED' | 'AUTHORIZED';
  }[];
  sentInvitations: { id: string; invitee_email: string; relationship: string; proposed_sharing_level: string; status: string }[];
  receivedInvitations: { id: string; senior_name: string; senior_email: string; relationship: string; proposed_sharing_level: string }[];
}

export default function FamilyHubPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactRel, setContactRel] = useState('Daughter');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRel, setInviteRel] = useState('Family Caregiver');
  const [inviteLevel, setInviteLevel] = useState<'PRIVATE' | 'LIMITED' | 'AUTHORIZED'>('LIMITED');

  const load = async () => {
    try {
      const res = await apiFetch<OverviewData & { ok: true }>('/api/family/overview');
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Family Hub.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    await apiFetch('/api/family/contacts', {
      method: 'POST',
      body: JSON.stringify({ name: contactName, phone: contactPhone, relationship: contactRel, isEmergency: true }),
    });
    setContactName('');
    setContactPhone('');
    await load();
  };

  const deleteContact = async (id: string) => {
    await apiFetch(`/api/family/contacts/${id}`, { method: 'DELETE' });
    await load();
  };

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/family/invite', {
        method: 'POST',
        body: JSON.stringify({
          inviteeEmail: inviteEmail,
          relationship: inviteRel,
          proposedSharingLevel: inviteLevel,
        }),
      });
      setInviteEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invitation.');
    }
  };

  const respondInvite = async (id: string, decision: 'accept' | 'reject') => {
    await apiFetch(`/api/family/invitations/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
    await load();
  };

  const revokeConnection = async (id: string) => {
    await apiFetch(`/api/family/connections/${id}`, { method: 'DELETE' });
    await load();
  };

  return (
    <Layout title="Family Hub & Trusted Contacts">
      <div className="space-y-8">
        {error && <ErrorBanner message={error} onRetry={load} />}

        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : (
          <>
            {/* Pending Received Invitations */}
            {data && data.receivedInvitations.length > 0 && (
              <section className="rounded-2xl border border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/30 p-6 space-y-4">
                <h2 className="text-2xl font-bold">Caregiver Invitations Waiting for Your Response</h2>
                <div className="space-y-3">
                  {data.receivedInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div>
                        <p className="font-bold text-lg">{inv.senior_name} ({inv.senior_email})</p>
                        <p className="text-base text-slate-600 dark:text-slate-300">
                          Relationship: {inv.relationship} · Proposed Sharing: {inv.proposed_sharing_level}
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => respondInvite(inv.id, 'accept')}
                          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#0F766E] text-white font-semibold cursor-pointer"
                        >
                          <Check className="w-4 h-4" /> Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => respondInvite(inv.id, 'reject')}
                          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 font-semibold cursor-pointer"
                        >
                          <X className="w-4 h-4" /> Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Invite Caregiver */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-6 h-6 text-[#0F766E]" />
                <h2 className="text-2xl font-bold">Invite a Trusted Caregiver or Family Member</h2>
              </div>
              <form onSubmit={sendInvite} className="grid sm:grid-cols-4 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label htmlFor="inv-email" className="block text-base font-semibold mb-1">Caregiver Email</label>
                  <input
                    id="inv-email"
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="family@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                  />
                </div>
                <div>
                  <label htmlFor="inv-level" className="block text-base font-semibold mb-1">Sharing Level</label>
                  <select
                    id="inv-level"
                    value={inviteLevel}
                    onChange={(e) => setInviteLevel(e.target.value as typeof inviteLevel)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                  >
                    <option value="PRIVATE">PRIVATE</option>
                    <option value="LIMITED">LIMITED</option>
                    <option value="AUTHORIZED">AUTHORIZED</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-[#0F2544] dark:bg-teal-600 text-white font-semibold text-lg cursor-pointer"
                >
                  Send Invite
                </button>
              </form>
            </section>

            {/* Verified Connections */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-[#0F766E]" />
                <h2 className="text-2xl font-bold">Verified Family Connections</h2>
              </div>
              {!data?.connections.length ? (
                <EmptyState
                  title="No active family connections"
                  description="Send an invitation above or accept a senior invitation to connect safely."
                />
              ) : (
                <div className="space-y-3">
                  {data.connections.map((conn) => (
                    <div
                      key={conn.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div>
                        <p className="font-bold text-lg">
                          {conn.senior_name} ↔ {conn.caregiver_name}
                        </p>
                        <p className="text-base text-slate-600 dark:text-slate-300">
                          {conn.relationship} · Sharing Level: <span className="font-semibold">{conn.sharing_level}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => revokeConnection(conn.id)}
                        className="px-4 py-2 rounded-xl bg-red-700 text-white font-semibold cursor-pointer"
                      >
                        Revoke & Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Trusted Contacts */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
              <h2 className="text-2xl font-bold">Trusted & Emergency Contacts</h2>
              <form onSubmit={addContact} className="grid sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Contact Name"
                  aria-label="Contact Name"
                  className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                />
                <input
                  type="tel"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Phone Number"
                  aria-label="Phone Number"
                  className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                />
                <input
                  type="text"
                  required
                  value={contactRel}
                  onChange={(e) => setContactRel(e.target.value)}
                  placeholder="Relationship"
                  aria-label="Relationship"
                  className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#0F766E] text-white font-semibold text-lg cursor-pointer"
                >
                  <Plus className="w-5 h-5" /> Add Contact
                </button>
              </form>

              {data && data.contacts.length > 0 && (
                <div className="space-y-2 pt-2">
                  {data.contacts.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="font-bold text-lg">{c.name} · {c.relationship}</p>
                        <p className="font-mono-tabular text-slate-600 dark:text-slate-300">{c.phone}</p>
                      </div>
                      <button
                        type="button"
                        aria-label={`Remove ${c.name}`}
                        onClick={() => deleteContact(c.id)}
                        className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-red-700 dark:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
