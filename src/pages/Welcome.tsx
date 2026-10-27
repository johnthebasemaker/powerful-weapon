import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../lib/role';
import { syncAndSchedule } from '../lib/scheduler';
import { Button } from '../components/ui';

/** First launch: members get the daily verse; the admin gets the full toolset. */
export default function Welcome() {
  const { setRole } = useRole();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [askAdmin, setAskAdmin] = useState(false);

  async function choose(role: 'admin' | 'member') {
    setBusy(true);
    await setRole(role);
    syncAndSchedule().catch(() => {});
    navigate(role === 'member' ? '/today' : '/dashboard', { replace: true });
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col safe-top safe-bottom">
      <div className="flex-1 flex items-center justify-center px-6 pt-6">
        <img src="brand/poster.jpg" alt="உலகத்தில் பெரிய போராயுதம் கர்த்தருடைய வார்த்தை — The most powerful weapon in the world is the Word of God."
          className="w-full max-w-sm rounded-2xl" />
      </div>
      <div className="px-6 pb-8 pt-4 max-w-sm w-full mx-auto space-y-3">
        <p className="text-center text-white/70 text-sm leading-relaxed">
          Get one memory verse every day at your group's time — even with the phone locked.
        </p>
        <Button variant="gold" size="lg" block disabled={busy} onClick={() => choose('member')}>
          Start receiving daily verses
        </Button>
        {!askAdmin ? (
          <button className="w-full h-11 text-sm text-white/60 underline-offset-4 hover:underline" onClick={() => setAskAdmin(true)}>
            I'm the group admin
          </button>
        ) : (
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 space-y-3">
            <p className="text-sm text-white/80 leading-relaxed">
              Admin mode is for the one person who picks the weekly verses, posts them to the WhatsApp group and grades voice notes.
            </p>
            <Button variant="secondary" block disabled={busy} onClick={() => choose('admin')}>
              Continue as admin
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
