import React, { useEffect, useState } from 'react';
import { AlertTriangle, MapPin, PhoneCall, ShieldCheck } from 'lucide-react';
import { Layout } from '../components/Layout';
import { ErrorBanner, LoadingSkeleton } from '../components/StateViews';
import { apiFetch } from '../lib/api';

interface Helpline {
  number: string;
  name: string;
  description: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

export default function EmergencyPage() {
  const [helplines, setHelplines] = useState<Helpline[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Voluntary medical info
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicalConditions, setMedicalConditions] = useState('');
  const [emergencyNotes, setEmergencyNotes] = useState('');

  // Double-confirmation SOS dialog state
  const [pendingService, setPendingService] = useState<'112' | '108' | '1930' | 'trusted_contact' | null>(null);
  const [stepTwoConfirm, setStepTwoConfirm] = useState(false);
  const [permitLocation, setPermitLocation] = useState(false);
  const [sosResult, setSosResult] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await apiFetch<{
        profile: Record<string, string>;
        contacts: Contact[];
        verifiedHelplines: Helpline[];
      }>('/api/emergency/profile');
      setHelplines(data.verifiedHelplines);
      setContacts(data.contacts);
      if (data.profile) {
        setPhone(data.profile.phone || '');
        setCity(data.profile.city || '');
        setBloodGroup(data.profile.blood_group || '');
        setAllergies(data.profile.allergies || '');
        setMedicalConditions(data.profile.medical_conditions || '');
        setEmergencyNotes(data.profile.emergency_notes || '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load emergency details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/emergency/profile', {
      method: 'PUT',
      body: JSON.stringify({ phone, city, bloodGroup, allergies, medicalConditions, emergencyNotes }),
    });
    setSavedNotice('Voluntary emergency card saved.');
    setTimeout(() => setSavedNotice(null), 3500);
  };

  const confirmSosAction = async () => {
    if (!pendingService || !stepTwoConfirm) return;
    setError(null);

    let coords: { latitude?: number; longitude?: number } = {};
    if (permitLocation && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000 })
        );
        coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      } catch {
        // Proceed without coordinates if browser denies GPS
      }
    }

    const res = await apiFetch<{ message: string; coords: { latitude: number; longitude: number } | null }>(
      '/api/emergency/sos-log',
      {
        method: 'POST',
        body: JSON.stringify({
          confirmedDoubleCheck: true,
          shareLocationPermitted: permitLocation,
          ...coords,
          selectedService: pendingService,
        }),
      }
    );

    setSosResult(
      res.coords
        ? `${res.message} Recorded approximate coordinates: ${res.coords.latitude.toFixed(4)}, ${res.coords.longitude.toFixed(4)}.`
        : res.message
    );
    setPendingService(null);
    setStepTwoConfirm(false);
  };

  return (
    <Layout title="Emergency Assistance & SOS">
      <div className="space-y-8">
        {error && <ErrorBanner message={error} onRetry={load} />}

        <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-5 flex items-start gap-3">
          <ShieldCheck className="w-6 h-6 text-amber-800 dark:text-amber-300 shrink-0 mt-0.5" />
          <p className="text-lg">
            For your safety and control, Buddy Elder AI <strong>never</strong> automatically dials emergency services or shares your location without your explicit double confirmation.
          </p>
        </div>

        {sosResult && (
          <div className="rounded-2xl border border-teal-400 bg-teal-50 dark:bg-teal-950/40 p-5 text-lg font-semibold">
            {sosResult}
          </div>
        )}

        {loading ? (
          <LoadingSkeleton rows={3} />
        ) : (
          <>
            {/* Verified Indian Helplines */}
            <section className="grid md:grid-cols-3 gap-5">
              {helplines.map((h) => (
                <div
                  key={h.number}
                  className="rounded-2xl border border-red-200 dark:border-red-900 bg-white dark:bg-[#111A2B] p-6 space-y-3"
                >
                  <p className="font-mono-tabular text-4xl font-bold text-red-700 dark:text-red-400">{h.number}</p>
                  <h2 className="text-xl font-bold">{h.name}</h2>
                  <p className="text-base text-slate-600 dark:text-slate-300">{h.description}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingService(h.number as '112' | '108' | '1930');
                      setStepTwoConfirm(false);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-700 text-white font-semibold text-lg hover:bg-red-800 cursor-pointer"
                  >
                    <PhoneCall className="w-5 h-5" />
                    Prepare {h.number} Action
                  </button>
                </div>
              ))}
            </section>

            {/* Double-Confirmation SOS Panel */}
            {pendingService && (
              <section
                role="dialog"
                aria-label="Emergency double confirmation"
                className="rounded-2xl border-2 border-red-600 bg-white dark:bg-[#111A2B] p-6 space-y-4"
              >
                <div className="flex items-center gap-3 text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-7 h-7" />
                  <h2 className="text-2xl font-bold">Double Confirmation Required ({pendingService})</h2>
                </div>
                <p className="text-lg">
                  Step 1: Confirm you wish to prepare an emergency action for <strong>{pendingService}</strong>.
                  If you need immediate help, tap <strong>tel:{pendingService}</strong> on your phone dialer.
                </p>

                <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permitLocation}
                    onChange={(e) => setPermitLocation(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="flex items-center gap-2 text-lg">
                    <MapPin className="w-5 h-5 text-[#0F766E]" />
                    Optional: Share my current browser location in the SOS log
                  </span>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={stepTwoConfirm}
                    onChange={(e) => setStepTwoConfirm(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="text-lg">Step 2: Yes, I confirm this SOS action intentionally.</span>
                </label>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={!stepTwoConfirm}
                    onClick={confirmSosAction}
                    className="px-6 py-3 rounded-xl bg-red-700 text-white font-semibold text-lg disabled:opacity-40 cursor-pointer"
                  >
                    Confirm & Record SOS Action
                  </button>
                  {pendingService !== 'trusted_contact' && (
                    <a
                      href={`tel:${pendingService}`}
                      className="px-6 py-3 rounded-xl bg-[#0F2544] text-white font-semibold text-lg"
                    >
                      Open Phone Dialer ({pendingService})
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setPendingService(null)}
                    className="px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </section>
            )}

            {/* Quick Emergency Family Contacts */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
              <h2 className="text-2xl font-bold">Trusted Emergency Contacts</h2>
              {contacts.length === 0 ? (
                <p className="text-lg text-slate-600 dark:text-slate-300">
                  Add trusted emergency contacts in the Family Hub to see one-tap actions here.
                </p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {contacts.map((c) => (
                    <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-lg">{c.name} ({c.relationship})</p>
                        <p className="font-mono-tabular text-slate-600 dark:text-slate-300">{c.phone}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingService('trusted_contact');
                          setStepTwoConfirm(false);
                        }}
                        className="px-4 py-2 rounded-xl bg-[#0F2544] dark:bg-teal-600 text-white font-semibold cursor-pointer"
                      >
                        Notify / Call
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Voluntary Medical Card */}
            <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
              <h2 className="text-2xl font-bold">Voluntary Emergency Information Card</h2>
              {savedNotice && <p className="text-teal-700 dark:text-teal-400 font-semibold">{savedNotice}</p>}
              <form onSubmit={saveProfile} className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="em-blood" className="block text-base font-semibold mb-1">Blood Group</label>
                  <input
                    id="em-blood"
                    type="text"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    placeholder="e.g. O+"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                  />
                </div>
                <div>
                  <label htmlFor="em-city" className="block text-base font-semibold mb-1">City / Locality</label>
                  <input
                    id="em-city"
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Pune"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                  />
                </div>
                <div>
                  <label htmlFor="em-allergies" className="block text-base font-semibold mb-1">Known Allergies</label>
                  <input
                    id="em-allergies"
                    type="text"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                  />
                </div>
                <div>
                  <label htmlFor="em-cond" className="block text-base font-semibold mb-1">Voluntary Health Notes</label>
                  <input
                    id="em-cond"
                    type="text"
                    value={medicalConditions}
                    onChange={(e) => setMedicalConditions(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="px-7 py-3 rounded-xl bg-[#0F766E] text-white font-semibold text-lg cursor-pointer"
                  >
                    Save Emergency Card
                  </button>
                </div>
              </form>
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
