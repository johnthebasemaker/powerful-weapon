import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '../lib/role';
import { listPublicMembers, loginAdmin, loginMember, PublicMember, RemoteError } from '../lib/remote';
import { usePrefs, useT } from '../lib/prefs';
import { syncAndSchedule } from '../lib/scheduler';
import { Button, Input, cx } from '../components/ui';
import { IconChevronLeft } from '../components/icons';

type Step = 'choose' | 'member' | 'admin';

/** First launch (and after logging out): member = name + PIN, admin = password. */
export default function Welcome({ initial = 'choose' }: { initial?: Step }) {
  const [step, setStep] = useState<Step>(initial);
  return (
    <div className="min-h-screen bg-black text-white flex flex-col safe-top safe-bottom">
      {step === 'choose' && <Choose onPick={setStep} />}
      {step === 'member' && <MemberLogin onBack={() => setStep('choose')} />}
      {step === 'admin' && <AdminLogin onBack={() => setStep('choose')} />}
    </div>
  );
}

function Choose({ onPick }: { onPick: (s: Step) => void }) {
  const t = useT();
  const { lang, set } = usePrefs();
  return (
    <>
      <div className="flex justify-end px-4 pt-3">
        <button onClick={() => set('ui_lang', lang === 'ta' ? 'en' : 'ta')}
          className="h-9 px-3 rounded-full bg-white/10 text-sm text-white/90">{lang === 'ta' ? 'English' : 'தமிழ்'}</button>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 pt-2">
        <img src="brand/poster.jpg" alt="உலகத்தில் பெரிய போராயுதம் கர்த்தருடைய வார்த்தை — The most powerful weapon in the world is the Word of God."
          className="w-full max-w-sm rounded-2xl" />
      </div>
      <div className="px-6 pb-8 pt-4 max-w-sm w-full mx-auto space-y-3">
        <p className="text-center text-white/70 text-sm leading-relaxed">
          {t('welcome.tagline')}
        </p>
        <Button variant="gold" size="lg" block onClick={() => onPick('member')}>{t('welcome.member')}</Button>
        <Button className="bg-white/10 text-white hover:bg-white/15" size="lg" block onClick={() => onPick('admin')}>{t('welcome.admin')}</Button>
      </div>
    </>
  );
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 px-3 h-14">
      <button onClick={onBack} className="w-10 h-10 grid place-items-center text-white/80" aria-label={t('common.back')}><IconChevronLeft /></button>
      <div className="font-semibold">{title}</div>
    </div>
  );
}

function useFinish() {
  const { setRole } = useRole();
  const navigate = useNavigate();
  return async (role: 'admin' | 'member') => {
    await setRole(role);
    syncAndSchedule().catch(() => {});
    navigate(role === 'member' ? '/today' : '/dashboard', { replace: true });
  };
}

function MemberLogin({ onBack }: { onBack: () => void }) {
  const t = useT();
  const finish = useFinish();
  const [members, setMembers] = useState<PublicMember[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<PublicMember | null>(null);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { listPublicMembers().then(setMembers).catch((e) => setError(e.message)); }, []);
  // Ignore capitals and spaces: "priyaselva", "PRIYA S" and "priya  selvaraj" all find "Priya Selvaraj".
  const squash = (t: string) => t.normalize('NFC').toLowerCase().replace(/\s+/g, '');
  const filtered = useMemo(() => (members ?? []).filter((m) => squash(m.name).includes(squash(query))), [members, query]);

  async function submit(full: string) {
    if (!picked) return;
    setBusy(true);
    setError('');
    try {
      await loginMember(picked.id, full);
      await finish('member');
    } catch (e: any) {
      const status = e instanceof RemoteError ? e.status : -1;
      setError(status === 401 ? t('err.wrongPin') : status === 429 ? t('err.locked') : status === 0 ? t('err.offline') : e.message);
      setPin('');
      setBusy(false);
    }
  }

  function press(d: string) {
    if (busy) return;
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) submit(next);
  }

  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (picked) {
    return (
      <>
        <Header title={t('welcome.pin')} onBack={() => { setPicked(null); setPin(''); setError(''); }} />
        <div className="flex-1 flex flex-col items-center px-6 pt-6">
          <div className="text-white/70 text-sm">{t('welcome.hello')}</div>
          <div className="text-2xl font-semibold mt-1">{picked.name}</div>
          <div className="flex gap-4 mt-8">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cx('w-4 h-4 rounded-full border-2 border-gold-400', i < pin.length && 'bg-gold-400')} />
            ))}
          </div>
          <div className="h-6 mt-4 text-sm text-red-300">{error}</div>
          <p className="text-xs text-white/50">{t('welcome.pinFrom')}</p>
        </div>
        <div className="grid grid-cols-3 gap-3 px-8 pb-10 max-w-xs w-full mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k) => k === '' ? <span key="blank" /> : (
            <button key={k} disabled={busy}
              onClick={() => (k === '⌫' ? setPin(pin.slice(0, -1)) : press(k))}
              className="h-16 rounded-2xl bg-white/10 active:bg-white/20 text-2xl font-medium">
              {k}
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <Header title={t('welcome.who')} onBack={onBack} />
      <div className="px-4 pb-3">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('welcome.search')}
          className="bg-white/10 border-white/10 text-white placeholder:text-white/40" />
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        {error && <p className="text-sm text-red-300 py-4">{error}</p>}
        {!members && !error && <p className="text-sm text-white/50 py-4">{t('welcome.loadingNames')}</p>}
        {members && members.length === 0 && <p className="text-sm text-white/60 py-4">{t('welcome.noMembers')}</p>}
        <div className="divide-y divide-white/10">
          {filtered.map((m) => (
            <button key={m.id} onClick={() => setPicked(m)} className="w-full flex items-center gap-3 py-3.5 text-left">
              <span className="w-10 h-10 rounded-full bg-brand-700 grid place-items-center font-semibold">{m.name.trim().charAt(0).toUpperCase()}</span>
              <span className="text-[1rem]">{m.name}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function AdminLogin({ onBack, onDone }: { onBack?: () => void; onDone?: () => void }) {
  const finish = useFinish();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await loginAdmin(password);
      if (onDone) onDone(); else await finish('admin');
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <>
      {onBack && <Header title="Admin login" onBack={onBack} />}
      <div className="flex-1 px-6 pt-8 max-w-sm w-full mx-auto space-y-4">
        <p className="text-sm text-white/70 leading-relaxed">Enter the admin password. Only the app owner can change it.</p>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password"
          autoComplete="current-password" onKeyDown={(e) => e.key === 'Enter' && password && submit()}
          className="bg-white/10 border-white/10 text-white placeholder:text-white/40" />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <Button variant="gold" size="lg" block disabled={!password || busy} onClick={submit}>{busy ? 'Checking…' : 'Log in'}</Button>
      </div>
    </>
  );
}
