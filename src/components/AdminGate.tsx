import { ReactNode, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { loginAdmin } from '../lib/remote';
import { Button, Card, Input, SectionTitle } from './ui';
import { IconShield } from './icons';

/** Shows children only when this phone holds an admin login for the Worker. */
export default function AdminGate({ children, what }: { children: ReactNode; what: string }) {
  const [state, setState] = useState<'checking' | 'in' | 'out'>('checking');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api().settings.getAll().then((s: any) => setState(s.admin_token ? 'in' : 'out'));
  }, []);

  async function submit() {
    setBusy(true);
    setError('');
    try { await loginAdmin(password); setState('in'); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  if (state === 'checking') return null;
  if (state === 'in') return <>{children}</>;
  return (
    <Card className="space-y-3">
      <SectionTitle action={<span className="text-brand-700"><IconShield /></span>}>Admin login</SectionTitle>
      <p className="text-sm text-gray-600">Log in once with the admin password to {what}.</p>
      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Admin password"
        onKeyDown={(e) => e.key === 'Enter' && password && submit()} />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <Button block disabled={!password || busy} onClick={submit}>{busy ? 'Checking…' : 'Log in'}</Button>
    </Card>
  );
}
