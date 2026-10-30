import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { isNative } from './platform';
import type { Role } from './role';

/** On a phone in admin mode with no server login (0.0.2 upgrade, password changed),
 *  ask for the admin password once, for the whole app — not on every tab. */
export function useAdminSession(role: Role | null) {
  const [needed, setNeeded] = useState(false);

  useEffect(() => {
    if (role !== 'admin' || !isNative()) { setNeeded(false); return; }
    api().settings.getAll().then((s: any) => setNeeded(!s.admin_token)).catch(() => {});
  }, [role]);

  // A 401 anywhere (token expired / password changed) clears the token → ask again.
  useEffect(() => {
    const on = () => { if (role === 'admin' && isNative()) setNeeded(true); };
    window.addEventListener('pw-admin-signed-out', on);
    return () => window.removeEventListener('pw-admin-signed-out', on);
  }, [role]);

  const done = useCallback(() => setNeeded(false), []);
  return { needed, done };
}
