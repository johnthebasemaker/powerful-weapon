import { useEffect, useState } from 'react';
import { parseUsersCsv } from '../lib/csv';
import { api } from '../lib/api';
import { localIso } from '../lib/dates';
import { toast } from '../lib/toast';
import { Button, Card, Empty, Field, Input, PageHeader, SectionTitle, cx } from '../components/ui';
import { IconTrash, IconUpload } from '../components/icons';
import type { User } from '../types';

const today = () => localIso(new Date());

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ name: '', phone: '', joined_date: today() });
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    setUsers((await api().users.list()) as User[]);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.name.trim() || !form.phone.trim()) { toast('Enter a name and phone number', 'error'); return; }
    try {
      await api().users.create(form.name.trim(), form.phone.trim(), form.joined_date);
      setForm({ name: '', phone: '', joined_date: today() });
      setShowAdd(false);
      toast('Member added', 'success', 1800);
      load();
    } catch (e: any) {
      toast(`Could not add member: ${e.message ?? e}`, 'error');
    }
  }

  async function toggleActive(u: User) {
    await api().users.update(u.id, { active: u.active ? 0 : 1 });
    load();
  }

  async function remove(u: User) {
    if (!confirm(`Remove ${u.name}? Their voice notes will remain in history.`)) return;
    await api().users.delete(u.id);
    load();
  }

  async function importCsv() {
    const picked = await api().files.pickCsv();
    if (!picked) return;
    const { rows, errors } = parseUsersCsv(picked.content);
    if (errors.length) {
      const proceed = confirm(`${errors.length} error(s):\n${errors.slice(0, 5).join('\n')}\n\nImport the ${rows.length} valid rows anyway?`);
      if (!proceed) return;
    }
    const r = (await api().users.importCsv(rows)) as { inserted: number; total: number };
    toast(`Imported ${r.inserted} of ${r.total} members`, 'success');
    load();
  }

  const active = users.filter((u) => u.active).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Members"
        subtitle={`${users.length} in the group · ${active} active`}
        action={<Button variant="secondary" size="sm" onClick={importCsv}><IconUpload /> CSV</Button>}
      />

      {showAdd ? (
        <Card className="space-y-3">
          <SectionTitle>Add member</SectionTitle>
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" autoComplete="off" /></Field>
          <Field label="WhatsApp number"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" type="tel" inputMode="tel" /></Field>
          <Field label="Joined on"><Input type="date" value={form.joined_date} onChange={(e) => setForm({ ...form, joined_date: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={add}>Add</Button>
          </div>
          <p className="text-xs text-gray-500">CSV import format: <code>name,phone,joined_date</code> (header row optional).</p>
        </Card>
      ) : (
        <Button block onClick={() => setShowAdd(true)}>+ Add member</Button>
      )}

      {users.length === 0 ? (
        <Empty icon="👥" title="No members yet">Add the people in your WhatsApp group, or import them from a CSV file.</Empty>
      ) : (
        <Card pad={false} className="divide-y divide-gray-100 overflow-hidden">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-4 py-3">
              <span className={cx(
                'w-10 h-10 rounded-full grid place-items-center font-semibold shrink-0',
                u.active ? 'bg-brand-100 text-brand-800' : 'bg-gray-100 text-gray-400',
              )}>
                {u.name.trim().charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <div className={cx('text-[15px] font-medium truncate', !u.active && 'text-gray-400')}>{u.name}</div>
                <div className="text-xs text-gray-500 truncate">{u.phone} · joined {u.joined_date}</div>
              </div>
              <button
                onClick={() => toggleActive(u)}
                className={cx('text-xs font-medium px-2.5 h-8 rounded-full shrink-0',
                  u.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500')}
              >
                {u.active ? 'Active' : 'Inactive'}
              </button>
              <button onClick={() => remove(u)} className="text-gray-400 hover:text-red-600 p-2 -mr-2 shrink-0" aria-label={`Remove ${u.name}`}>
                <IconTrash />
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
