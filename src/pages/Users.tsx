import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_CSV_BYTES, parseUsersCsv } from '../lib/csv';
import { saveTextFile } from '../lib/exportFile';
import { api } from '../lib/api';
import { localIso } from '../lib/dates';
import { addMember, AdminMember, adminMembers, deleteMember, resetPin, updateMember } from '../lib/remote';
import { copyText } from '../lib/share';
import { toast } from '../lib/toast';
import AdminGate from '../components/AdminGate';
import { Button, Card, Empty, Field, Input, PageHeader, SectionTitle, cx } from '../components/ui';
import { IconCopy, IconSend, IconTrash, IconUpload } from '../components/icons';
import type { User } from '../types';

const today = () => localIso(new Date());
const key = (name: string) => name.normalize('NFC').toLowerCase().replace(/\s+/g, '');

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const loadLocal = useCallback(async () => setUsers(((await api().users.list()) as User[]).filter((u) => !u.phone.startsWith('app-member-'))), []);
  useEffect(() => { loadLocal(); }, [loadLocal]);

  return (
    <div className="space-y-5">
      <PageHeader title="Members" subtitle="App logins (name + PIN) and WhatsApp contacts." />
      <AdminGate what="add members and give them PINs">
        <AppMembers contacts={users} onLocalChange={loadLocal} />
      </AdminGate>
      <Contacts users={users} reload={loadLocal} />
    </div>
  );
}

/* ── Server members: each has a PIN to log in on their phone ── */

function AppMembers({ contacts, onLocalChange }: { contacts: User[]; onLocalChange: () => void }) {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [shown, setShown] = useState<{ name: string; pin: string } | null>(null);

  const load = useCallback(async () => {
    try { setMembers(await adminMembers()); setError(''); } catch (e: any) { setError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const phoneFor = (name: string) => contacts.find((c) => key(c.name) === key(name))?.phone ?? '';

  async function add(name = form.name, phone = form.phone) {
    if (!name.trim()) { toast('Enter a name', 'error'); return; }
    try {
      const m = await addMember(name.trim());
      if (phone.trim() && !contacts.some((c) => key(c.name) === key(name))) {
        await api().users.create(name.trim(), phone.trim(), today()).catch(() => {});
        onLocalChange();
      }
      setShown({ name: m.name, pin: m.pin });
      setForm({ name: '', phone: '' });
      setAdding(false);
      load();
    } catch (e: any) { toast(e.message, 'error'); }
  }

  async function newPin(m: AdminMember) {
    if (!confirm(`Give ${m.name} a new PIN? The old one stops working.`)) return;
    const r = await resetPin(m.id);
    setShown({ name: m.name, pin: r.pin });
  }

  async function remove(m: AdminMember) {
    if (!confirm(`Delete ${m.name}'s app login and all their recordings and marks?`)) return;
    await deleteMember(m.id);
    load();
  }

  function shareText(name: string, pin: string) {
    return `Powerful Weapon app login 🙏\nName: ${name}\nPIN: ${pin}\n\nInstall the app, choose "I'm a group member", pick your name and enter this PIN.`;
  }

  const notOnApp = contacts.filter((c) => !members.some((m) => key(m.name) === key(c.name)));

  return (
    <section className="space-y-3">
      <SectionTitle action={<Button size="sm" onClick={() => setAdding(!adding)}>{adding ? 'Close' : '+ Add'}</Button>}>
        App logins ({members.length})
      </SectionTitle>
      {error && <p className="text-sm text-red-700">{error}</p>}

      {shown && (
        <Card className="border-gold-300 bg-gold-100/40 space-y-3">
          <div className="text-sm text-gray-700">PIN for <strong>{shown.name}</strong> — share it now; it isn't shown again.</div>
          <div className="text-4xl font-bold tracking-[0.4em] text-brand-900 text-center">{shown.pin}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" onClick={() => {
              const phone = phoneFor(shown.name).replace(/[^\d]/g, '');
              window.open(`https://wa.me/${phone}?text=${encodeURIComponent(shareText(shown.name, shown.pin))}`, '_system');
            }}><IconSend /> WhatsApp</Button>
            <Button size="sm" variant="secondary" onClick={() => copyText(shareText(shown.name, shown.pin))}><IconCopy /> Copy</Button>
          </div>
          <button className="w-full text-xs text-gray-500" onClick={() => setShown(null)}>Done</button>
        </Card>
      )}

      {adding && (
        <Card className="space-y-3">
          <Field label="Name (as members will see it)"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></Field>
          <Field label="WhatsApp number (optional, stays on this phone)" hint="Used to send the PIN and reminders. Never shown to other members.">
            <Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
          </Field>
          <Button block onClick={() => add()}>Create login</Button>
        </Card>
      )}

      {members.length === 0 && !error ? (
        <Empty icon="🔑" title="No app logins yet">Add each member to give them a 4-digit PIN for the app.</Empty>
      ) : (
        <Card pad={false} className="divide-y divide-gray-100 overflow-hidden">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <span className={cx('w-10 h-10 rounded-full grid place-items-center font-semibold shrink-0',
                m.active ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-400')}>{m.name.trim().charAt(0).toUpperCase()}</span>
              <div className="flex-1 min-w-0">
                <div className={cx('text-[0.9375rem] font-medium truncate', !m.active && 'text-gray-400')}>{m.name}</div>
                <button className="text-xs text-brand-700 font-medium" onClick={() => newPin(m)}>New PIN</button>
              </div>
              <button onClick={async () => { await updateMember(m.id, { active: !m.active }); load(); }}
                className={cx('text-xs font-medium px-2.5 h-8 rounded-full shrink-0', m.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                {m.active ? 'Active' : 'Off'}
              </button>
              <button onClick={() => remove(m)} className="text-gray-400 hover:text-red-600 p-2 -mr-2" aria-label={`Delete ${m.name}`}><IconTrash /></button>
            </div>
          ))}
        </Card>
      )}

      {notOnApp.length > 0 && (
        <Card className="space-y-2">
          <div className="text-sm font-medium text-ink">Contacts not on the app yet</div>
          <div className="flex flex-wrap gap-2">
            {notOnApp.map((c) => (
              <button key={c.id} onClick={() => add(c.name, '')} className="h-9 px-3 rounded-full bg-brand-50 text-brand-800 text-sm">+ {c.name}</button>
            ))}
          </div>
        </Card>
      )}
    </section>
  );
}

/* ── Local WhatsApp contacts (phone numbers stay on this phone) ── */

function Contacts({ users, reload }: { users: User[]; reload: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', joined_date: today() });
  const [showAdd, setShowAdd] = useState(false);

  async function add() {
    if (!form.name.trim() || !form.phone.trim()) { toast('Enter a name and phone number', 'error'); return; }
    try {
      await api().users.create(form.name.trim(), form.phone.trim(), form.joined_date);
      setForm({ name: '', phone: '', joined_date: today() });
      setShowAdd(false);
      reload();
    } catch (e: any) { toast(`Could not add contact: ${e.message ?? e}`, 'error'); }
  }

  const fileInput = useRef<HTMLInputElement>(null);
  const [showCsv, setShowCsv] = useState(false);
  const [csvMsg, setCsvMsg] = useState<{ ok: string; errors: string[] } | null>(null);

  async function importCsv(file: File | undefined) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) { setCsvMsg({ ok: '', errors: [`"${file.name}" is not a .csv file. In Excel or Google Sheets use "Save as / Download → CSV".`] }); return; }
    if (file.size > MAX_CSV_BYTES) { setCsvMsg({ ok: '', errors: [`The file is ${Math.round(file.size / 1024)} KB — the limit is ${MAX_CSV_BYTES / 1024} KB. A members list is much smaller; check it is the right file.`] }); return; }
    const { rows, errors } = parseUsersCsv(await file.text());
    if (!rows.length) { setCsvMsg({ ok: '', errors: errors.length ? errors : ['No members found in the file.'] }); return; }
    try {
      const r = (await api().users.importCsv(rows)) as { inserted: number; total: number };
      const skipped = r.total - r.inserted;
      setCsvMsg({ ok: `Added ${r.inserted} contact${r.inserted === 1 ? '' : 's'}${skipped ? ` · ${skipped} already saved` : ''}.`, errors });
      reload();
    } catch (e: any) { setCsvMsg({ ok: '', errors: [`Could not import: ${e.message ?? e}`] }); }
  }

  const sample = 'Name,Mobile number,Joined date\nPriya Selvaraj,+91 98765 43210,05-01-2026\nDaniel Raj,9876501234,12-01-2026\n';

  return (
    <section className="space-y-3">
      <SectionTitle action={
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => { setShowCsv(!showCsv); setCsvMsg(null); }}><IconUpload /> {showCsv ? 'Close' : 'CSV'}</Button>
          <Button size="sm" variant="secondary" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Close' : '+ Add'}</Button>
        </div>
      }>WhatsApp contacts ({users.length})</SectionTitle>
      {showCsv && (
        <Card className="space-y-3">
          <div className="text-sm font-medium text-ink">Add contacts from a CSV file</div>
          <p className="text-sm text-gray-600 leading-relaxed">
            Make a sheet in Excel or Google Sheets with these 3 columns, then save or download it as <strong>.csv</strong> (up to {MAX_CSV_BYTES / 1024} KB).
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-700">
                <tr><th className="text-left px-3 py-2 font-semibold">Name</th><th className="text-left px-3 py-2 font-semibold">Mobile number</th><th className="text-left px-3 py-2 font-semibold">Joined date</th></tr>
              </thead>
              <tbody className="text-gray-600">
                <tr className="border-t border-gray-100"><td className="px-3 py-2">Priya Selvaraj</td><td className="px-3 py-2">+91 98765 43210</td><td className="px-3 py-2">05-01-2026</td></tr>
                <tr className="border-t border-gray-100"><td className="px-3 py-2">Daniel Raj</td><td className="px-3 py-2">9876501234</td><td className="px-3 py-2">12-01-2026</td></tr>
              </tbody>
            </table>
          </div>
          <ul className="text-xs text-gray-500 space-y-1 list-disc pl-4">
            <li>The first row must be the headings.</li>
            <li>Joined date as DD-MM-YYYY. Leave it empty to use today.</li>
            <li>Numbers already saved are skipped, so the same file can be imported again.</li>
          </ul>
          <input ref={fileInput} type="file" className="hidden"
            accept=".csv,text/csv,text/comma-separated-values,application/csv,application/vnd.ms-excel"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; importCsv(f); }} />
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" onClick={() => fileInput.current?.click()}><IconUpload /> Choose file</Button>
            <Button size="sm" variant="secondary" onClick={() => saveTextFile('members-sample.csv', sample, 'text/csv')}>Get sample file</Button>
          </div>
          {csvMsg && (
            <div className="space-y-1 text-sm">
              {csvMsg.ok && <p className="text-emerald-700 font-medium">{csvMsg.ok}</p>}
              {csvMsg.errors.length > 0 && (
                <div className="rounded-xl bg-red-50 p-3 text-red-800 text-xs space-y-1">
                  {csvMsg.ok && <p className="font-medium">{csvMsg.errors.length} row{csvMsg.errors.length === 1 ? '' : 's'} skipped:</p>}
                  {csvMsg.errors.slice(0, 8).map((e) => <p key={e}>{e}</p>)}
                  {csvMsg.errors.length > 8 && <p>…and {csvMsg.errors.length - 8} more.</p>}
                </div>
              )}
            </div>
          )}
        </Card>
      )}
      {showAdd && (
        <Card className="space-y-3">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="WhatsApp number"><Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" /></Field>
          <Field label="Joined on"><Input type="date" value={form.joined_date} onChange={(e) => setForm({ ...form, joined_date: e.target.value })} /></Field>
          <Button block onClick={add}>Add contact</Button>
        </Card>
      )}
      {users.length === 0 ? (
        <p className="text-sm text-gray-500">Used for WhatsApp voice-note imports and reminders. Optional.</p>
      ) : (
        <Card pad={false} className="divide-y divide-gray-100 overflow-hidden">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-[0.9375rem] font-medium truncate">{u.name}</div>
                <div className="text-xs text-gray-500 truncate">{u.phone}</div>
              </div>
              <button onClick={async () => { if (confirm(`Remove ${u.name}? Their grades stay in history.`)) { await api().users.delete(u.id); reload(); } }}
                className="text-gray-400 hover:text-red-600 p-2 -mr-2" aria-label={`Remove ${u.name}`}><IconTrash /></button>
            </div>
          ))}
        </Card>
      )}
    </section>
  );
}
