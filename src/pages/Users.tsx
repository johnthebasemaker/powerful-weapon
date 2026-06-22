import { useEffect, useState } from 'react';
import { parseUsersCsv } from '../lib/csv';
import type { User } from '../types';

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState({ name: '', phone: '', joined_date: new Date().toISOString().slice(0, 10) });
  const [importStatus, setImportStatus] = useState('');

  async function load() {
    setUsers((await window.api.users.list()) as User[]);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.name.trim() || !form.phone.trim()) return;
    try {
      await window.api.users.create(form.name.trim(), form.phone.trim(), form.joined_date);
      setForm({ name: '', phone: '', joined_date: new Date().toISOString().slice(0, 10) });
      load();
    } catch (e: any) {
      alert(`Could not add user: ${e.message ?? e}`);
    }
  }

  async function toggleActive(u: User) {
    await window.api.users.update(u.id, { active: u.active ? 0 : 1 });
    load();
  }

  async function remove(u: User) {
    if (!confirm(`Remove ${u.name}? Their voice notes will remain in history.`)) return;
    await window.api.users.delete(u.id);
    load();
  }

  async function importCsv() {
    const picked = await window.api.files.pickCsv();
    if (!picked) return;
    const { rows, errors } = parseUsersCsv(picked.content);
    if (errors.length) {
      const proceed = confirm(`${errors.length} error(s):\n${errors.slice(0, 5).join('\n')}\n\nImport the ${rows.length} valid rows anyway?`);
      if (!proceed) return;
    }
    const r = (await window.api.users.importCsv(rows)) as { inserted: number; total: number };
    setImportStatus(`Imported ${r.inserted} / ${r.total} users.`);
    setTimeout(() => setImportStatus(''), 4000);
    load();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-gray-500 mt-1">Group members ({users.length})</p>
        </div>
        <button onClick={importCsv} className="px-3 py-1.5 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50">
          Import CSV
        </button>
      </header>

      {importStatus && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-800">
          {importStatus}
        </div>
      )}

      {/* Add form */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-medium mb-3">Add user</h2>
        <div className="grid grid-cols-4 gap-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Name"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm col-span-1"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Phone (+91...)"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm col-span-1"
          />
          <input
            type="date"
            value={form.joined_date}
            onChange={(e) => setForm({ ...form, joined_date: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm col-span-1"
          />
          <button onClick={add} className="bg-brand-500 text-white rounded-md px-3 py-2 text-sm hover:bg-brand-600">
            Add
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          CSV format: <code>name,phone,joined_date</code> (header row optional).
        </p>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Phone</th>
              <th className="px-4 py-2 font-medium">Joined</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium w-32"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.length === 0 && (
              <tr><td colSpan={5} className="text-center text-gray-400 py-8">No users yet.</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2 text-gray-600">{u.phone}</td>
                <td className="px-4 py-2 text-gray-600">{u.joined_date}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => toggleActive(u)}
                    className={`text-xs px-2 py-0.5 rounded-full ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}
                  >
                    {u.active ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => remove(u)} className="text-xs text-red-600 hover:underline">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
