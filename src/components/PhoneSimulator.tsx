import React, { useState } from 'react';
import { CheckCircle2, Mic, Phone, Settings, ShieldAlert, Video, Wifi } from 'lucide-react';

type SimScreen = 'home' | 'whatsapp' | 'upi' | 'settings' | 'video';

export function PhoneSimulator() {
  const [screen, setScreen] = useState<SimScreen>('home');
  const [feedback, setFeedback] = useState('Tap any app icon on this practice phone to try safely.');
  const [fontLarge, setFontLarge] = useState(false);
  const [wifiOn, setWifiOn] = useState(true);
  const [voiceSent, setVoiceSent] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2B] p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xl font-bold">Virtual Smartphone Practice Simulator</h3>
        {screen !== 'home' && (
          <button
            type="button"
            onClick={() => {
              setScreen('home');
              setFeedback('Returned to Home Screen.');
            }}
            className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold cursor-pointer"
          >
            Back to Phone Home
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-12 gap-6 items-center">
        {/* Phone Bezel */}
        <div className="md:col-span-5 mx-auto w-full max-w-[300px] rounded-[2rem] border-4 border-[#0F2544] dark:border-slate-600 bg-[#FAF7F0] dark:bg-slate-900 p-4 space-y-4">
          <div className="flex justify-between items-center text-xs font-mono-tabular text-slate-600 dark:text-slate-400 px-1">
            <span>10:09 AM</span>
            <span>{wifiOn ? 'Wi-Fi ON' : 'Wi-Fi OFF'}</span>
          </div>

          {screen === 'home' && (
            <div className="grid grid-cols-2 gap-3 py-4">
              <button
                type="button"
                onClick={() => {
                  setScreen('whatsapp');
                  setFeedback('Opened WhatsApp practice screen. Try recording a voice note!');
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-emerald-700 text-white font-semibold cursor-pointer"
              >
                <Mic className="w-7 h-7" />
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScreen('upi');
                  setFeedback('Practice spotting a fake UPI PIN request!');
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[#0F2544] text-white font-semibold cursor-pointer"
              >
                <ShieldAlert className="w-7 h-7" />
                <span>UPI Safety</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScreen('video');
                  setFeedback('Opened Video Call practice screen.');
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[#0F766E] text-white font-semibold cursor-pointer"
              >
                <Video className="w-7 h-7" />
                <span>Video Call</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setScreen('settings');
                  setFeedback('Opened Settings. Try toggling Wi-Fi or Font Size.');
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-700 text-white font-semibold cursor-pointer"
              >
                <Settings className="w-7 h-7" />
                <span>Settings</span>
              </button>
            </div>
          )}

          {screen === 'whatsapp' && (
            <div className="space-y-4 py-2">
              <p className="font-bold text-base">Family Chat (Practice)</p>
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm">
                Daughter: &ldquo;Good morning! Send me a voice note when free.&rdquo;
              </div>
              {voiceSent && (
                <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-sm font-medium">
                  Voice note sent safely (0:06)
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setVoiceSent(true);
                  setFeedback('Great job! You practiced sending a voice message instead of typing small letters.');
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-700 text-white font-semibold cursor-pointer"
              >
                <Mic className="w-5 h-5" />
                Tap to Send Practice Voice Note
              </button>
            </div>
          )}

          {screen === 'upi' && (
            <div className="space-y-3 py-2">
              <p className="font-bold text-base text-red-700 dark:text-red-400">Practice Alert: Stranger Requests PIN</p>
              <p className="text-sm">
                &ldquo;Scan QR & enter UPI PIN to RECEIVE Rs 2,500 prize.&rdquo;
              </p>
              <button
                type="button"
                onClick={() =>
                  setFeedback('Incorrect! Entering your UPI PIN always SENDS money out — never do this to receive money.')
                }
                className="w-full py-2.5 rounded-xl bg-red-700 text-white text-sm font-semibold cursor-pointer"
              >
                Enter UPI PIN (Unsafe)
              </button>
              <button
                type="button"
                onClick={() =>
                  setFeedback('Well done! Declining and blocking unknown UPI PIN requests keeps your money safe.')
                }
                className="w-full py-2.5 rounded-xl bg-[#0F766E] text-white text-sm font-semibold cursor-pointer"
              >
                Decline & Block (Safe)
              </button>
            </div>
          )}

          {screen === 'video' && (
            <div className="space-y-3 py-2 text-center">
              <div className="h-28 rounded-xl bg-[#EFF6FF] dark:bg-slate-800 flex items-center justify-center font-semibold">
                Family Video Preview
              </div>
              <button
                type="button"
                onClick={() => setFeedback('Practice call started! Remember to face soft window light.')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0F766E] text-white font-semibold cursor-pointer"
              >
                <Phone className="w-5 h-5" />
                Start Practice Call
              </button>
            </div>
          )}

          {screen === 'settings' && (
            <div className="space-y-3 py-2">
              <button
                type="button"
                onClick={() => {
                  setWifiOn((w) => !w);
                  setFeedback(`Wi-Fi toggled ${!wifiOn ? 'ON' : 'OFF'} inside simulator.`);
                }}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-300 dark:border-slate-700 cursor-pointer"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Wifi className="w-5 h-5" /> Wi-Fi
                </span>
                <span>{wifiOn ? 'ON' : 'OFF'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFontLarge((f) => !f);
                  setFeedback(`Practice screen text set to ${!fontLarge ? 'Extra Large' : 'Standard'}.`);
                }}
                className={`w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer ${
                  fontLarge ? 'text-xl' : 'text-base'
                }`}
              >
                Toggle Large Font ({fontLarge ? 'Large' : 'Normal'})
              </button>
            </div>
          )}
        </div>

        {/* Coaching Feedback */}
        <div className="md:col-span-7 space-y-3">
          <div className="rounded-xl bg-[#EFF6FF] dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-[#0F766E] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-lg">Simulator Coach</p>
              <p className="text-lg">{feedback}</p>
            </div>
          </div>
          <p className="text-base text-slate-600 dark:text-slate-400">
            Nothing you tap here touches your real phone, contacts, or bank account. Practice freely!
          </p>
        </div>
      </div>
    </div>
  );
}
